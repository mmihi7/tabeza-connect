-- Enable Realtime for print_jobs table
-- This ensures real-time subscriptions work for Captain's Orders

-- Enable realtime publication for print_jobs table
ALTER PUBLICATION supabase_realtime ADD TABLE print_jobs;

-- Verify the table is in the publication
-- Run this query to check:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'print_jobs';

-- Note: If you get an error that the table is already in the publication, that's fine!
-- It means realtime is already enabled.
