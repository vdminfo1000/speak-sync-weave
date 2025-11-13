-- Clean up duplicate and weak storage policies

-- Drop the weaker duplicate policies
DROP POLICY IF EXISTS "Users can read files from their chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their chats" ON storage.objects;

-- The stricter policies remain:
-- "Users can read chat files" - uses exact path matching with '/' || objects.name
-- "Users can upload files to their chats" - maintains proper auth checks