$ErrorActionPreference = 'Stop'
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
