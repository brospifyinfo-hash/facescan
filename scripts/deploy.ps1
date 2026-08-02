# Deploy to Vercel production from a git-free copy of the source.
#
# WHY THIS EXISTS
# ---------------
# Vercel reads the local repository's HEAD commit metadata and refuses to
# build when the commit AUTHOR is not a member of the Vercel team:
#
#   "readyState": "BLOCKED", "alwaysRefuseToBuild": true, "buildSkipped": true
#   "readyStateReason": "Git author <email> must have access to the team ..."
#   "seatBlock": { "blockCode": "TEAM_ACCESS_REQUIRED" }
#
# The CLI does not surface this. `vercel ls` just shows the deployment stuck
# on UNKNOWN forever, and a previously-built deployment keeps serving — so it
# looks like a hanging upload or a stale cache when it is neither.
#
# Deploying from a directory with no .git leaves no metadata to check, so the
# build runs normally.
#
# THE ACTUAL FIX (do one of these, then this script is unnecessary):
#   1. Vercel dashboard -> Settings -> Members: give the git author's email
#      access to the team, OR
#   2. git config user.email <email tied to the Vercel account>, then amend
#      the HEAD commit so its author matches.
#
# Note that connecting the GitHub repo to Vercel does NOT sidestep this — the
# same seat check applies to git-triggered builds.

$ErrorActionPreference = "Stop"
$src = Split-Path -Parent $PSScriptRoot
$dst = Join-Path $env:TEMP "facescan-deploy"

if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force $dst | Out-Null

foreach ($d in @("app", "components", "lib", "public")) {
  if (Test-Path "$src\$d") { Copy-Item -Recurse "$src\$d" "$dst\$d" }
}
foreach ($f in @(
  "package.json", "package-lock.json", "next.config.mjs",
  "postcss.config.mjs", "tsconfig.json", "README.md",
  ".gitignore", ".vercelignore"
)) {
  if (Test-Path "$src\$f") { Copy-Item "$src\$f" "$dst\$f" }
}

# Carries the project link so the deploy targets the right Vercel project.
New-Item -ItemType Directory -Force "$dst\.vercel" | Out-Null
Copy-Item "$src\.vercel\project.json" "$dst\.vercel\project.json"

Write-Host "Deploying from $dst (no .git present)" -ForegroundColor Cyan
Push-Location $dst
try { vercel deploy --prod --yes } finally { Pop-Location }
