-- This migration is handled via tools, but for completeness and future stability:
-- Actually the user asked for 'post-images' bucket.
-- Let's ensure it exists and has policies.
-- However, I should use the storage tools first to check or create.
-- Migration for table schema or policies if needed.

-- The storage_create_bucket tool is preferred.
SELECT 1;
