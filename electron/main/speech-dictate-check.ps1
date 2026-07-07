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
  @{ available = $true; message = 'Ready'; culture = $culture.Name } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
} catch {
  @{ available = $false; message = $_.Exception.Message } | ConvertTo-Json -Compress | ForEach-Object { [Console]::Out.WriteLine($_) }
}
