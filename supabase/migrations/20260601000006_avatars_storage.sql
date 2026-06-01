-- ─────────────────────────────────────────────────────────────
-- Avatars Storage Bucket
-- Creates a public `avatars` bucket and RLS policies so each
-- authenticated user can only manage their own folder.
-- Files are publicly readable via the stable public URL.
-- ─────────────────────────────────────────────────────────────

-- Create the bucket if it doesn't already exist.
-- public = true so getPublicUrl() works without signed URLs.
-- 5 MB file size limit; only common image types allowed.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Anyone (including unauthenticated requests) can read avatars.
-- This lets avatar URLs embedded in other users' views resolve.
CREATE POLICY "avatars_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Authenticated users can upload a file inside their own folder.
-- Path convention: <user_id>/avatar.<ext>
-- (storage.foldername(name))[1] extracts the first path segment.
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can overwrite (upsert) their own avatar.
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated users can delete their own avatar.
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
