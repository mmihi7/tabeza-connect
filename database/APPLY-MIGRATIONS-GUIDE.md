# Database Migrations Guide

This guide explains how to apply the necessary database migrations for the Tabeza Printer Service.

## Required Migrations

### 1. Venue Authority Modes Migration
**File:** `database/add-venue-authority-modes.sql`

This migration adds the venue mode and authority mode columns to support Basic and Venue modes.

### 2. Printer Relay Tables Migration
**File:** `database/add-printer-relay-tables.sql`

This migration creates the tables needed for the virtual printer driver system.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the contents of the migration file
5. Paste into the SQL editor
6. Click **Run** to execute

Repeat for each migration file.

### Option 2: Supabase CLI

If you have the Supabase CLI installed:

```bash
# Apply venue authority migration
supabase db execute --file database/add-venue-authority-modes.sql

# Apply printer relay tables migration
supabase db execute --file database/add-printer-relay-tables.sql
```

### Option 3: psql Command Line

If you have direct database access:

```bash
# Connect to your database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Apply migrations
\i database/add-venue-authority-modes.sql
\i database/add-printer-relay-tables.sql
```

## Verification

After applying the migrations, verify they were successful:

### Check Venue Authority Columns

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bars' 
AND column_name IN ('venue_mode', 'authority_mode', 'printer_required', 'onboarding_completed');
```

Expected result: 4 rows showing these columns exist.

### Check Printer Tables

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('print_jobs', 'digital_receipts');
```

Expected result: 2 rows showing both tables exist.

### Check Print Job Stats View

```sql
SELECT * FROM print_job_stats LIMIT 1;
```

Should return successfully (even if empty).

## Troubleshooting

### Migration Already Applied

If you see errors like "column already exists" or "table already exists", the migration may have been partially applied. You can:

1. Check which parts are missing
2. Comment out the parts that already exist
3. Run only the missing parts

### Permission Errors

If you see permission errors:

1. Make sure you're using the `postgres` role or a role with sufficient privileges
2. Check your Supabase project settings for the correct connection string
3. Verify your database password is correct

### RLS Policy Errors

If Row Level Security (RLS) policies fail:

1. Check if the referenced tables exist
2. Verify the `auth.uid()` function is available
3. Adjust policies based on your authentication setup

## Migration Order

Apply migrations in this order:

1. `add-venue-authority-modes.sql` - Core venue configuration
2. `add-printer-relay-tables.sql` - Printer service tables

## Rollback

If you need to rollback the printer relay tables migration:

```sql
-- Drop tables
DROP TABLE IF EXISTS digital_receipts CASCADE;
DROP TABLE IF EXISTS print_jobs CASCADE;

-- Drop view
DROP VIEW IF EXISTS print_job_stats CASCADE;

-- Drop function
DROP FUNCTION IF EXISTS update_receipt_viewed_at() CASCADE;
```

For venue authority migration rollback, see the migration file comments.

## Support

If you encounter issues:

1. Check the Supabase logs in your dashboard
2. Verify your database connection
3. Contact support@tabeza.co.ke with error details
