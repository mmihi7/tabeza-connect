# ✅ Complete Release Checklist

## Status Overview

| Task | Status | Notes |
|------|--------|-------|
| Build .exe file | ✅ DONE | 41.6 MB file exists |
| GitHub repo created | ✅ DONE | https://github.com/billoapp/tabeza-printer-service |
| Code pushed | ✅ DONE | All code on GitHub |
| Dev server running | ✅ DONE | http://localhost:3003 |
| Create GitHub release | ⏳ TODO | Do this now |
| Update download URLs | ⏳ TODO | After release |
| Commit URL changes | ⏳ TODO | After URL update |
| Apply database migration | ⏳ TODO | In Supabase |

## Do These 4 Things Now

### 1️⃣ Create GitHub Release (2 minutes)

**Open**: https://github.com/billoapp/tabeza-printer-service/releases/new

**Fill in**:
- Tag: `v1.0.0`
- Title: `Tabeza Printer Service v1.0.0`
- Description: Copy from `packages/printer-service/RELEASE-NOW.md`
- Upload: `packages/printer-service/dist/tabeza-printer-service.exe`

**Click**: "Publish release"

### 2️⃣ Update URLs (30 seconds)

```cmd
cd C:\Projects\Tabz
node packages\printer-service\update-download-urls.js billoapp
```

### 3️⃣ Commit Changes (30 seconds)

```cmd
git add .
git commit -m "Update printer service download URLs to v1.0.0"
git push
```

### 4️⃣ Apply Database Migration (1 minute)

1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Copy/paste: `database/add-printer-relay-tables.sql`
4. Run

## Test It Works

1. **Browser**: http://localhost:3003/setup/printer
2. **Click**: "Download Printer Service"
3. **Should**: Download from GitHub ✅

## Files to Reference

- `packages/printer-service/RELEASE-NOW.md` - Detailed instructions
- `database/add-printer-relay-tables.sql` - Database migration
- `PRINTER-SERVICE-RELEASE-SUMMARY.md` - Full overview

## That's All!

After these 4 steps, the printer service is fully released and ready for users.

---

**Next**: Open the GitHub URL above and create the release!
