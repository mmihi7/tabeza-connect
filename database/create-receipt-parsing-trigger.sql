-- Migration: Create Database Trigger to Invoke Edge Function for Receipt Parsing
-- Purpose: Automatically trigger receipt parsing when raw receipt is inserted
-- Requirements: 7.4, 7.5
-- Date: 2024
-- Task: 3.3 Create database trigger to invoke Edge Function

-- ============================================================================
-- ENABLE PG_NET EXTENSION
-- ============================================================================
-- pg_net is a Supabase extension for making HTTP requests from PostgreSQL
-- It's pre-installed in Supabase but needs to be enabled

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================================
-- CREATE TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_receipt_parsing()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://bkaigyrrzsqbfscyznzw.supabase.co/functions/v1/parse-receipt';
  publishable_key TEXT := 'sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2';
  request_id BIGINT;
BEGIN
  -- Make async HTTP POST request to Edge Function using pg_net
  -- This is non-blocking and returns immediately
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || publishable_key
    ),
    body := jsonb_build_object(
      'receipt_id', NEW.id
    )
  ) INTO request_id;

  -- Log the request for debugging (optional)
  RAISE NOTICE 'Receipt parsing triggered for receipt_id: %, request_id: %', NEW.id, request_id;

  -- Return NEW to allow the insert to proceed
  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    -- Receipt will be captured even if parsing trigger fails
    RAISE WARNING 'Failed to trigger receipt parsing for receipt_id: %. Error: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the function
COMMENT ON FUNCTION trigger_receipt_parsing() IS 
  'Triggers asynchronous receipt parsing via Edge Function when raw receipt is inserted. Uses pg_net for non-blocking HTTP requests.';

-- ============================================================================
-- CREATE TRIGGER
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_parse_receipt_on_insert ON raw_pos_receipts;

-- Create trigger that fires AFTER INSERT on raw_pos_receipts
CREATE TRIGGER trigger_parse_receipt_on_insert
  AFTER INSERT ON raw_pos_receipts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_receipt_parsing();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_parse_receipt_on_insert ON raw_pos_receipts IS 
  'Automatically invokes parse-receipt Edge Function when a new raw receipt is inserted. Parsing happens asynchronously without blocking ingestion.';

-- ============================================================================
-- CONFIGURATION (Hardcoded from .env.local)
-- ============================================================================

-- Note: These values are hardcoded because Supabase doesn't allow setting custom
-- database parameters. Values are from your .env.local file:
-- - NEXT_PUBLIC_SUPABASE_URL: https://bkaigyrrzsqbfscyznzw.supabase.co
-- - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_-RItbICa9f_G0IpfwZ3vig_FLw0-FR2
--
-- If these values change, update the trigger function below.

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify pg_net extension is enabled
-- SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- Verify trigger exists
-- SELECT * FROM pg_trigger WHERE tgname = 'trigger_parse_receipt_on_insert';

-- Verify function exists
-- SELECT * FROM pg_proc WHERE proname = 'trigger_receipt_parsing';

-- Test trigger by inserting a test receipt (will invoke Edge Function)
-- INSERT INTO raw_pos_receipts (bar_id, device_id, timestamp, text, metadata)
-- VALUES (
--   'your-bar-id',
--   'test-device',
--   NOW(),
--   'TEST RECEIPT\nItem 1  2  10.00  20.00\nTOTAL  KES 20.00',
--   '{"source": "test", "jobId": "test-123"}'::jsonb
-- );

-- Check pg_net request queue (to see if request was made)
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;

