import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { platform, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { app } from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface SpeechDictateSuccess {
  ok: true;
  text: string;
}

export interface SpeechDictateFailure {
  ok: false;
  message: string;
}

export type SpeechDictateResult = SpeechDictateSuccess | SpeechDictateFailure;

export interface SpeechCheckResult {
  available: boolean;
  message: string;
}

let activeSpeechProcess: ChildProcess | null = null;

/** Embedded fallback so dictation works even when .ps1 files are not copied beside index.js. */
const DICTATE_SPEECH_PS1 = `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
  Add-Type -AssemblyName System.Speech
  $culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-AU')
  try {
    $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
  } catch {
    $culture = [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
    $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
  }
  $recognizer.SetInputToDefaultAudioDevice()
  $recognizer.BabbleTimeout = [TimeSpan]::FromMilliseconds(0)
  $recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(15)
  $recognizer.EndSilenceTimeout = [TimeSpan]::FromSeconds(2)
  $grammar = New-Object System.Speech.Recognition.DictationGrammar
  $recognizer.LoadGrammar($grammar)
  [Console]::Out.WriteLine('{"phase":"ready"}')
  [Console]::Out.Flush()
  try { [Console]::Beep(880, 180) } catch {}
  $result = $recognizer.Recognize([TimeSpan]::FromSeconds(45))
  if ($result -and $result.Text) {
    $payload = @{ ok = $true; text = $result.Text.Trim() } | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($payload)
  } else {
    @{ ok = $false; message = 'No speech detected. Wait for the beep, speak clearly, then pause for 2-3 seconds.' } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
  }
} catch {
  $msg = $_.Exception.Message
  if ($msg -match 'recognition|grammar|culture|language') {
    $msg = 'Windows speech language is not installed. Open Settings -> Time & language -> Speech and add English (Australia) or English (United States).'
  }
  @{ ok = $false; message = $msg } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
}
`;

function loadSpeechScriptSource(): string {
  const candidates = [
    join(__dirname, 'speech-dictate.ps1'),
    join(app.getAppPath(), 'electron/main/speech-dictate.ps1'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return readFileSync(path, 'utf8');
    }
  }
  return DICTATE_SPEECH_PS1;
}

function extractJsonPayload(stdout: string): string | null {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.startsWith('{') && line.endsWith('}')) return line;
  }
  const match = stdout.match(/\{[\s\S]*\}/);
  return match?.[0] ?? null;
}

function parseSpeechOutput(stdout: string): SpeechDictateResult {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith('{') || !line.endsWith('}')) continue;

    try {
      const parsed = JSON.parse(line) as {
        phase?: string;
        ok?: boolean;
        text?: string;
        message?: string;
      };
      if (parsed.phase) continue;

      if (parsed.ok === true && typeof parsed.text === 'string' && parsed.text.trim()) {
        return { ok: true, text: parsed.text.trim() };
      }

      if (parsed.ok === false) {
        return {
          ok: false,
          message:
            parsed.message?.trim() ||
            'No speech detected. Wait for the beep, speak clearly, then pause for 2–3 seconds.',
        };
      }
    } catch {
      // try previous line
    }
  }

  return {
    ok: false,
    message:
      'Speech engine returned no result. Install English speech in Settings → Time & language → Speech.',
  };
}

const CHECK_SPEECH_PS1 = [
  "$ErrorActionPreference = 'Stop'",
  'try {',
  '  Add-Type -AssemblyName System.Speech',
  '  $culture = [System.Globalization.CultureInfo]::GetCultureInfo("en-AU")',
  '  try {',
  '    $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)',
  '  } catch {',
  '    $culture = [System.Globalization.CultureInfo]::GetCultureInfo("en-US")',
  '    $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)',
  '  }',
  '  $recognizer.SetInputToDefaultAudioDevice()',
  '  @{ available = $true; message = "Ready" } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }',
  '} catch {',
  '  @{ available = $false; message = $_.Exception.Message } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }',
  '}',
].join('\n');

async function runPowerShell(script: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; signal: NodeJS.Signals | null }> {
  const scriptPath = join(tmpdir(), `sitescop-speech-${randomBytes(8).toString('hex')}.ps1`);
  await writeFile(scriptPath, script, 'utf8');

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true },
    );

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill();
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      void unlink(scriptPath).catch(() => undefined);
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      void unlink(scriptPath).catch(() => undefined);
      if (code !== 0 && !stdout.trim() && signal !== 'SIGTERM') {
        reject(new Error(stderr.trim() || `Speech script failed (${code ?? 'unknown'})`));
        return;
      }
      resolve({ stdout, stderr, signal });
    });
  });
}

export function cancelSpeechDictation(): void {
  if (!activeSpeechProcess) return;
  activeSpeechProcess.kill();
  activeSpeechProcess = null;
}

export async function checkSpeechEngine(): Promise<SpeechCheckResult> {
  if (platform() !== 'win32') {
    return { available: false, message: 'Dictation is only supported on Windows.' };
  }

  try {
    const { stdout } = await runPowerShell(CHECK_SPEECH_PS1, 12000);
    const jsonLine = extractJsonPayload(stdout);
    if (!jsonLine) {
      return {
        available: false,
        message: 'Windows speech engine is not available. Install English (Australia) under Settings → Time & language → Speech.',
      };
    }
    const parsed = JSON.parse(jsonLine) as { available?: boolean; message?: string };
    if (parsed.available) {
      return { available: true, message: 'Ready' };
    }
    return {
      available: false,
      message:
        parsed.message?.trim() ||
        'Windows speech engine is not available. Install English speech and set your microphone as the default device.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      available: false,
      message: message || 'Could not access the Windows speech engine.',
    };
  }
}

export async function dictateComment(
  onPhase?: (phase: 'ready') => void,
): Promise<SpeechDictateResult> {
  if (platform() !== 'win32') {
    return { ok: false, message: 'Dictation is only supported on Windows.' };
  }

  cancelSpeechDictation();

  const scriptSource = loadSpeechScriptSource();

  const scriptPath = join(tmpdir(), `sitescop-speech-${randomBytes(8).toString('hex')}.ps1`);
  await writeFile(scriptPath, scriptSource, 'utf8');

  return new Promise<SpeechDictateResult>((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { windowsHide: true },
    );
    activeSpeechProcess = child;

    let stdout = '';
    let stderr = '';
    let settled = false;
    let readySignaled = false;

    const finish = (result: SpeechDictateResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeSpeechProcess = null;
      void unlink(scriptPath).catch(() => undefined);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill();
      finish({
        ok: false,
        message: 'Dictation timed out. Wait for the beep, speak clearly, then pause for 2–3 seconds.',
      });
    }, 50000);

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
      if (!readySignaled && stdout.includes('"phase":"ready"')) {
        readySignaled = true;
        onPhase?.('ready');
      }
    });
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      finish({
        ok: false,
        message:
          err.message ||
          'Could not start dictation. Allow SiteScop under Settings → Privacy → Microphone, and set your mic as the default recording device.',
      });
    });

    child.on('close', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        finish({ ok: false, message: 'Dictation cancelled.' });
        return;
      }

      if (stdout.trim()) {
        try {
          finish(parseSpeechOutput(stdout));
          return;
        } catch {
          // fall through
        }
      }

      if (code !== 0) {
        finish({
          ok: false,
          message:
            stderr.trim() ||
            'Could not capture speech. Allow SiteScop under Settings → Privacy → Microphone, and set your mic as the default recording device.',
        });
        return;
      }

      finish({ ok: false, message: 'No speech detected. Wait for the beep, speak clearly, then pause for 2–3 seconds.' });
    });
  });
}

const TRANSCRIBE_WAV_PS1 = `param(
  [Parameter(Mandatory = $true)]
  [string]$WavPath
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
  if (-not (Test-Path -LiteralPath $WavPath)) {
    @{ ok = $false; message = 'Recording file missing.' } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
    exit 0
  }
  Add-Type -AssemblyName System.Speech
  $cultures = @(
    [System.Globalization.CultureInfo]::GetCultureInfo('en-AU'),
    [System.Globalization.CultureInfo]::GetCultureInfo('en-US')
  )
  $bestText = ''
  foreach ($culture in $cultures) {
    try {
      $recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
      $stream = [System.IO.File]::OpenRead($WavPath)
      $recognizer.SetInputToWaveStream($stream)
      $recognizer.BabbleTimeout = [TimeSpan]::FromMilliseconds(0)
      $recognizer.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(300)
      $grammar = New-Object System.Speech.Recognition.DictationGrammar
      $recognizer.LoadGrammar($grammar)
      $result = $recognizer.Recognize([TimeSpan]::FromSeconds(120))
      $stream.Close()
      if ($result -and $result.Text -and $result.Text.Trim().Length -gt $bestText.Length) {
        $bestText = $result.Text.Trim()
      }
    } catch {
      # try next culture
    }
  }
  if ($bestText) {
    @{ ok = $true; text = $bestText } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
  } else {
    @{ ok = $false; message = 'No speech detected. Speak in full sentences, then tap Stop.' } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
  }
} catch {
  $msg = $_.Exception.Message
  if ($msg -match 'recognition|grammar|culture|language') {
    $msg = 'Windows speech language is not installed. Open Settings -> Time & language -> Speech and add English (Australia) or English (United States).'
  }
  @{ ok = $false; message = $msg } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
}
`;

export async function transcribeWavBase64(base64Wav: string): Promise<SpeechDictateResult> {
  if (platform() !== 'win32') {
    return { ok: false, message: 'Dictation is only supported on Windows.' };
  }

  if (!base64Wav?.trim()) {
    return { ok: false, message: 'No audio was recorded. Speak while the voice bar moves, then tap Stop.' };
  }

  const wavPath = join(tmpdir(), `sitescop-dictation-${randomBytes(8).toString('hex')}.wav`);
  const scriptPath = join(tmpdir(), `sitescop-transcribe-${randomBytes(8).toString('hex')}.ps1`);

  try {
    await writeFile(wavPath, Buffer.from(base64Wav, 'base64'));
    await writeFile(scriptPath, TRANSCRIBE_WAV_PS1, 'utf8');

    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, wavPath],
        { windowsHide: true },
      );

      let out = '';
      let err = '';
      const timer = setTimeout(() => child.kill(), 130000);

      child.stdout?.on('data', (chunk: Buffer | string) => {
        out += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer | string) => {
        err += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0 && !out.trim()) {
          reject(new Error(err.trim() || `Transcription failed (${code ?? 'unknown'})`));
          return;
        }
        resolve({ stdout: out, stderr: err });
      });
    });

    if (stdout.trim()) {
      return parseSpeechOutput(stdout);
    }

    return {
      ok: false,
      message: stderr.trim() || 'Could not transcribe the recording.',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: message || 'Could not transcribe the recording.' };
  } finally {
    await unlink(wavPath).catch(() => undefined);
    await unlink(scriptPath).catch(() => undefined);
  }
}
