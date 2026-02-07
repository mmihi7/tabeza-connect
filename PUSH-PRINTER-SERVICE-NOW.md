# 🚀 Push Printer Service to GitHub - DO THIS NOW

## The Problem

The GitHub repo `tabeza-printer-service` is empty. That's why you can't create a release.

## The Solution (5 Commands)

Open Command Prompt and run these commands **one by one**:

### 1. Go to printer service folder
```cmd
cd C:\Projects\Tabz\packages\printer-service
```

### 2. Initialize git
```cmd
git init
```

### 3. Add GitHub remote
```cmd
git remote add origin https://github.com/billoapp/tabeza-printer-service.git
```

If you get "remote origin already exists", run this instead:
```cmd
git remote set-url origin https://github.com/billoapp/tabeza-printer-service.git
```

### 4. Add and commit files
```cmd
git add .
git commit -m "Initial commit: Tabeza Printer Service v1.0.0"
```

### 5. Push to GitHub
```cmd
git branch -M main
git push -u origin main --force
```

## After Pushing

Once the push succeeds, you'll see:
```
✅ Branch 'main' set up to track remote branch 'main' from 'origin'
```

Then you can create the release:

1. **Go to**: https://github.com/billoapp/tabeza-printer-service/releases/new

2. **Fill in**:
   - **Tag**: `v1.0.0`
   - **Target**: `main` (this will now work!)
   - **Title**: `Tabeza Printer Service v1.0.0`
   - **Description**: Copy from `packages/printer-service/RELEASE-NOW.md`

3. **Upload**: `C:\Projects\Tabz\packages\printer-service\dist\tabeza-printer-service.exe`

4. **Click**: "Publish release"

## Then Update URLs

After publishing the release:

```cmd
cd C:\Projects\Tabz
node packages\printer-service\update-download-urls.js billoapp
git add .
git commit -m "Update printer service download URLs to v1.0.0"
git push
```

## Troubleshooting

### Error: "fatal: not a git repository"
- Make sure you're in `C:\Projects\Tabz\packages\printer-service`
- Run `git init` again

### Error: "Permission denied"
- Run: `gh auth login`
- Follow the prompts to authenticate

### Error: "failed to push"
- Use `--force` flag: `git push -u origin main --force`

---

**Bottom Line**: Run the 5 commands above to push code to GitHub, then create the release on the website.
