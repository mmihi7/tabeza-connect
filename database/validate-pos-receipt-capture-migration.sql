-- Validation Script: POS Receipt Capture Migration
-- Run this after applying migrations to verify everything is correct
-- Compatible with Supabase SQL Editor

-- ============================================================================
-- VALIDATION CHECKS
-- ============================================================================

-- Check 1: Verify enum type created
SELECT 
  '1. Enum Type' AS check_category,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_status')
    THEN '✓ receipt_status enum exists'
    ELSE '✗ receipt_status enum MISSING'
  END AS status;

-- Check 2: Verify core tables created
SELECT 
  '2. Core Tables' AS check_category,
  expected.table_name,
  CASE 
    WHEN t.table_name IS NOT NULL THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END AS status
FROM (
  VALUES 
    ('raw_pos_receipts'),
    ('pos_receipts'),
    ('pos_receipt_items'),
    ('tab_pos_receipts')
) AS expected(table_name)
LEFT JOIN information_schema.tables t 
  ON t.table_name = expected.table_name 
  AND t.table_schema = 'public'
ORDER BY expected.table_name;

-- Check 3: Verify template tables created
SELECT 
  '3. Template Tables' AS check_category,
  expected.table_name,
  CASE 
    WHEN t.table_name IS NOT NULL THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END AS status
FROM (
  VALUES 
    ('receipt_parsing_templates'),
    ('template_learning_events'),
    ('pos_parse_failures')
) AS expected(table_name)
LEFT JOIN information_schema.tables t 
  ON t.table_name = expected.table_name 
  AND t.table_schema = 'public'
ORDER BY expected.table_name;

-- Check 4: Verify key indexes created
SELECT 
  '4. Indexes (Sample)' AS check_category,
  indexname,
  tablename,
  '✓ EXISTS' AS status
FROM pg_indexes 
WHERE tablename IN (
  'raw_pos_receipts', 
  'pos_receipts', 
  'receipt_parsing_templates'
)
ORDER BY tablename, indexname
LIMIT 15;

-- Check 5: Verify foreign key constraints
SELECT 
  '5. Foreign Keys' AS check_category,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  '✓ EXISTS' AS status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN (
    'raw_pos_receipts',
    'pos_receipts',
    'pos_receipt_items',
    'tab_pos_receipts',
    'receipt_parsing_templates',
    'template_learning_events',
    'pos_parse_failures'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- Check 6: Verify RLS enabled
SELECT 
  '6. Row Level Security' AS check_category,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✓ RLS ENABLED'
    ELSE '✗ RLS DISABLED'
  END AS status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'raw_pos_receipts',
    'pos_receipts',
    'pos_receipt_items',
    'tab_pos_receipts',
    'receipt_parsing_templates',
    'template_learning_events',
    'pos_parse_failures'
  )
ORDER BY tablename;

-- Check 7: Verify helper functions created
SELECT 
  '7. Helper Functions' AS check_category,
  proname AS function_name,
  '✓ EXISTS' AS status
FROM pg_proc 
WHERE proname IN (
  'get_active_template',
  'count_recent_parse_failures',
  'get_template_history',
  'deactivate_old_templates'
)
ORDER BY proname;

-- Check 8: Verify triggers created
SELECT 
  '8. Triggers' AS check_category,
  trigger_name,
  event_object_table AS table_name,
  '✓ EXISTS' AS status
FROM information_schema.triggers 
WHERE trigger_name = 'trigger_deactivate_old_templates'
  AND event_object_schema = 'public';

-- Check 9: Verify check constraints
SELECT 
  '9. Check Constraints' AS check_category,
  tc.table_name,
  tc.constraint_name,
  '✓ EXISTS' AS status
FROM information_schema.table_constraints AS tc
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_name IN (
    'pos_receipts',
    'pos_receipt_items',
    'receipt_parsing_templates',
    'pos_parse_failures'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- Check 10: Verify realtime publication (if using Supabase Realtime)
SELECT 
  '10. Realtime Publication' AS check_category,
  tablename,
  '✓ IN PUBLICATION' AS status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
  AND tablename IN ('pos_receipts', 'pos_receipt_items', 'tab_pos_receipts');

-- ============================================================================
-- SUMMARY
-- ============================================================================

SELECT 
  'SUMMARY' AS check_category,
  'If all checks show ✓, migration was successful!' AS message;
