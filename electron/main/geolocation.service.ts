import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { platform, tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

const CAPTURE_GEOLOCATION_PS1 = [
  "$ErrorActionPreference = 'Stop'",
  'try {',
  '  Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  '  [Windows.Devices.Geolocation.Geolocator, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null',
  '  [Windows.Devices.Geolocation.PositionAccuracy, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null',
  '  [Windows.Devices.Geolocation.Geoposition, Windows.System.Devices, ContentType = WindowsRuntime] | Out-Null',
  '  $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {',
  "    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'",
  '  })[0]',
  '  function Await($WinRtTask, $ResultType) {',
  '    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)',
  '    $netTask = $asTask.Invoke($null, @($WinRtTask))',
  '    $netTask.Wait(-1) | Out-Null',
  '    $netTask.Result',
  '  }',
  '  $locator = New-Object Windows.Devices.Geolocation.Geolocator',
  '  $locator.DesiredAccuracy = [Windows.Devices.Geolocation.PositionAccuracy]::High',
  '  $pos = Await ($locator.GetGeopositionAsync()) ([Windows.Devices.Geolocation.Geoposition])',
  '  [PSCustomObject]@{',
  '    Latitude = $pos.Coordinate.Latitude',
  '    Longitude = $pos.Coordinate.Longitude',
  '    Accuracy = $pos.Coordinate.Accuracy',
  '  } | ConvertTo-Json -Compress',
  '} catch {',
  '  @{ error = $_.Exception.Message } | ConvertTo-Json -Compress',
  '}',
].join('\n');

export interface GeoCaptureSuccess {
  ok: true;
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GeoCaptureFailure {
  ok: false;
  message: string;
}

export type GeoCaptureResult = GeoCaptureSuccess | GeoCaptureFailure;

function parseGeoOutput(stdout: string): GeoCaptureResult {
  const parsed = JSON.parse(stdout.trim()) as {
    Latitude?: number | null;
    Longitude?: number | null;
    Accuracy?: number | null;
    error?: string;
  };

  if (parsed.error) {
    return { ok: false, message: parsed.error };
  }

  if (typeof parsed.Latitude !== 'number' || typeof parsed.Longitude !== 'number') {
    return {
      ok: false,
      message: 'Location unavailable. Turn on Windows Location Services in Settings → Privacy → Location.',
    };
  }

  return {
    ok: true,
    latitude: parsed.Latitude,
    longitude: parsed.Longitude,
    accuracy: typeof parsed.Accuracy === 'number' ? parsed.Accuracy : undefined,
  };
}

export async function captureCurrentPosition(): Promise<GeoCaptureResult> {
  if (platform() !== 'win32') {
    return {
      ok: false,
      message: 'Automatic GPS capture is only supported on Windows. Enter coordinates manually.',
    };
  }

  const scriptPath = join(tmpdir(), `sitescop-geo-${randomBytes(8).toString('hex')}.ps1`);
  await writeFile(scriptPath, CAPTURE_GEOLOCATION_PS1, 'utf8');

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: 25000, windowsHide: true },
    );

    return parseGeoOutput(stdout);
  } catch (err) {
    const execErr = err as NodeJS.ErrnoException & { stdout?: string | Buffer };
    const stdout = typeof execErr.stdout === 'string' ? execErr.stdout : execErr.stdout?.toString('utf8');
    if (stdout?.trim()) {
      try {
        return parseGeoOutput(stdout);
      } catch {
        // fall through to generic message
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    if (/timed out|ETIMEDOUT/i.test(message)) {
      return {
        ok: false,
        message: 'GPS timed out. Try again or enter coordinates manually.',
      };
    }
    return {
      ok: false,
      message: 'Could not capture GPS. Turn on Windows Location Services or enter coordinates manually.',
    };
  } finally {
    await unlink(scriptPath).catch(() => undefined);
  }
}
