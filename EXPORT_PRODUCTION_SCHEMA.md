# Export Production Schema from Supabase

This guide shows you how to export your complete production database schema to use locally.

## Method 1: Using Supabase Dashboard (Easiest)

1. Go to your Supabase project: https://supabase.com/dashboard/project/bkaigyrrzsqbfscyznzw
2. Click on **Database** in the left sidebar
3. Click on **Backups** tab
4. Click **Download** on your latest backup
5. Extract the SQL file from the downloaded archive
6. Save it as `Tabz/database/production-schema.sql`

## Method 2: Using pg_dump (Most Complete)

### Step 1: Get your database connection string

From your Supabase dashboard:
1. Go to **Settings** > **Database**
2. Copy the **Connection string** (URI format)
3. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.bkaigyrrzsqbfscyznzw.supabase.co:5432/postgres`

### Step 2: Export schema only (no data)

```bash
# Export schema only (structure, no data)
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.bkaigyrrzsqbfscyznzw.supabase.co:5432/postgres" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  --file=database/production-schema.sql

# Or if you want schema + data for specific tables (like bars for testing)
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.bkaigyrrzsqbfscyznzw.supabase.co:5432/postgres" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file=database/production-full.sql
```

### Step 3: Clean up the exported file (optional)

The exported file might have some Supabase-specific things. You can clean it up:

```bash
# Remove Supabase internal schemas (keep only public schema)
# Edit the file and remove any references to:
# - auth schema
# - storage schema
# - extensions schema
# - realtime schema
```

## Method 3: Using Supabase CLI (If you have it installed)

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref bkaigyrrzsqbfscyznzw

# Pull the schema
supabase db pull

# This creates migration files in supabase/migrations/
```

## Method 4: Manual SQL Export (Fallback)

If you don't have `pg_dump`, run this in your Supabase SQL Editor and copy the output:

```sql
-- Get all CREATE TABLE statements
SELECT 
    'CREATE TABLE ' || table_schema || '.' || table_name || ' (' || E'\n  ' ||
    string_agg(
        column_name || ' ' || 
        CASE 
            WHEN data_type = 'USER-DEFINED' THEN udt_name
            WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE data_type 
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ',' || E'\n  '
        ORDER BY ordinal_position
    ) || E'\n);' || E'\n'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_schema, table_name
ORDER BY table_name;
```

## After Export

Once you have `production-schema.sql`, apply it to your local database:

```bash
# Apply to local Docker database
docker exec -i tabeza-psql-cli psql < database/production-schema.sql
```

## Verify the Import

```bash
# Check tables were created
docker exec tabeza-psql-cli psql -c "\dt"

# Check specific tables
docker exec tabeza-psql-cli psql -c "SELECT COUNT(*) FROM bars;"
docker exec tabeza-psql-cli psql -c "SELECT COUNT(*) FROM printer_drivers;"
```

## Recommended Approach

**For your case, I recommend Method 1 (Supabase Dashboard backup)** because:
- It's the easiest
- Includes everything (tables, functions, triggers, policies)
- Already formatted correctly
- No need to install additional tools

Just download the backup, extract it, and apply it to your local database.
