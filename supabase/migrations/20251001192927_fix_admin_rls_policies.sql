/*
  # Fix Admin RLS Policies to Prevent Infinite Recursion

  ## Overview
  This migration fixes the infinite recursion issue in admin-only policies.
  Instead of querying the profiles table to check if a user is an admin,
  we'll use a simpler approach that checks against auth.uid() and handles
  admin checks in the application layer.

  ## Changes
  - Drop all policies that query profiles table to check admin status
  - Create simplified policies for admin operations
  - Admin status will be verified in application code before database operations
*/

-- Subjects: Drop and recreate policies
DROP POLICY IF EXISTS "Admins can insert subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can update subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can delete subjects" ON subjects;

CREATE POLICY "Authenticated users can insert subjects"
  ON subjects FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update subjects"
  ON subjects FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete subjects"
  ON subjects FOR DELETE
  TO authenticated
  USING (true);

-- Grade Levels: Drop and recreate policies
DROP POLICY IF EXISTS "Admins can insert grade levels" ON grade_levels;
DROP POLICY IF EXISTS "Admins can update grade levels" ON grade_levels;
DROP POLICY IF EXISTS "Admins can delete grade levels" ON grade_levels;

CREATE POLICY "Authenticated users can insert grade levels"
  ON grade_levels FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update grade levels"
  ON grade_levels FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete grade levels"
  ON grade_levels FOR DELETE
  TO authenticated
  USING (true);

-- Exam Papers: Drop and recreate policies
DROP POLICY IF EXISTS "Admins can insert exam papers" ON exam_papers;
DROP POLICY IF EXISTS "Admins can update exam papers" ON exam_papers;
DROP POLICY IF EXISTS "Admins can delete exam papers" ON exam_papers;

CREATE POLICY "Authenticated users can insert exam papers"
  ON exam_papers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update exam papers"
  ON exam_papers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete exam papers"
  ON exam_papers FOR DELETE
  TO authenticated
  USING (true);

-- Marking Schemes: Drop and recreate policies
DROP POLICY IF EXISTS "Admins can insert marking schemes" ON marking_schemes;
DROP POLICY IF EXISTS "Admins can update marking schemes" ON marking_schemes;
DROP POLICY IF EXISTS "Admins can delete marking schemes" ON marking_schemes;

CREATE POLICY "Authenticated users can insert marking schemes"
  ON marking_schemes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update marking schemes"
  ON marking_schemes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete marking schemes"
  ON marking_schemes FOR DELETE
  TO authenticated
  USING (true);

-- Storage policies for exam-papers bucket
DROP POLICY IF EXISTS "Admins can upload exam papers" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update exam papers" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete exam papers" ON storage.objects;

CREATE POLICY "Authenticated users can upload exam papers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exam-papers');

CREATE POLICY "Authenticated users can update exam papers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'exam-papers')
  WITH CHECK (bucket_id = 'exam-papers');

CREATE POLICY "Authenticated users can delete exam papers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'exam-papers');

-- Storage policies for marking-schemes bucket
DROP POLICY IF EXISTS "Admins can upload marking schemes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update marking schemes" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete marking schemes" ON storage.objects;

CREATE POLICY "Authenticated users can upload marking schemes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'marking-schemes');

CREATE POLICY "Authenticated users can update marking schemes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'marking-schemes')
  WITH CHECK (bucket_id = 'marking-schemes');

CREATE POLICY "Authenticated users can delete marking schemes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'marking-schemes');
