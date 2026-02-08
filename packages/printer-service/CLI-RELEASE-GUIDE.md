# CLI Release Guide (Option 2)

This guide uses GitHub CLI for a fully automated release process.

## Prerequisites

### 1. Install GitHub CLI

**Windows:**
```bash
winget install --id GitHub.cli
```

Or download from: https://github.com/cli/cli/releases

**Verify installation:**
```bash
gh --version
```

### 2. Login to GitHub

```bash
gh auth login
```

Follow the prompts:
- Choose: **GitHub.com**
- Protocol: **HTTPS**
- Authenticate: **Login with a web browser** (easiest)
- Copy the code shown and paste in browser

**Verify login:**
```bash
gh auth status
```

## Automated Release (One Command!)

### Windows:

```bash
cd packages/printer-service
release-cli.bat
```

### Mac/Linux:

```bash
cd packages/printer-service
chmod +x release-cli.sh
./release-cli.sh
```

That's it! The script will:
1. ✅ Build the executable
2. ✅ Create GitHub repository
3. ✅ Push code to GitHub
4. ✅ Create release with files
5. ✅ Update download URLs in your app

## Manual CLI Steps (If You Prefer)

If you want to run each step manually:

### Step 1: Build
```bash
cd packages/printer-service
pnpm install
pnpm run build-installer
```

### Step 2: Create Repository
```bash
gh repo create tabeza-printer-service \
  --public \
  --description "Local Windows service for Tabeza POS printer integration"
```

### Step 3: Push Code
```bash
git init
git add .
git commit -m "Initial commit: Tabeza Printer Service v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/tabeza-printer-service.git
git push -u origin main
```

### Step 4: Create Release
```bash
gh release create v1.0.0 \
  dist/tabeza-printer-service.exe \
  dist/install.bat \
  dist/README.txt \
  --title "Tabeza Printer Service v1.0.0" \
  --notes "Windows service for POS printer integration with Tabeza"
```

### Step 5: Update URLs
```bash
cd ../..
node packages/printer-service/update-download-urls.js YOUR_USERNAME
```

## Verify Release

1. **Check GitHub:**
   ```bash
   gh repo view --web
   ```

2. **Check Release:**
   ```bash
   gh release view v1.0.0 --web
   ```

3. **Test Download:**
   - Start your app: `pnpm dev:staff`
   - Go to printer setup page
   - Click download button
   - Verify .exe downloads

## Troubleshooting

### "gh: command not found"
- GitHub CLI not installed
- Install: `winget install --id GitHub.cli`
- Restart terminal after installation

### "gh auth status" fails
- Not logged in
- Run: `gh auth login`
- Follow browser authentication

### "Repository already exists"
- That's fine! Script will skip creation
- Or delete old repo: `gh repo delete YOUR_USERNAME/tabeza-printer-service`

### Build fails
```bash
cd packages/printer-service
pnpm install
pnpm run build-installer
```

### Release already exists
Delete and recreate:
```bash
gh release delete v1.0.0 --yes
gh release create v1.0.0 dist/tabeza-printer-service.exe ...
```

## Update Existing Release

To release a new version:

1. Update version in `package.json`
2. Build: `pnpm run build-installer`
3. Create new release:
   ```bash
   gh release create v1.0.1 \
     dist/tabeza-printer-service.exe \
     --title "Tabeza Printer Service v1.0.1" \
     --notes "Bug fixes and improvements"
   ```

## Useful Commands

**List releases:**
```bash
gh release list
```

**View release:**
```bash
gh release view v1.0.0
```

**Delete release:**
```bash
gh release delete v1.0.0 --yes
```

**View repository:**
```bash
gh repo view --web
```

**Check auth status:**
```bash
gh auth status
```

## Next Steps After Release

1. ✅ Test download in your app
2. ✅ Commit URL changes:
   ```bash
   git add .
   git commit -m "Update printer service download URLs"
   git push
   ```
3. ✅ Deploy your app to production
4. ✅ Test end-to-end with real POS

## Benefits of CLI Approach

- ✅ Fully automated
- ✅ No manual file uploads
- ✅ Repeatable process
- ✅ Easy to update
- ✅ Version control friendly
- ✅ Fast (< 2 minutes)

---

**Need help?** Check the full guide: `QUICK-RELEASE-GUIDE.md`
