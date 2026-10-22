param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
try {
    $taskListeners = @(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue)
    foreach ($taskProcessID in ($taskListeners.OwningProcess | Sort-Object -Unique)) {
        $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $taskProcessID"
        $taskAbsoluteScript = Join-Path $PSScriptRoot 'tools\local_server.py'
        $taskCommand = $taskProcess.CommandLine
        if ($taskProcess.Name -notmatch '^pythonw?\.exe$' -or -not $taskCommand -or ($taskCommand -notlike "*$taskAbsoluteScript*" -and $taskCommand -notmatch '(?:^|\s)"?tools[\\/]local_server\.py"?(?:\s|$)')) {
            throw 'Port 5000 belongs to another program. Nothing was stopped.'
        }
        Stop-Process -Id $taskProcessID -ErrorAction Stop
    }
} catch {
    if ($Quiet) { throw }
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($_.Exception.Message, 'Homepage editor') | Out-Null
    exit 1
}
