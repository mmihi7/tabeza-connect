# 🚀 DO THIS NOW - Complete Printer Service Release

## Current Situation

✅ **DONE**: Code written, GitHub repo created, code pushed
❌ **TODO**: Build .exe, create release, update URLs, apply migration

## The Problem

The build failed because a file was locked. We need to run it in a fresh environment.

## The Solution (3 Commands)

### 1️⃣ Open a NEW Command Prompt

**Important**: Open a completely new Command Prompt window (not the one you've been using)

Press `Win + R`, type `cmd`, press Enter

### 2️⃣ Run This Command

```cmd
cd C:\Projects\Tabz\packages\printer-service
complete-release.bat
```

**What it does**:
- Kills any locked processes
- Builds the .exe file
- Creates GitHub release v1.0.0
- Updates download URLs in your app
- Shows you what to do next

**Expected time**: 2-3 minutes

### 3️⃣ If Successful, Run These

```cmd
cd C:\Projects\Tabz
git add .
git commit -m "Update printer service download URLs"
git push
```

## That's It!

After these commands:
- ✅ Your printer service will be released on GitHub
- ✅ Users can download it from your app
- ✅ Everything will be ready to use

## Then Apply Database Migration

1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Copy/paste: `database/add-printer-relay-tables.sql`
4. Run it

## If the Script Fails

### Error: "EPERM: operation not permitted"

**Solution**: Restart your computer, then run the script again.

### Error: "gh: command not found"

**Solution**: GitHub CLI is not in PATH. Run this first:
```cmd
gh auth status
```

If that fails, reinstall GitHub CLI from: https://cli.github.com/

### Error: "Release already exists"

**Solution**: Delete the existing release first:
```cmd
gh release delete v1.0.0 --yes
```

Then run `complete-release.bat` again.

## Need More Details?

See these files:
- `PRINTER-SERVICE-RELEASE-SUMMARY.md` - Full overview
- `packages/printer-service/RELEASE-NOW.md` - Detailed troubleshooting
- `COMPLETE-PRINTER-RELEASE-CHECKLIST.md` - Step-by-step checklist

## Quick Test After Release

1. Start staff app: `pnpm dev:staff`
2. Go to printer setup page
3. Click "Download Printer Service"
4. Should download from GitHub ✅

---

**Bottom Line**: Run `complete-release.bat` in a new Command Prompt window. That's all you need to do right now.
