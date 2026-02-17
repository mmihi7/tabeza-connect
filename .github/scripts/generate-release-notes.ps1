# Release Notes Generator for TabezaConnect
#
# This script generates release notes from git commit history between tags.
# It categorizes commits by conventional commit prefixes and formats them
# into markdown sections for GitHub releases.
#
# Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
#
# Usage: .\generate-release-notes.ps1 -Version <version>
# Example: .\generate-release-notes.ps1 -Version "1.0.0"
#
# Output: Markdown-formatted release notes written to stdout

param(
    [Parameter(Mandatory=$true)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

$CurrentTag = "v$Version"

Write-Host "Generating release notes for $CurrentTag..." -ForegroundColor Cyan

# Find previous release tag
# Requirements: 6.1 - Find previous release tag using git describe
try {
    $PrevTag = git describe --tags --abbrev=0 "$CurrentTag^" 2>$null
    if ($LASTEXITCODE -ne 0) {
        $PrevTag = $null
    }
} catch {
    $PrevTag = $null
}

if ([string]::IsNullOrEmpty($PrevTag)) {
    Write-Host "No previous tag found - this is the first release" -ForegroundColor Yellow
    # Requirements: 6.5 - Handle first release case (no previous tag)
    $CommitRange = "HEAD"
} else {
    Write-Host "Previous tag: $PrevTag" -ForegroundColor Green
    # Requirements: 6.1 - Extract commits between tags
    $CommitRange = "$PrevTag..$CurrentTag"
}

# Extract commits between tags (or all commits for first release)
# Requirements: 6.1 - Extract commits using git log
# Format: "- commit_message (short_hash)"
# Exclude merge commits to keep changelog clean
try {
    $AllCommits = git log $CommitRange --pretty=format:"- %s (%h)" --no-merges 2>$null
    if ($LASTEXITCODE -ne 0) {
        $AllCommits = @()
    }
} catch {
    $AllCommits = @()
}

if ($AllCommits.Count -eq 0 -or [string]::IsNullOrEmpty($AllCommits)) {
    Write-Host "No commits found in range $CommitRange" -ForegroundColor Yellow
    Write-Output "## What's Changed"
    Write-Output ""
    Write-Output "No changes in this release."
    exit 0
}

# Convert to array if it's a single string
if ($AllCommits -is [string]) {
    $AllCommits = $AllCommits -split "`n"
}

# Categorize commits by conventional commit prefixes
# Requirements: 6.2, 6.3 - Categorize commits by type (features, fixes, documentation)
$Features = $AllCommits | Where-Object { $_ -match "^- feat:" }
$Fixes = $AllCommits | Where-Object { $_ -match "^- fix:" }
$Docs = $AllCommits | Where-Object { $_ -match "^- docs:" }
$Chore = $AllCommits | Where-Object { $_ -match "^- chore:" }
$Refactor = $AllCommits | Where-Object { $_ -match "^- refactor:" }
$Test = $AllCommits | Where-Object { $_ -match "^- test:" }
$Style = $AllCommits | Where-Object { $_ -match "^- style:" }
$Perf = $AllCommits | Where-Object { $_ -match "^- perf:" }
$Build = $AllCommits | Where-Object { $_ -match "^- build:" }
$CI = $AllCommits | Where-Object { $_ -match "^- ci:" }

# Other commits (not matching conventional commit prefixes)
$Other = $AllCommits | Where-Object { 
    $_ -notmatch "^- feat:" -and 
    $_ -notmatch "^- fix:" -and 
    $_ -notmatch "^- docs:" -and 
    $_ -notmatch "^- chore:" -and 
    $_ -notmatch "^- refactor:" -and 
    $_ -notmatch "^- test:" -and 
    $_ -notmatch "^- style:" -and 
    $_ -notmatch "^- perf:" -and 
    $_ -notmatch "^- build:" -and 
    $_ -notmatch "^- ci:"
}

# Format release notes into markdown sections
# Requirements: 6.3 - Format into markdown sections
$ReleaseNotes = @()
$ReleaseNotes += "## What's Changed"
$ReleaseNotes += ""

# Add features section if any features exist
if ($Features -and $Features.Count -gt 0) {
    $ReleaseNotes += "### ✨ Features"
    $ReleaseNotes += $Features
    $ReleaseNotes += ""
}

# Add bug fixes section if any fixes exist
if ($Fixes -and $Fixes.Count -gt 0) {
    $ReleaseNotes += "### 🐛 Bug Fixes"
    $ReleaseNotes += $Fixes
    $ReleaseNotes += ""
}

# Add documentation section if any docs changes exist
if ($Docs -and $Docs.Count -gt 0) {
    $ReleaseNotes += "### 📚 Documentation"
    $ReleaseNotes += $Docs
    $ReleaseNotes += ""
}

# Add performance improvements section if any exist
if ($Perf -and $Perf.Count -gt 0) {
    $ReleaseNotes += "### ⚡ Performance Improvements"
    $ReleaseNotes += $Perf
    $ReleaseNotes += ""
}

# Add refactoring section if any exist
if ($Refactor -and $Refactor.Count -gt 0) {
    $ReleaseNotes += "### ♻️ Code Refactoring"
    $ReleaseNotes += $Refactor
    $ReleaseNotes += ""
}

# Add build/CI section if any exist
if (($Build -and $Build.Count -gt 0) -or ($CI -and $CI.Count -gt 0)) {
    $ReleaseNotes += "### 🔧 Build & CI"
    if ($Build) { $ReleaseNotes += $Build }
    if ($CI) { $ReleaseNotes += $CI }
    $ReleaseNotes += ""
}

# Add testing section if any exist
if ($Test -and $Test.Count -gt 0) {
    $ReleaseNotes += "### 🧪 Tests"
    $ReleaseNotes += $Test
    $ReleaseNotes += ""
}

# Add chore section if any exist
if ($Chore -and $Chore.Count -gt 0) {
    $ReleaseNotes += "### 🔨 Chores"
    $ReleaseNotes += $Chore
    $ReleaseNotes += ""
}

# Add style section if any exist
if ($Style -and $Style.Count -gt 0) {
    $ReleaseNotes += "### 💄 Style Changes"
    $ReleaseNotes += $Style
    $ReleaseNotes += ""
}

# Add other changes section if any exist
if ($Other -and $Other.Count -gt 0) {
    $ReleaseNotes += "### 📝 Other Changes"
    $ReleaseNotes += $Other
    $ReleaseNotes += ""
}

# Add link to full changelog
# Requirements: 6.4 - Include link to full changelog
$ReleaseNotes += "---"
$ReleaseNotes += ""
if (![string]::IsNullOrEmpty($PrevTag)) {
    $ReleaseNotes += "**Full Changelog**: https://github.com/billoapp/TabezaConnect/compare/$PrevTag...$CurrentTag"
} else {
    # First release - link to all commits
    $ReleaseNotes += "**Full Changelog**: https://github.com/billoapp/TabezaConnect/commits/$CurrentTag"
}

# Output release notes
$ReleaseNotes | ForEach-Object { Write-Output $_ }

Write-Host "" -ForegroundColor Green
Write-Host "✅ Release notes generated successfully" -ForegroundColor Green
