# Shared Code Synchronization

## Source of Truth

The **tabeza-staff** project is the primary source for all shared packages.

**This project (tabeza-connect) may use some shared packages from tabeza-staff.**

## Shared Packages

tabeza-connect is a standalone Electron application and may only need specific packages:

- `@tabeza/receipt-schema` - Receipt data structures and validation
- `@tabeza/printer-service` - Printer integration utilities

Other packages from the Tabeza ecosystem:
- `@tabeza/shared` - Common types, utilities, and business logic
- `@tabeza/tax-rules` - Tax calculation rules and utilities
- `@tabeza/validation` - Input validation and sanitization
- `@tabeza/database` - Database schemas and types
- `@tabeza/code-guardrails` - Change management and validation tools

## Package Location

In tabeza-connect, shared packages would be located in: `lib/`

In tabeza-staff (source), packages are located in: `lib/packages/`

## Syncing Changes

### To sync packages from tabeza-staff:

```bash
# In tabeza-connect directory
node dev-tools/scripts/sync-shared-packages.js ../tabeza-staff
pnpm install
```

**Note**: The sync script is configured to only sync packages that tabeza-connect actually uses. Edit `dev-tools/scripts/sync-shared-packages.js` to add or remove packages as needed.

### After syncing:

1. **Test the application**
   ```bash
   # Test print job capture and processing
   ```

2. **Build the application**
   ```bash
   # Run your build scripts
   ```

3. **Commit the synced changes**
   ```bash
   git add lib/
   git commit -m "Sync shared packages from tabeza-staff"
   ```

## Making Changes to Shared Code

**DO NOT edit shared packages directly in tabeza-connect.**

Instead, follow this workflow:

1. **Switch to tabeza-staff**
   ```bash
   cd ../tabeza-staff
   ```

2. **Make changes in tabeza-staff**
   ```bash
   # Edit files in lib/packages/
   ```

3. **Test in tabeza-staff**
   ```bash
   pnpm type-check
   pnpm build
   ```

4. **Sync to tabeza-connect**
   ```bash
   cd ../tabeza-connect
   node dev-tools/scripts/sync-shared-packages.js ../tabeza-staff
   pnpm install
   ```

5. **Test in tabeza-connect**

6. **Commit in both projects**

## Important Notes

- **tabeza-connect is primarily standalone** - it may not need all shared packages
- **Only sync packages you actually use** - edit the sync script to customize
- **Never edit shared packages in tabeza-connect** - changes will be overwritten
- **Always sync from tabeza-staff** - it is the single source of truth

## Customizing the Sync Script

Edit `dev-tools/scripts/sync-shared-packages.js` to change which packages are synced:

```javascript
const packages = [
  'receipt-schema',
  'printer-service',
  // Add other packages as needed
];
```

## Troubleshooting

### Sync script fails with "not found" errors
- Verify the source project path is correct: `../tabeza-staff`
- Ensure tabeza-staff exists and has packages in `lib/packages/`

### Build fails after syncing
- Verify you only synced packages that tabeza-connect actually needs
- Check that package dependencies are properly configured

## Alternative Strategies (Future Consideration)

If manual synchronization becomes too complex, see tabeza-staff/SHARED_CODE_SYNC.md for alternative strategies including:
- Git Submodules
- Private npm Registry
- Monorepo with Turborepo
