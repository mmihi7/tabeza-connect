-- Fix print_jobs status constraint to include 'parsed' and 'pending'
-- The relay API uses these statuses but they're missing from the constraint

-- Drop the old constraint
ALTER TABLE print_jobs DROP CONSTRAINT IF EXISTS print_jobs_status_check;

-- Add the new constraint with all status values
ALTER TABLE print_jobs ADD CONSTRAINT print_jobs_status_check 
  CHECK (status IN ('received', 'processed', 'parsed', 'pending', 'error', 'no_match'));

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Status constraint updated!';
  RAISE NOTICE '📋 Allowed statuses: received, processed, parsed, pending, error, no_match';
END $$;
