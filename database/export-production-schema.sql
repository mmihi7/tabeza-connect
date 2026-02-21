-- Export Production Schema Script
-- This script will help you export the complete schema from your production Supabase database
-- Run this in your production Supabase SQL Editor and save the output

-- ============================================================================
-- STEP 1: Export all table definitions
-- ============================================================================

SELECT 
    'CREATE TABLE ' || schemaname || '.' || tablename || ' (' || 
    string_agg(
        column_name || ' ' || data_type || 
        CASE WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')' 
            ELSE '' 
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL 
            THEN ' DEFAULT ' || column_default 
            ELSE '' 
        END,
        ', '
    ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================================
-- STEP 2: Export all indexes
-- ============================================================================

SELECT indexdef || ';'
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- ============================================================================
-- STEP 3: Export all foreign keys
-- ============================================================================

SELECT
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name || 
    ' ADD CONSTRAINT ' || tc.constraint_name || 
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES ' || ccu.table_schema || '.' || ccu.table_name || 
    ' (' || ccu.column_name || ')' ||
    CASE 
        WHEN rc.delete_rule = 'CASCADE' THEN ' ON DELETE CASCADE'
        WHEN rc.delete_rule = 'SET NULL' THEN ' ON DELETE SET NULL'
        ELSE ''
    END || ';'
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- ============================================================================
-- STEP 4: Export all enums
-- ============================================================================

SELECT 
    'CREATE TYPE ' || n.nspname || '.' || t.typname || ' AS ENUM (' ||
    string_agg('''' || e.enumlabel || '''', ', ' ORDER BY e.enumsortorder) || 
    ');'
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_namespace n ON t.typnamespace = n.oid
WHERE n.nspname = 'public'
GROUP BY n.nspname, t.typname
ORDER BY t.typname;

-- ============================================================================
-- STEP 5: Export all functions
-- ============================================================================

SELECT 
    pg_get_functiondef(p.oid) || ';'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ============================================================================
-- STEP 6: Export all triggers
-- ============================================================================

SELECT 
    'CREATE TRIGGER ' || trigger_name || 
    ' ' || action_timing || ' ' || event_manipulation ||
    ' ON ' || event_object_schema || '.' || event_object_table ||
    ' FOR EACH ' || action_orientation ||
    ' EXECUTE FUNCTION ' || action_statement || ';'
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
