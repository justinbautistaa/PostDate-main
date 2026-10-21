param([switch]$Install)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$minimum = [version]'24.15.0'
$selectedNode = (Get-Command node -ErrorAction Stop).Source
$runtimeVersion = [version]((& $selectedNode --version).Trim().TrimStart('v'))
if ($runtimeVersion -lt $minimum) {
    $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    if (Test-Path -LiteralPath $bundledNode) {
        $bundledVersion = [version]((& $bundledNode --version).Trim().TrimStart('v'))
        if ($bundledVersion -ge $minimum) { $selectedNode = $bundledNode; $runtimeVersion = $bundledVersion }
    }
}
if ($runtimeVersion -lt $minimum) { throw 'Install Node 24.15 or later, then rerun this script.' }
$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
$npmCli = Join-Path (Split-Path -Parent $npmCommand) 'node_modules/npm/bin/npm-cli.js'
if (!(Test-Path -LiteralPath $npmCli)) { throw 'Cannot locate the npm CLI beside npm.cmd.' }
$previousPath = $env:PATH
$env:PATH = "$(Split-Path -Parent $selectedNode);$previousPath"
Push-Location $projectRoot
try {
    Write-Host "Verifying with Node $runtimeVersion"
    if ($Install) {
        foreach ($folder in @('.', 'backend', 'frontend')) {
            & $selectedNode $npmCli ci --prefix $folder --include=dev
            if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed for $folder" }
        }
    }
    & $selectedNode $npmCli test --prefix backend
    if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed' }
    & $selectedNode $npmCli test --prefix frontend
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
    & $selectedNode $npmCli run build --prefix frontend
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally {
    Pop-Location
    $env:PATH = $previousPath
}

