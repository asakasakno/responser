-- Private storage bucket for the Chrome extension ZIP
INSERT INTO storage.buckets (id, name, public)
VALUES ('extension-downloads', 'extension-downloads', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- No public policies; access only via service role (edge function)
