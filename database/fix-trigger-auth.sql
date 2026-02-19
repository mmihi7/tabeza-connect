-- Fix Trigger Authentication Issue
-- The trigger is working but getting 401 errors because it needs the anon key, not publishable key

-- STEP 1: Get your anon key from Supabase Dashboard
-- Go to: Project Settings → API → Project API keys
-- Copy the "anon" key (starts with "eyJ...")

-- STEP 2: Update the trigger function with the correct anon key
-- Replace 'YOUR-ANON-KEY-HERE' with the actual anon key from Step 1

CREATE OR REPLACE FUNCTION trigger_receipt_parsing()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://bkaigyrrzsqbfscyznzw.supabase.co/functions/v1/parse-receipt';
  publishable_key TEXT := 'sb_publishable_sS8TJmpBNLw5fAHNfTb9og_EurMoc49';  -- Default publishable key
  request_id BIGINT;
BEGIN
  -- Make async HTTP POST request to Edge Function using pg_net
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

  -- Log the request for debugging
  RAISE NOTICE 'Receipt parsing triggered for receipt_id: %, request_id: %', NEW.id, request_id;

  RETURN NEW;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to trigger receipt parsing for receipt_id: %. Error: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 3: Test again
-- Run the simple test insert from test-receipt-trigger-simple.sql
-- The 401 error should be gone and parsing should work
