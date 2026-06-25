-- Migration v10 : bucket session-photos + policies storage
-- À exécuter dans Supabase > SQL Editor

-- Créer le bucket session-photos (public, 10 MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-photos',
  'session-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (pour afficher les photos)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Public read session-photos'
  ) THEN
    CREATE POLICY "Public read session-photos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'session-photos');
  END IF;
END $$;

-- Upload : chaque utilisateur dans son propre dossier (uid/)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Auth upload session-photos'
  ) THEN
    CREATE POLICY "Auth upload session-photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'session-photos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

-- Suppression : uniquement ses propres fichiers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND policyname = 'Auth delete own session-photos'
  ) THEN
    CREATE POLICY "Auth delete own session-photos"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'session-photos'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;
