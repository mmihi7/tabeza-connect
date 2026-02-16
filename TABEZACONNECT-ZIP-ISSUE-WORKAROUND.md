# TabezaConnect ZIP Creation Issue - Workaround

## Problem
The ZIP creation step keeps crashing regardless of the library used (PowerShell Compress-Archive, archiver, adm-zip). This is likely due to:
- The nodejs-bundle directory is very large (~50+ MB with thousands of files)
- Memory constraints when processing all files at once
- Windows file handle limitations

## Current Build Status
✅ Steps 1-5 complete successfully:
1. Node.js download and extraction
2. Service files preparation
3. Dependencies installation
4. Installer scripts copying
5. Installer batch file and README creation

❌ Step 6 fails: ZIP package creation

## Workaround Options

### Option 1: Distribute as Folder (Recommended for Now)
Skip the ZIP step and distribute the `nodejs-bundle` folder directly.

**Steps:**
1. Complete the build up to step 5:
   ```cmd
   cd c:\Projects\TabezaConnect
   npm run download:nodejs
   node src/installer/build-installer.js
   ```
   
2. When it crashes at ZIP creation, press any key to continue

3. The installer is ready in: `src/installer/nodejs-bundle/`

4. To distribute:
   - Copy the entire `nodejs-bundle` folder to a USB drive or network share
   - Or use Windows Explorer to manually ZIP it (right-click > Send to > Compressed folder)
   - Or use 7-Zip or WinRAR which handle large directories better

### Option 2: Manual ZIP with 7-Zip
If you have 7-Zip installed:

```cmd
cd c:\Projects\TabezaConnect\src\installer
"C:\Program Files\7-Zip\7z.exe" a -tzip ..\..\dist\TabezaConnect-Setup-v1.0.0.zip nodejs-bundle\*
```

### Option 3: Manual ZIP with Windows Explorer
1. Navigate to `c:\Projects\TabezaConnect\src\installer\`
2. Right-click the `nodejs-bundle` folder
3. Select "Send to" > "Compressed (zipped) folder"
4. Rename to `TabezaConnect-Setup-v1.0.0.zip`
5. Move to `c:\Projects\TabezaConnect\dist\`

### Option 4: Use PowerShell with Better Settings
Create a PowerShell script that handles large files better:

```powershell
# Run this in PowerShell (not CMD)
cd c:\Projects\TabezaConnect\src\installer

# Method 1: Using .NET compression (more reliable)
Add-Type -Assembly System.IO.Compression.FileSystem
$source = "c:\Projects\TabezaConnect\src\installer\nodejs-bundle"
$destination = "c:\Projects\TabezaConnect\dist\TabezaConnect-Setup-v1.0.0.zip"
[System.IO.Compression.ZipFile]::CreateFromDirectory($source, $destination)
```

## Testing the Installer

Once you have the ZIP (or folder), test it:

1. **Extract** (if zipped) to a temporary location
2. **Right-click** `install.bat` and select "Run as administrator"
3. **Follow prompts** to complete installation
4. **Verify** service starts at http://localhost:8765/api/status

## Next Steps

For now, I recommend:
1. Use Option 1 (distribute as folder) or Option 3 (manual ZIP with Explorer)
2. Test the installer on a clean Windows machine
3. Once confirmed working, we can investigate a more permanent ZIP solution

## Alternative: GitHub Releases
Once you push to GitHub and create a release, GitHub Actions can handle the ZIP creation on their servers (which don't have the same limitations).

The workflow in `.github/workflows/build-installer.yml` will:
1. Build the installer
2. Create the ZIP
3. Attach it to the release

This is actually the recommended approach for distribution.

## Files Ready for Distribution

The installer folder contains:
- `nodejs/` - Bundled Node.js runtime (~28 MB)
- `service/` - Tabeza Connect service files
- `scripts/` - PowerShell installation scripts
- `install.bat` - Main installer
- `README.txt` - Installation instructions

**Total size:** ~35-40 MB

---

**Status:** Build partially complete, manual ZIP required  
**Recommended:** Use Windows Explorer or 7-Zip to create ZIP manually  
**Alternative:** Distribute as folder or use GitHub Actions  
**Created:** 2026-02-12
