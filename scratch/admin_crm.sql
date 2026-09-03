-- Add user_type to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'broker';

-- Allow Admins to see their tasks (if they use standard Supabase auth, though they use custom token auth so RLS might not apply if they use service_role, wait, Admin API uses service_role key usually).
