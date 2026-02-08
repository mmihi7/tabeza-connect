# Release Checklist - Tabeza Printer Service

Use this checklist to ensure you complete all steps correctly.

## ✅ Pre-Release Checklist

- [ ] Code is tested and working
- [ ] Version number updated in `package.json`
- [ ] All dependencies installed (`pnpm install`)

## 📦 Step 1: Build the Executable

```bash
# From root directory
pnpm build:printer-service
```

**Verify:**
- [ ] `packages/printer-service/dist/tabeza-printer-service.exe` exists
- [ ] `packages/printer-service/dist/install.bat` exists
- [ ] `packages/printer-service/dist/README.txt` exists

## 🐙 Step 2: Create GitHub Repository

### Via GitHub Website:
1. [ ] Go to https://github.com/new
2. [ ] Repository name: `tabeza-printer-service`
3. [ ] Description: `Local Windows service for Tabeza POS printer integration`
4. [ ] Visibility: **Public**
5. [ ] **DO NOT** check "Initialize with README"
6. [ ] Click "Create repository"

**Note your GitHub username:** ___________________

## 📤 Step 3: Push Code to GitHub

```bash
cd packages/printer-service

# Initialize git (if needed)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Tabeza Printer Service v1.0.0"

# Add remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/tabeza-printer-service.git

# Push
git branch -M main
git push -u origin main
```

**Verify:**
- [ ] Code is visible on GitHub
- [ ] All files uploaded correctly

## 🚀 Step 4: Create GitHub Release

### Via GitHub Website:
1. [ ] Go to your repository on GitHub
2. [ ] Click "Releases" (right sidebar)
3. [ ] Click "Create a new release"
4. [ ] Tag: `v1.0.0`
5. [ ] Title: `Tabeza Printer Service v1.0.0`
6. [ ] Description: (copy from QUICK-RELEASE-GUIDE.md)
7. [ ] Upload files:
   - [ ] `tabeza-printer-service.exe`
   - [ ] `install.bat`
   - [ ] `README.txt`
8. [ ] Click "Publish release"

**Your download URL:**
```
https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe
```

## 🔗 Step 5: Update Download Links

### Option A: Automatic (Recommended)

```bash
cd packages/printer-service
node update-download-urls.js YOUR_USERNAME
```

### Option B: Manual

**File 1:** `apps/staff/app/setup/printer/page.tsx` (line ~150)
```typescript
// OLD:
href="https://github.com/tabeza/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"

// NEW:
href="https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
```

**File 2:** `packages/shared/lib/services/driver-detection-service.ts` (line ~115)
```typescript
// OLD:
const baseUrl = 'https://github.com/tabeza/tabeza-printer-service/releases/latest/download';

// NEW:
const baseUrl = 'https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download';
```

**Verify:**
- [ ] Both files updated
- [ ] URLs contain your GitHub username
- [ ] No typos in URLs

## 🧪 Step 6: Test Everything

### Test Download:
1. [ ] Start your staff app: `pnpm dev:staff`
2. [ ] Go to printer setup page
3. [ ] Click download button
4. [ ] Verify .exe downloads

### Test Installation:
1. [ ] Right-click downloaded .exe
2. [ ] Select "Run as administrator"
3. [ ] Service starts successfully
4. [ ] Visit `http://localhost:8765/api/status`
5. [ ] See service status JSON

### Test in App:
1. [ ] Refresh printer setup page
2. [ ] Status changes to "Service Running"
3. [ ] "Continue to Dashboard" button becomes enabled
4. [ ] Click button and reach dashboard

**All tests passed:**
- [ ] Download works
- [ ] Installation works
- [ ] Service runs
- [ ] App detects service

## 📝 Step 7: Commit Changes

```bash
# From root directory
git add .
git commit -m "Update printer service download URLs"
git push
```

**Verify:**
- [ ] Changes committed
- [ ] Changes pushed to main repository

## 🎉 Step 8: Deploy

If using Vercel:
```bash
# Vercel will auto-deploy on push, or manually:
vercel --prod
```

**Verify:**
- [ ] Production deployment successful
- [ ] Download link works in production
- [ ] Service detection works in production

## 📋 Post-Release

- [ ] Test on a clean Windows machine
- [ ] Update documentation if needed
- [ ] Announce release to team
- [ ] Monitor for issues

## 🆘 Troubleshooting

### "404 Not Found" when downloading
- Check GitHub username in URLs
- Verify release is published (not draft)
- Confirm .exe was uploaded to release

### Build fails
```bash
cd packages/printer-service
pnpm install
pnpm build-installer
```

### Can't push to GitHub
- Verify GitHub username is correct
- Check repository permissions
- Try using personal access token

### Service not detected
- Ensure service is running
- Check port 8765 is not blocked
- Verify Windows Firewall settings

## 📞 Support

If you encounter issues:
- Check QUICK-RELEASE-GUIDE.md for detailed instructions
- Review GITHUB-SETUP.md for GitHub-specific help
- Contact: support@tabeza.co.ke

---

**Release Date:** ___________________
**Released By:** ___________________
**Version:** v1.0.0
