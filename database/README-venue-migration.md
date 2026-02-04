# Venue Migration Guide

This guide explains how to migrate existing venues to the new onboarding system that was implemented to fix the onboarding flow issue.

## Overview

The migration addresses venues that were created before the mandatory venue mode selection was implemented. These venues need to be configured with default settings to ensure they can continue operating normally.

## Migration Options

### Option 1: SQL Script (Recommended for Production)

Use the comprehensive SQL migration script that includes backup, rollback, and validation:

```bash
# Run the migration script directly in your database
psql -d your_database -f database/migrate-existing-venues-onboarding.sql
```

**Features:**
- Creates backup table for rollback
- Comprehensive error handling
- Validation of migration results
- Audit logging
- Rollback script included

### Option 2: Node.js Script (Recommended for Development)

Use the interactive Node.js script for safer migration with preview:

```bash
# Preview what will be migrated (dry run)
node dev-tools/scripts/migrate-existing-venues.js --dry-run

# Run the migration with confirmation prompts
node dev-tools/scripts/migrate-existing-venues.js

# Run the migration without prompts (use with caution)
node dev-tools/scripts/migrate-existing-venues.js --force
```

**Features:**
- Interactive preview of changes
- Confirmation prompts
- Real-time validation
- Detailed error reporting
- Statistics and verification

### Option 3: Database Function (Recommended for API Integration)

Use the database function for programmatic migration:

```sql
-- Run the migration function
SELECT * FROM migrate_existing_venues_to_onboarding();

-- Check the results
SELECT 
  migration_id,
  venues_migrated,
  migration_status,
  error_message
FROM migrate_existing_venues_to_onboarding();
```

**Features:**
- Atomic transaction
- Return status and error information
- Audit logging
- Can be called from application code

## Default Configuration

All migrated venues will be set to:

| Field | Value | Description |
|-------|-------|-------------|
| `venue_mode` | `'venue'` | Full service platform mode |
| `authority_mode` | `'tabeza'` | Tabeza handles order authority |
| `pos_integration_enabled` | `false` | No POS integration |
| `printer_required` | `false` | Thermal printer not required |
| `onboarding_completed` | `true` | Onboarding marked as complete |
| `authority_configured_at` | `now()` | Timestamp of configuration |
| `mode_last_changed_at` | `now()` | Timestamp of last change |

This configuration represents the current behavior of existing venues and ensures no disruption to operations.

## Pre-Migration Checklist

1. **Backup Database**: Always create a full database backup before migration
2. **Check Environment**: Ensure you're running against the correct database
3. **Verify Credentials**: Confirm you have the necessary database permissions
4. **Test in Staging**: Run the migration in a staging environment first
5. **Plan Downtime**: Consider brief maintenance window for production migration

## Post-Migration Verification

After running the migration, verify the results:

```sql
-- Check that all venues have completed onboarding
SELECT COUNT(*) as incomplete_venues
FROM bars 
WHERE onboarding_completed IS NULL OR onboarding_completed = false;
-- Should return 0

-- Check configuration distribution
SELECT 
  venue_mode,
  authority_mode,
  COUNT(*) as venue_count
FROM bars 
WHERE onboarding_completed = true
GROUP BY venue_mode, authority_mode;

-- Check for any invalid configurations
SELECT id, name, venue_mode, authority_mode, pos_integration_enabled, printer_required
FROM bars 
WHERE 
  (venue_mode = 'basic' AND authority_mode != 'pos') OR
  (venue_mode = 'basic' AND printer_required != true) OR
  (authority_mode = 'pos' AND pos_integration_enabled != true) OR
  (authority_mode = 'tabeza' AND pos_integration_enabled != false);
-- Should return no rows
```

## Rollback Procedure

If you need to rollback the migration:

### For SQL Script Migration:
```sql
-- Use the rollback script included in migrate-existing-venues-onboarding.sql
-- Uncomment and run the rollback section
```

### For Node.js Script Migration:
```bash
# The script creates audit logs that can help identify what was changed
# Manual rollback may be required based on audit log data
```

### For Function Migration:
```sql
-- Check audit logs for migration details
SELECT * FROM audit_logs 
WHERE action LIKE 'migration_function_%' 
ORDER BY created_at DESC;

-- Manual rollback based on audit log data may be required
```

## Troubleshooting

### Common Issues

**Issue: "No venues need migration"**
- All venues already have `onboarding_completed = true`
- This is normal if migration was already run

**Issue: "Migration validation failed"**
- Some venues have invalid configurations
- Check the specific error message for details
- May require manual intervention

**Issue: "Permission denied"**
- Database user lacks necessary permissions
- Ensure user has UPDATE permissions on `bars` table
- Ensure user can INSERT into `audit_logs` table

**Issue: "Function does not exist"**
- Run the function creation script first: `database/functions/migrate_existing_venues.sql`

### Getting Help

1. Check the `audit_logs` table for detailed migration information
2. Review the backup table created during migration
3. Check application logs for any related errors
4. Contact the development team with specific error messages

## Environment Variables Required

For the Node.js script:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_service_role_key
```

## Security Considerations

- The migration requires elevated database permissions
- Service role keys should be handled securely
- Consider running during maintenance windows
- Monitor for any unusual activity after migration

## Files Included

- `migrate-existing-venues-onboarding.sql` - Complete SQL migration script
- `migrate-existing-venues.js` - Interactive Node.js migration tool
- `functions/migrate_existing_venues.sql` - Database function for migration
- `README-venue-migration.md` - This documentation file

## Support

For questions or issues with the migration:
1. Review this documentation thoroughly
2. Check the audit logs for detailed information
3. Test in a staging environment first
4. Contact the development team with specific error details