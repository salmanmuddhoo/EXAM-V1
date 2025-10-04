/*
  # Create Storage Buckets for PDFs

  ## Overview
  This migration creates storage buckets for exam papers and marking schemes,
  along with appropriate access policies.

  ## Storage Buckets
  1. `exam-papers` - Stores exam paper PDFs (public read access)
  2. `marking-schemes` - Stores marking scheme PDFs (public read access)

  ## Security
  - Public read access for all users (anonymous and authenticated)
  - Admin-only write/upload access
  - Admin-only delete access
*/

-- Create storage bucket for exam papers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exam-papers',
  'exam-papers',
  true,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for marking schemes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marking-schemes',
  'marking-schemes',
  true,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for exam-papers bucket
CREATE POLICY "Anyone can view exam papers"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'exam-papers');

CREATE POLICY "Admins can upload exam papers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exam-papers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update exam papers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exam-papers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'exam-papers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete exam papers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exam-papers' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Storage policies for marking-schemes bucket
CREATE POLICY "Anyone can view marking schemes"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'marking-schemes');

CREATE POLICY "Admins can upload marking schemes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marking-schemes' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update marking schemes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'marking-schemes' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'marking-schemes' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete marking schemes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marking-schemes' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
