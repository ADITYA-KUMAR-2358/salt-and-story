# Makes PDF export work when running the backend directly on Windows (outside Docker).
#
# WeasyPrint needs native libraries (Pango, GLib, HarfBuzz, Fontconfig) that Windows
# does not ship. This installs them privately into backend/.gtk using conda-forge.
# Nothing global is changed; backend/app/pdf.py finds the folder automatically.
#
# Usage (from the project root):  powershell -ExecutionPolicy Bypass -File scripts/setup-pdf-windows.ps1
# Docker and Render do not need this: the backend image installs the libraries itself.

$ErrorActionPreference = "Stop"
$target = Join-Path $PSScriptRoot "..\backend\.gtk"

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
    Write-Host "conda was not found. Install Miniconda (https://docs.conda.io) or use Docker: docker compose up --build"
    exit 1
}
if (Test-Path (Join-Path $target "Library\bin\gobject-2.0-0.dll")) {
    Write-Host "PDF libraries are already installed in backend/.gtk"
    exit 0
}
Write-Host "Installing Pango and friends into backend/.gtk (a few minutes, ~200 MB)..."
conda create -y -q -p $target -c conda-forge --override-channels pango
Write-Host "Done. Restart the backend; PDF export will work."
