/*
  # Create Initial Schema for Exam Study Assistant

  ## Overview
  This migration creates the foundational database structure for an AI-powered exam study assistant
  application with admin and student roles.

  ## New Tables

  ### 1. `profiles`
  Extends the built-in auth.users table with role information
  - `id` (uuid, primary key, references auth.users)
  - `email` (text)
  - `role` (text) - Either 'admin' or 'student'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `subjects`
  Stores different academic subjects (e.g., Mathematics, Physics)
  - `id` (uuid, primary key)
  - `name` (text, unique)
  - `description` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `grade_levels`
  Stores different grade/class levels (e.g., Grade 9, Grade 10)
  - `id` (uuid, primary key)
  - `name` (text, unique)
  - `display_order` (integer) - For sorting grades in order
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. `exam_papers`
  Stores exam paper metadata and file references
  - `id` (uuid, primary key)
  - `title` (text)
  - `subject_id` (uuid, foreign key to subjects)
  - `grade_level_id` (uuid, foreign key to grade_levels)
  - `pdf_url` (text) - Storage URL for the exam paper PDF
  - `pdf_path` (text) - Storage path for the exam paper PDF
  - `uploaded_by` (uuid, foreign key to profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `marking_schemes`
  Stores marking scheme PDFs linked to exam papers
  - `id` (uuid, primary key)
  - `exam_paper_id` (uuid, foreign key to exam_papers)
  - `pdf_url` (text) - Storage URL for the marking scheme PDF
  - `pdf_path` (text) - Storage path for the marking scheme PDF
  - `uploaded_by` (uuid, foreign key to profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. `chat_conversations`
  Stores chat conversation sessions for logged-in students
  - `id` (uuid, primary key)
  - `student_id` (uuid, foreign key to profiles, nullable for anonymous users)
  - `exam_paper_id` (uuid, foreign key to exam_papers)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 7. `chat_messages`
  Stores individual chat messages within conversations
  - `id` (uuid, primary key)
  - `conversation_id` (uuid, foreign key to chat_conversations)
  - `role` (text) - Either 'user' or 'assistant'
  - `content` (text) - The message content
  - `created_at` (timestamptz)

  ## Security

  All tables have Row Level Security (RLS) enabled with appropriate policies:
  
  - Profiles: Users can read their own profile; admins can read all profiles
  - Subjects & Grade Levels: Public read access; admin-only write access
  - Exam Papers & Marking Schemes: Public read access; admin-only write access
  - Chat Conversations & Messages: Users can read/write their own conversations
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create grade_levels table
CREATE TABLE IF NOT EXISTS grade_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exam_papers table
CREATE TABLE IF NOT EXISTS exam_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade_level_id uuid NOT NULL REFERENCES grade_levels(id) ON DELETE CASCADE,
  pdf_url text NOT NULL,
  pdf_path text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create marking_schemes table
CREATE TABLE IF NOT EXISTS marking_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_paper_id uuid UNIQUE NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  pdf_url text NOT NULL,
  pdf_path text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  exam_paper_id uuid NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_exam_papers_subject ON exam_papers(subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade ON exam_papers(grade_level_id);
CREATE INDEX IF NOT EXISTS idx_marking_schemes_exam ON marking_schemes(exam_paper_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_student ON chat_conversations(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_exam ON chat_conversations(exam_paper_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE marking_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for subjects (public read, admin write)
CREATE POLICY "Anyone can view subjects"
  ON subjects FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert subjects"
  ON subjects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update subjects"
  ON subjects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete subjects"
  ON subjects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for grade_levels (public read, admin write)
CREATE POLICY "Anyone can view grade levels"
  ON grade_levels FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert grade levels"
  ON grade_levels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update grade levels"
  ON grade_levels FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete grade levels"
  ON grade_levels FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for exam_papers (public read, admin write)
CREATE POLICY "Anyone can view exam papers"
  ON exam_papers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert exam papers"
  ON exam_papers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update exam papers"
  ON exam_papers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete exam papers"
  ON exam_papers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for marking_schemes (public read, admin write)
CREATE POLICY "Anyone can view marking schemes"
  ON marking_schemes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert marking schemes"
  ON marking_schemes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update marking schemes"
  ON marking_schemes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete marking schemes"
  ON marking_schemes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for chat_conversations
CREATE POLICY "Users can view their own conversations"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "Users can insert their own conversations"
  ON chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can update their own conversations"
  ON chat_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Users can delete their own conversations"
  ON chat_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = student_id);

-- RLS Policies for chat_messages
CREATE POLICY "Users can view messages in their conversations"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.student_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.student_id = auth.uid()
    )
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'student');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
