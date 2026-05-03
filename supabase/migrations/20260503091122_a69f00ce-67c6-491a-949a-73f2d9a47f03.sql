-- Explicitly deny direct anon/authenticated access to extension-downloads bucket.
-- Service role bypasses RLS, so the download-extension edge function continues to work via signed URLs.

DROP POLICY IF EXISTS "extension_downloads_no_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "extension_downloads_no_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "extension_downloads_no_anon_write" ON storage.objects;
DROP POLICY IF EXISTS "extension_downloads_no_auth_write" ON storage.objects;
DROP POLICY IF EXISTS "extension_downloads_no_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "extension_downloads_no_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "extension_downloads_no_anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "extension_downloads_no_auth_delete" ON storage.objects;

-- Restrictive policies that always evaluate FALSE for anon/authenticated roles on this bucket.
CREATE POLICY "extension_downloads_no_anon_select"
ON storage.objects AS RESTRICTIVE FOR SELECT TO anon
USING (bucket_id <> 'extension-downloads');

CREATE POLICY "extension_downloads_no_auth_select"
ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
USING (bucket_id <> 'extension-downloads');

CREATE POLICY "extension_downloads_no_anon_write"
ON storage.objects AS RESTRICTIVE FOR INSERT TO anon
WITH CHECK (bucket_id <> 'extension-downloads');

CREATE POLICY "extension_downloads_no_auth_write"
ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (bucket_id <> 'extension-downloads');

CREATE POLICY "extension_downloads_no_anon_update"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon
USING (bucket_id <> 'extension-downloads');

CREATE POLICY "extension_downloads_no_auth_update"
ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
USING (bucket_id <> 'extension-downloads');

CREATE POLICY "extension_downloads_no_anon_delete"
ON storage.objects AS RESTRICTIVE FOR DELETE TO anon
USING (bucket_id <> 'extension-downloads');

CREATE POLICY "extension_downloads_no_auth_delete"
ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
USING (bucket_id <> 'extension-downloads');