# Quick Release Guide - Tabeza Printer Service

## Step 1: Build the Executable

From the root directory, run:
```bash
pnpm build:printer-service
```

This creates:
- `packages/printer-service/dist/tabeza-printer-service.exe`
- `packages/printer-service/dist/install.bat`
- `packages/printer-service/dist/README.txt`

## Step 2: Create GitHub Repository

### Option A: Via GitHub Website (Easiest)

1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `tabeza-printer-service`
   - **Description**: `Local Windows service for Tabeza POS printer integration`
   - **Visibility**: Public
   - **DO NOT** check "Initialize with README" (we have our own)
3. Click **Create repository**

### Option B: Via GitHub CLI

```bash
gh repo create tabeza-printer-service --public --description "Local Windows service for Tabeza POS printer integration"
```

## Step 3: Push Code to GitHub

```bash
# Navigate to printer service directory
cd packages/printer-service

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Tabeza Printer Service v1.0.0"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/tabeza-printer-service.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 4: Create GitHub Release

### Option A: Via GitHub Website (Recommended for First Release)

1. Go to your repository: `https://github.com/YOUR_USERNAME/tabeza-printer-service`
2. Click **Releases** (right sidebar)
3. Click **Create a new release**
4. Fill in:
   - **Tag**: `v1.0.0` (type this, it will create the tag)
   - **Release title**: `Tabeza Printer Service v1.0.0`
   - **Description**:
     ```markdown
     # Tabeza Printer Service v1.0.0
     
     Windows service for integrating POS systems with Tabeza digital receipts.
     
     ## Installation
     
     1. Download `tabeza-printer-service.exe`
     2. Run as Administrator
     3. Service will start on http://localhost:8765
     
     ## Requirements
     
     - Windows 10 or later
     - Administrator privileges
     - Internet connection
     
     ## What's Included
     
     - Standalone executable (no Node.js installation required)
     - Automatic configuration
     - Health monitoring
     
     ## Support
     
     - Email: support@tabeza.co.ke
     - Website: https://tabeza.co.ke
     ```
5. **Attach files**: Drag and drop these files from `packages/printer-service/dist/`:
   - `tabeza-printer-service.exe`
   - `install.bat`
   - `README.txt`
6. Click **Publish release**

### Option B: Via GitHub CLI (Faster for Updates)

```bash
cd packages/printer-service

gh release create v1.0.0 \
  dist/tabeza-printer-service.exe \
  dist/install.bat \
  dist/README.txt \
  --title "Tabeza Printer Service v1.0.0" \
  --notes "Windows service for POS printer integration with Tabeza. Download tabeza-printer-service.exe and run as Administrator."
```

## Step 5: Get Your Download URL

After creating the release, your download URL will be:

```
https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/download/v1.0.0/tabeza-printer-service.exe
```

Or use the "latest" URL (always points to newest release):

```
https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe
```

**Copy this URL - you'll need it for Step 6!**

## Step 6: Update Download Links in Your App

You need to update 2 files with your actual GitHub username and download URL.

### File 1: `apps/staff/app/setup/printer/page.tsx`

Find this line (around line 150):
```typescript
href="https://github.com/tabeza/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
```

Replace with YOUR URL:
```typescript
href="https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe"
```

### File 2: `packages/shared/lib/services/driver-detection-service.ts`

Find this line (around line 15):
```typescript
downloadUrl: 'https://github.com/tabeza/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe',
```

Replace with YOUR URL:
```typescript
downloadUrl: 'https://github.com/YOUR_USERNAME/tabeza-printer-service/releases/latest/download/tabeza-printer-service.exe',
```

## Step 7: Test the Download

1. Open your staff app: `http://localhost:3003`
2. Go to the printer setup page
3. Click the download button
4. Verify the .exe downloads correctly
5. Run the .exe as Administrator
6. Verify it starts on port 8765
7. Visit `http://localhost:8765/api/status` to confirm it's running

## Future Updates

When you need to release a new version:

1. Update version in `package.json`
2. Build: `pnpm build:printer-service`
3. Commit changes
4. Create new release with new tag (e.g., `v1.0.1`)
5. Upload new .exe file

If you use the `/releases/latest/download/` URL, users will automatically get the newest version!

## Troubleshooting

### "404 Not Found" when downloading
- Check your GitHub username is correct in the URLs
- Verify the release was published (not draft)
- Make sure the .exe file was uploaded to the release

### Build fails
- Run `cd packages/printer-service && pnpm install` first
- Make sure `pkg` is installed: `pnpm add -D pkg`

### Can't push to GitHub
- Make sure you replaced `YOUR_USERNAME` with your actual GitHub username
- Check you have permissions to push to the repository
- Try using a personal access token if password doesn't work
