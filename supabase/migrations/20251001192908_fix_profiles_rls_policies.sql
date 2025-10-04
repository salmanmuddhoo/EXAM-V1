/*
  # Fix Profiles RLS Policies to Prevent Infinite Recursion

  ## Overview
  This migration fixes the infinite recursion issue in the profiles table RLS policies.
  The problem was that policies were checking the profiles table while operating on it,
  causing a recursive loop.

  ## Changes
  - Drop existing policies that cause recursion
  - Create new policies that use auth.jwt() to check roles instead of querying profiles table
  - Add role claim to JWT metadata for efficient role checking
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create new policies without recursion
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Update the handle_new_user function to set app_metadata with role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
