# Installs the 3-D toolchain on Windows 10/11, the counterpart of install-3d-tools.sh, for
# Claude Code sessions that run on this PC (Claude Desktop, or `claude remote-control`).
# Everything goes under %LOCALAPPDATA%\3d-tools with no admin rights, except the KTX-Software
# installer, which asks for permission once. Idempotent: run it again to repair or update.
#
#   blender        Blender LTS, with Cycles set to the fastest GPU (OptiX on NVIDIA RTX)
#   vsp, vspscript NASA OpenVSP, with its Python API in py3d
#   py3d           Python 3.13 venv: CadQuery, trimesh, manifold3d, OpenCV, Pillow, numpy, scipy,
#                  shapely, rtree, networkx, pygltflib, openvsp
#   gltf-transform, gltfpack   glTF optimisers (portable Node 22 is fetched if Node is missing)
#   toktx, ktx     KTX-Software (KTX2 / Basis Universal textures)
#   fetch-texture  CC0 materials and HDRIs from ambientCG and Poly Haven
#
# Run:  powershell -ExecutionPolicy Bypass -File tools\install-3d-tools.ps1
#  or:  irm https://raw.githubusercontent.com/Hello-13/Hello-Woorld/master/tools/install-3d-tools.ps1 | iex
# Then open a new terminal so the updated PATH applies.

$BlenderVersion = '4.5.14'
$OpenVspVersion = '3.55.0'
$KtxVersion     = '4.4.2'
$PythonVersion  = '3.13.9'
$Prefix = if ($env:TOOLS_PREFIX) { $env:TOOLS_PREFIX } else { Join-Path $env:LOCALAPPDATA '3d-tools' }
$Raw    = 'https://raw.githubusercontent.com/Hello-13/Hello-Woorld'
$Refs   = @('master', 'claude/aerospace-3d-models-gjms7d')

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Bin   = Join-Path $Prefix 'bin'
$Cache = Join-Path $Prefix 'downloads'
New-Item -ItemType Directory -Force -Path $Prefix, $Bin, $Cache | Out-Null
$Ready  = New-Object System.Collections.Generic.List[string]
$Failed = New-Object System.Collections.Generic.List[string]
$PathDirs = New-Object System.Collections.Generic.List[string]
$PathDirs.Add($Bin)

function Log([string]$m) { Write-Host "[3d-tools] $m" }

function Fetch([string]$url, [string]$dest) {
  if (Test-Path $dest) { return }
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile "$dest.part" -ErrorAction Stop
  Move-Item -Force "$dest.part" $dest -ErrorAction Stop
}

function Expand([string]$zip, [string]$dest) {
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  if (Get-Command tar.exe -ErrorAction SilentlyContinue) {
    & tar.exe -xf $zip -C $dest
    if ($LASTEXITCODE -ne 0) { throw "could not extract $zip" }
  } else {
    Expand-Archive -Force -Path $zip -DestinationPath $dest -ErrorAction Stop
  }
}

function Shim([string]$name, [string]$target) {
  Set-Content -Encoding ASCII -Path (Join-Path $Bin "$name.cmd") -Value "@echo off`r`ncall `"$target`" %*"
}

function Step([string]$name, [scriptblock]$body) {
  try { & $body; $Ready.Add($name) } catch { $Failed.Add($name); Log "FAILED: $name - $($_.Exception.Message)" }
}

# helper files: from this checkout, or from GitHub when the script is piped into iex
function Helper([string]$file) {
  $dest = Join-Path $Prefix $file
  if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot $file))) {
    Copy-Item -Force (Join-Path $PSScriptRoot $file) $dest
    return $dest
  }
  foreach ($ref in $Refs) {
    try { Invoke-WebRequest -UseBasicParsing -Uri "$Raw/$ref/tools/$file" -OutFile $dest -ErrorAction Stop; return $dest } catch { }
  }
  if (Test-Path $dest) { return $dest }
  throw "$file not found"
}

# ------------------------------------------------------------------ helpers
Step 'helpers' {
  $script:GpuPy = Helper 'blender_gpu.py'
  $script:TexPy = Helper 'fetch-texture.py'
}

# ------------------------------------------------------------------ Blender
Step "blender $BlenderVersion" {
  $series = $BlenderVersion.Substring(0, $BlenderVersion.LastIndexOf('.'))
  $dir = Join-Path $Prefix "blender-$BlenderVersion-windows-x64"
  $exe = Join-Path $dir 'blender.exe'
  if (-not (Test-Path $exe)) {
    Log "Blender $BlenderVersion"
    $zip = Join-Path $Cache "blender-$BlenderVersion-windows-x64.zip"
    Fetch "https://download.blender.org/release/Blender$series/blender-$BlenderVersion-windows-x64.zip" $zip
    Expand $zip $Prefix
    Remove-Item -Force $zip
  }
  if (-not (Test-Path $exe)) { throw 'blender.exe missing after extract' }
  Shim 'blender' $exe
  # Cycles on the fastest GPU, saved in Blender's preferences for the UI as well
  if ($script:GpuPy) {
    $out = & $exe -b --python $script:GpuPy -- --save 2>&1 | Out-String
    $line = ($out -split "`n" | Where-Object { $_ -like 'blender_gpu:*' } | Select-Object -First 1)
    if ($line) { Log $line.Trim() }
  }
}

# ------------------------------------------------------------------ OpenVSP
Step "openvsp $OpenVspVersion" {
  $dir = Join-Path $Prefix "OpenVSP-$OpenVspVersion-win64"
  if (-not (Test-Path (Join-Path $dir 'vsp.exe'))) {
    Log "OpenVSP $OpenVspVersion"
    $zip = Join-Path $Cache "OpenVSP-$OpenVspVersion-win64-Python3.13.zip"
    Fetch "https://openvsp.org/download.php?file=zips/current/windows/OpenVSP-$OpenVspVersion-win64-Python3.13.zip" $zip
    Expand $zip $Prefix
    Remove-Item -Force $zip
  }
  if (-not (Test-Path (Join-Path $dir 'vsp.exe'))) { throw 'vsp.exe missing after extract' }
  Shim 'vsp' (Join-Path $dir 'vsp.exe')
  Shim 'vspscript' (Join-Path $dir 'vspscript.exe')
  $script:VspDir = $dir
}

# ------------------------------------------------------------------ Python 3.13 and the py3d venv
function Find-Python313 {
  if (Get-Command py.exe -ErrorAction SilentlyContinue) {
    $p = & py.exe -3.13 -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $p) { return "$p".Trim() }
  }
  $cand = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'
  if (Test-Path $cand) { return $cand }
  return $null
}

Step 'py3d (cadquery, trimesh, manifold3d, opencv, pillow, pygltflib, openvsp)' {
  $venv = Join-Path $Prefix 'py'
  $vpy = Join-Path $venv 'Scripts\python.exe'
  if (-not (Test-Path $vpy)) {
    $python = Find-Python313
    if (-not $python) {
      Log "Python $PythonVersion (per-user)"
      $inst = Join-Path $Cache "python-$PythonVersion-amd64.exe"
      Fetch "https://www.python.org/ftp/python/$PythonVersion/python-$PythonVersion-amd64.exe" $inst
      $p = Start-Process -FilePath $inst -ArgumentList '/quiet', 'InstallAllUsers=0', 'Include_launcher=0', 'Include_test=0', 'PrependPath=0', 'Shortcuts=0' -Wait -PassThru
      if ($p.ExitCode -ne 0) { throw "Python installer exit code $($p.ExitCode)" }
      Remove-Item -Force $inst
      $python = Find-Python313
    }
    if (-not $python) { throw 'Python 3.13 not found' }
    & $python -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw 'could not create the venv' }
  }
  & $vpy -c "import cadquery, trimesh, manifold3d, cv2, PIL, pygltflib, scipy, shapely, rtree, networkx" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Log 'Python packages'
    & $vpy -m pip install -q --upgrade pip 2>&1 | Out-Null
    & $vpy -m pip install -q cadquery trimesh manifold3d numpy scipy pillow opencv-python-headless pygltflib shapely rtree networkx 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }
  }
  & $vpy -c "import openvsp" 2>$null
  if ($LASTEXITCODE -ne 0 -and $script:VspDir) {
    foreach ($pkg in 'utilities', 'degen_geom', 'openvsp_config', 'openvsp') {
      $src = Join-Path $script:VspDir "python\$pkg"
      if (Test-Path $src) { & $vpy -m pip install -q $src 2>&1 | Out-Null }
    }
  }
  Shim 'py3d' $vpy
  if ($script:TexPy) {
    Set-Content -Encoding ASCII -Path (Join-Path $Bin 'fetch-texture.cmd') -Value "@echo off`r`ncall `"$vpy`" `"$($script:TexPy)`" %*"
  }
  & $vpy -c "import openvsp" 2>$null
  if ($LASTEXITCODE -ne 0) { Log 'note: the OpenVSP Python API is not importable (vsp and vspscript still work)' }
}

# ------------------------------------------------------------------ glTF tools
Step 'gltf-transform, gltfpack' {
  $npm = $null
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { $npm = $cmd.Source }
  if (-not $npm) {
    $index = Invoke-RestMethod -UseBasicParsing -Uri 'https://nodejs.org/dist/index.json' -ErrorAction Stop
    $v = ($index | Where-Object { $_.version -like 'v22.*' } | Select-Object -First 1).version
    $nodeDir = Join-Path $Prefix "node-$v-win-x64"
    if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
      Log "Node $v (portable)"
      $zip = Join-Path $Cache "node-$v-win-x64.zip"
      Fetch "https://nodejs.org/dist/$v/node-$v-win-x64.zip" $zip
      Expand $zip $Prefix
      Remove-Item -Force $zip
    }
    $npm = Join-Path $nodeDir 'npm.cmd'
    $env:Path = "$nodeDir;$env:Path"
    $PathDirs.Add($nodeDir)
  }
  $nm = Join-Path $Prefix 'node'
  if (-not (Test-Path (Join-Path $nm 'node_modules\.bin\gltfpack.cmd')) -or -not (Test-Path (Join-Path $nm 'node_modules\.bin\gltf-transform.cmd'))) {
    New-Item -ItemType Directory -Force -Path $nm | Out-Null
    & $npm install --prefix $nm --no-audit --no-fund -s '@gltf-transform/cli' gltfpack 2>&1 | Out-Null
  }
  foreach ($t in 'gltf-transform', 'gltfpack') {
    $c = Join-Path $nm "node_modules\.bin\$t.cmd"
    if (-not (Test-Path $c)) { throw "$t missing" }
    Shim $t $c
  }
}

# ------------------------------------------------------------------ KTX-Software
Step "toktx $KtxVersion" {
  $found = Get-Command toktx.exe -ErrorAction SilentlyContinue
  $path = if ($found) { $found.Source } else { Join-Path $env:ProgramFiles 'KTX-Software\bin\toktx.exe' }
  if (-not (Test-Path $path)) {
    Log "KTX-Software $KtxVersion (asks for admin permission once)"
    $inst = Join-Path $Cache "KTX-Software-$KtxVersion-Windows-x64.exe"
    Fetch "https://github.com/KhronosGroup/KTX-Software/releases/download/v$KtxVersion/KTX-Software-$KtxVersion-Windows-x64.exe" $inst
    $p = Start-Process -FilePath $inst -ArgumentList '/S' -Verb RunAs -Wait -PassThru
    if ($p.ExitCode -ne 0) { throw "KTX installer exit code $($p.ExitCode)" }
    Remove-Item -Force $inst
  }
  if (-not (Test-Path $path)) { throw 'toktx.exe not found' }
  Shim 'toktx' $path
  Shim 'ktx' (Join-Path (Split-Path $path) 'ktx.exe')
}

# ------------------------------------------------------------------ PATH
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if (-not $userPath) { $userPath = '' }
$parts = $userPath -split ';' | Where-Object { $_ }
foreach ($d in $PathDirs) { if ($parts -notcontains $d) { $parts = @($d) + $parts } }
[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
$env:Path = (($PathDirs -join ';') + ';' + $env:Path)

Log "ready: $($Ready -join ', ')"
if ($Failed.Count -gt 0) { Log "failed: $($Failed -join ', ')" }
Log "tools are in $Bin (on your user PATH; open a new terminal to use them)"
