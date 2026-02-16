# Build and Deploy Guide - Tabz Staff App

## Prerequisites
- pnpm installed
- Git configured
- Vercel account connected

## Step 1: Install Dependencies (if needed)

```bash
cd c:\Projects\Tabz
pnpm install
```

## Step 2: Build Locally (Optional - Test First)

```bash
# Build all packages
pnpm run build

# Or build specific app
pnpm run build:staff
```

## Step 3: Commit and Push to GitHub

```bash
# Add all changes
git add .

# Commit with descriptive message
git commit -m "Add complete web-based printer management with visual setup guide"

# Push to remote
git push origin main
```

## Step 4: Vercel Auto-Deploy

Vercel will automatically:
1. Detect the push to main branch
2. Build the staff app
3. Deploy to production at https://tabeza.co.ke
4. New printer management page goes live at https://tabeza.co.ke/settings/printer

## What Gets Deployed

### New Features:
- **Printer Settings Page** - Complete web-based management
  - Real-time service status
  - One-click auto-configure
  - Test print button
  - Run diagnostics button
  - Watch folder management
  - Visual POS setup guide (step-by-step)
  - Troubleshooting section
  - Live driver list

### Updated Files:
- `apps/staff/app/(dashboard)/settings/printer/page.tsx` - New printer page
- `packages/shared/lib/services/printer-driver-queries.ts` - Timeout removed
- `PRODUCTION-DEPLOYMENT-STRATEGY.md` - Deployment docs
- `.gitignore` - Clean workspace rules

## Verify Deployment

After Vercel deploys:
1. Visit https://tabeza.co.ke/settings/printer
2. Check service status detection
3. Test auto-configure button
4. Verify setup guide displays correctly
5. Test diagnostics functionality

## For Live Client Test

Client workflow:
1. Opens https://tabeza.co.ke/settings/printer
2. Sees service status (running/stopped)
3. Clicks "Auto-Configure Now" if needed
4. Clicks "Setup Guide" tab
5. Follows visual step-by-step instructions
6. Copies watch folder path with one click
7. Configures POS using the guide
8. Clicks "Send Test Print" to verify
9. ✅ Done - no terminal commands needed!
