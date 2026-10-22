param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
try {
    $taskRoot = $PSScriptRoot
    $taskAddress = 'http://localhost:5000'
    function Test-HomepageServer {
        try {
            $taskStatus = Invoke-RestMethod 'http://127.0.0.1:5000/__local/status' -TimeoutSec 5
            return ($taskStatus.enabled -eq $true -and $taskStatus.repository -eq 'jsmorley/jsmorley.github.io')
        } catch { return $false }
    }
    if (-not (Test-HomepageServer)) {
        if (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) {
            throw 'Port 5000 is occupied by another program. No server was started.'
        }
        $taskPython = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python314\pythonw.exe'
        if (-not (Test-Path -LiteralPath $taskPython)) { $taskPython = (Get-Command pythonw.exe -ErrorAction Stop).Source }
        $taskServer = Join-Path $taskRoot 'tools\local_server.py'
        $taskStartInfo = New-Object System.Diagnostics.ProcessStartInfo
        $taskStartInfo.FileName = $taskPython
        $taskStartInfo.Arguments = '-u "' + $taskServer + '"'
        $taskStartInfo.WorkingDirectory = $taskRoot
        $taskStartInfo.UseShellExecute = $true
        $taskStartInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $taskProcess = [System.Diagnostics.Process]::Start($taskStartInfo)
        $taskDeadline = (Get-Date).AddSeconds(110)
        while (-not (Test-HomepageServer)) {
            $taskProcess.Refresh()
            if ($taskProcess.HasExited) { throw 'The editor server stopped. See tools\local-server.stderr.log for details.' }
            if ((Get-Date) -gt $taskDeadline) { throw 'The editor server did not become ready. See the local-server logs in tools.' }
            Start-Sleep -Milliseconds 500
        }
    }
} catch {
    if ($NoBrowser) { throw }
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($_.Exception.Message, 'Homepage editor') | Out-Null
    exit 1
}
