-- Fix Trigger to Use Legacy Anon Key (JWT-based)
-- Edge Functions require JWT-based anon keys, not publishable keys

-- STEP 1: Get your legacy anon key from Supabase Dashboard
-- Go to: Project Settings → API → Legacy anon, service_role API keys
-- Click "Copy" on the "anon" key (marked as "public")
-- It will be a long JWT token starting with "eyJ..."

-- STEP 2: Replace 'YOUR-LEGACY-ANON-KEY-HERE' below with the actual anon key

CREATE OR REPLACE FUNCTION trigger_receipt_parsing()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT := 'https://bkaigyrrzsqbfscyznzw.supabase.co/functions/v1/parse-receipt';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYWlneXJyenNxYmZzY3l6bnp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNjQxNjIsImV4cCI6MjA4MTY0MDE2Mn0.9TRx4tjxTVh-ASDtjBdtWqB5TEZbz_OukzKXx79Ru_s';  -- REPLACE with legacy anon JWT key
  request_id BIGINT;
BEGIN
  -- Make async HTTP POST request to Edge Function using pg_net
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key,
      'apikey', anon_key
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

-- STEP 3: After updating, test with the simple test
-- The 401 error should be gone
