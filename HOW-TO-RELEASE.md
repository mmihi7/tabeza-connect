# How to Release Tabeza Printer Service

## TL;DR - Fastest Way (2 minutes)

```bash
# 1. Install GitHub CLI (one-time)
winget install --id GitHub.cli

# 2. Login (one-time)
gh auth login

# 3. Release (run this every time)
cd packages/printer-service
release-cli.bat
```

Done! ✅

---

## What You Asked For: "Option 2" (CLI Method)

You chose the CLI automated approach. Here's everything you need:

### Step 1: Install GitHub CLI

```bash
winget install --id GitHub.cli
```

Verify:
```bash
gh --version
```

### Step 2: Login to GitHub

```bash
gh auth login
```

- Choose: **GitHub.com**
- Protocol: **HTTPS**  
- Auth: **Login with browser**
- Copy code and paste in browser

### Step 3: Run the Release Script

```bash
cd packages/printer-service
release-cli.bat
```

This single command:
1. Builds `tabeza-printer-service.exe`
2. Creates GitHub repository
3. Pushes code to GitHub
4. Creates release v1.0.0
5. Uploads .exe, install.bat, README.txt
6. Updates download URLs in your app

### Step 4: Commit the Changes

```bash
git add .
git commit -m "Update printer service download URLs"
git push
```

### Step 5: Test

1. Start app: `pnpm dev:staff`
2. Go to `/setup/printer`
3. Click download button
4. Verify .exe downloads
5. Run .exe as Administrator
6. Check service at `localhost:8765/api/status`

---

## Your Download URL

After release, your URL will be:

```
https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe
```

The script automatically updates this in:
- `apps/staff/app/setup/printer/page.tsx`
- `packages/shared/lib/services/driver-detection-service.ts`

---

## Files Updated Automatically

The `update-download-urls.js` script changes:

**File 1:** `apps/staff/app/setup/printer/page.tsx`
```typescript
// Line ~150
href="https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
```

**File 2:** `packages/shared/lib/services/driver-detection-service.ts`
```typescript
// Line ~115
const baseUrl = 'https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download';
```

---

## Manual Alternative (If Script Fails)

If the automated script doesn't work, run these commands manually:

```bash
# Build
cd packages/printer-service
pnpm run build-installer

# Create repo
gh repo create tabeza-printer-service --public --description "Local Windows service for Tabeza POS printer integration"

# Push code
git init
git add .
git commit -m "Initial commit: Tabeza Printer Service v1.0.0"
git remote add origin https://github.com/YOUR_USERNAME/tabeza-printer-service.git
git push -u origin main

# Create release
gh release create v1.0.0 \
  dist/tabeza-printer-service.exe \
  dist/install.bat \
  dist/README.txt \
  --title "Tabeza Printer Service v1.0.0" \
  --notes "Windows service for POS printer integration"

# Update URLs
cd ../..
node packages/printer-service/update-download-urls.js YOUR_USERNAME
```

---

## Troubleshooting

### GitHub CLI not found
```bash
winget install --id GitHub.cli
# Restart terminal
```

### Not logged in
```bash
gh auth login
```

### Build fails
```bash
cd packages/printer-service
pnpm install
pnpm run build-installer
```

### Repository already exists
```bash
# Delete it first
gh repo delete YOUR_USERNAME/tabeza-printer-service --yes

# Or skip this step - script handles it
```

### Release already exists
```bash
# Delete it first
gh release delete v1.0.0 --yes

# Then create again
```

---

## Documentation Reference

All guides are in `packages/printer-service/`:

- **QUICK-START.md** - 5-minute quick reference
- **CLI-RELEASE-GUIDE.md** - Detailed CLI instructions
- **QUICK-RELEASE-GUIDE.md** - Step-by-step with both options
- **RELEASE-CHECKLIST.md** - Checkbox format
- **GITHUB-SETUP.md** - GitHub-specific details
- **update-download-urls.js** - URL updater script
- **release-cli.bat** - Automated release script (Windows)
- **release-cli.sh** - Automated release script (Mac/Linux)

---

## What Happens After Release

1. **Users visit** your staff app printer setup page
2. **Click download** → Gets .exe from GitHub
3. **Run as Admin** → Service starts on port 8765
4. **App detects** service via health check
5. **User continues** to dashboard
6. **POS prints** → Service intercepts → Sends to cloud
7. **Cloud delivers** digital receipts to customers

---

## Next Release (v1.0.1)

When you need to update:

1. Update version in `package.json`
2. Make your changes
3. Build: `pnpm run build-installer`
4. Release:
   ```bash
   gh release create v1.0.1 \
     dist/tabeza-printer-service.exe \
     --title "Tabeza Printer Service v1.0.1"
   ```

Users with `/releases/latest/download/` URL get updates automatically!

---

## Summary

✅ **Automated:** One script does everything
✅ **Fast:** ~2 minutes total
✅ **Repeatable:** Same process every time
✅ **Safe:** No manual file uploads
✅ **Updates:** Easy version bumps

**Ready to release?** Run:
```bash
cd packages/printer-service
release-cli.bat
```

---

**Questions?** Check `QUICK-START.md` or `CLI-RELEASE-GUIDE.md`
