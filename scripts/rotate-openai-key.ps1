# Swap the OpenAI key in .env.local and on Vercel, without it touching a
# shell history, a log or a chat transcript.
#
#   powershell -File scripts/rotate-openai-key.ps1
#
# WHY A SCRIPT AND NOT THREE COMMANDS
# -----------------------------------
# The three commands are easy. Doing them without leaking the thing you are
# rotating is the part that goes wrong:
#
#   * `vercel env add OPENAI_API_KEY production` with the key echoed or
#     pasted on the command line puts it in PSReadLine's history file, which
#     lives at $env:APPDATA\Microsoft\Windows\PowerShell\PSReadLine and is
#     plain text.
#   * Editing .env.local by hand and forgetting the Vercel side leaves
#     production on the old key - which still works, so nothing tells you.
#   * Forgetting the redeploy leaves production on the old key too. Vercel
#     injects environment variables at deploy time; changing one does
#     nothing to deployments that already exist. This is the step most
#     rotations miss, and it fails silently in the safest-looking way: the
#     dashboard shows the new value while the running function uses the old.
#
# So: read once from a secure prompt, verify it actually works BEFORE
# discarding the old one, then update both places and redeploy.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

Write-Host ""
Write-Host "Rotate the OpenAI key" -ForegroundColor Cyan
Write-Host "---------------------"
Write-Host "1. platform.openai.com -> API keys -> revoke the old key"
Write-Host "2. Create a new one and paste it below."
Write-Host "   The prompt is masked; the value is never echoed or stored in history."
Write-Host ""

$secure = Read-Host -AsSecureString "New OPENAI_API_KEY"
$key = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
  [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
)

if ([string]::IsNullOrWhiteSpace($key)) { throw "No key entered - nothing changed." }
if (-not $key.StartsWith("sk-")) { throw "That does not look like an OpenAI key - nothing changed." }

# ---------------------------------------------------------------------------
# Verify BEFORE replacing anything.
# ---------------------------------------------------------------------------
# A rotation that installs a typo takes production down, and the failure
# surfaces as "the analysis could not be completed" on a user's screen rather
# than as an error here. One cheap authenticated GET rules it out.
Write-Host "Verifying the key against the OpenAI API..." -NoNewline
try {
  $null = Invoke-RestMethod -Uri "https://api.openai.com/v1/models" -Method Get `
    -Headers @{ Authorization = "Bearer $key" } -TimeoutSec 30
  Write-Host " ok" -ForegroundColor Green
} catch {
  Write-Host " FAILED" -ForegroundColor Red
  throw "The key was rejected by OpenAI. Nothing was changed."
}

# ---------------------------------------------------------------------------
# .env.local
# ---------------------------------------------------------------------------
if (Test-Path $envFile) {
  $lines = Get-Content $envFile
  if ($lines -match '^OPENAI_API_KEY=') {
    $lines = $lines -replace '^OPENAI_API_KEY=.*', "OPENAI_API_KEY=$key"
  } else {
    $lines += "OPENAI_API_KEY=$key"
  }
  # utf8 explicitly: Set-Content defaults to the ANSI codepage on Windows
  # PowerShell, and Next reads .env.local as UTF-8.
  Set-Content -Path $envFile -Value $lines -Encoding utf8
  Write-Host "Updated .env.local" -ForegroundColor Green
} else {
  Write-Host "No .env.local found - skipped (local dev will not have a key)." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# Vercel production
# ---------------------------------------------------------------------------
Push-Location $root
try {
  Write-Host "Replacing OPENAI_API_KEY on Vercel (production)..."
  # `env rm` is non-fatal: on a project where the variable was never set,
  # its failure is the expected outcome, not a reason to abort the rotation.
  try { vercel env rm OPENAI_API_KEY production --yes 2>&1 | Out-Null } catch {}
  $key | vercel env add OPENAI_API_KEY production | Out-Null
  Write-Host "Set on Vercel" -ForegroundColor Green

  # The step that is easy to skip and silently keeps the old key live.
  Write-Host "Redeploying so the new value reaches the running functions..."
  vercel deploy --prod --yes
} finally {
  Pop-Location
  Remove-Variable key -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Done. Verify with:" -ForegroundColor Cyan
Write-Host '  npx tsx scripts/smoke-vision.mts        # local key'
Write-Host '  curl -s -X POST https://facescan-ashy.vercel.app/api/vision-scan \'
Write-Host '       -H "Content-Type: application/json" -d ''{}''   # expect HTTP 400, not 501'
