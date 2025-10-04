/*
  # Create Question-Based Storage Schema

  ## Overview
  This migration creates tables to store exam papers and marking schemes split by individual questions.
  Each question can span multiple pages, and all pages are grouped together with OCR text for intelligent retrieval.

  ## New Tables

  ### 1. `exam_questions`
  Stores grouped question pages from exam papers
  - `id` (uuid, primary key)
  - `exam_paper_id` (uuid, foreign key to exam_papers)
  - `question_number` (text) - The question identifier (e.g., "1", "2a", "3")
  - `page_numbers` (integer[]) - Array of page numbers for this question
  - `image_urls` (text[]) - Array of public URLs for question page images
  - `image_paths` (text[]) - Array of storage paths for question page images
  - `ocr_text` (text) - Combined OCR text from all pages of this question
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `marking_scheme_questions`
  Stores grouped question pages from marking schemes
  - `id` (uuid, primary key)
  - `marking_scheme_id` (uuid, foreign key to marking_schemes)
  - `question_number` (text) - The question identifier
  - `page_numbers` (integer[]) - Array of page numbers for this question
  - `image_urls` (text[]) - Array of public URLs for question page images
  - `image_paths` (text[]) - Array of storage paths for question page images
  - `ocr_text` (text) - Combined OCR text from all pages of this question
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Indexes
  - Indexes on exam_paper_id and marking_scheme_id for fast lookups
  - Indexes on question_number for quick question retrieval

  ## Security
  - Enable RLS on both tables
  - Public read access (same as exam papers)
  - Admin-only write access for data integrity
*/

-- Create exam_questions table
CREATE TABLE IF NOT EXISTS exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_paper_id uuid NOT NULL REFERENCES exam_papers(id) ON DELETE CASCADE,
  question_number text NOT NULL,
  page_numbers integer[] NOT NULL DEFAULT '{}',
  image_urls text[] NOT NULL DEFAULT '{}',
  image_paths text[] NOT NULL DEFAULT '{}',
  ocr_text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create marking_scheme_questions table
CREATE TABLE IF NOT EXISTS marking_scheme_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marking_scheme_id uuid NOT NULL REFERENCES marking_schemes(id) ON DELETE CASCADE,
  question_number text NOT NULL,
  page_numbers integer[] NOT NULL DEFAULT '{}',
  image_urls text[] NOT NULL DEFAULT '{}',
  image_paths text[] NOT NULL DEFAULT '{}',
  ocr_text text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_exam_questions_paper ON exam_questions(exam_paper_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_number ON exam_questions(question_number);
CREATE INDEX IF NOT EXISTS idx_marking_scheme_questions_scheme ON marking_scheme_questions(marking_scheme_id);
CREATE INDEX IF NOT EXISTS idx_marking_scheme_questions_number ON marking_scheme_questions(question_number);

-- Add composite unique constraint to prevent duplicate questions
CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_questions_paper_number ON exam_questions(exam_paper_id, question_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marking_scheme_questions_scheme_number ON marking_scheme_questions(marking_scheme_id, question_number);

-- Enable Row Level Security
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE marking_scheme_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for exam_questions (public read, admin write)
CREATE POLICY "Anyone can view exam questions"
  ON exam_questions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert exam questions"
  ON exam_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update exam questions"
  ON exam_questions FOR UPDATE
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

CREATE POLICY "Admins can delete exam questions"
  ON exam_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for marking_scheme_questions (public read, admin write)
CREATE POLICY "Anyone can view marking scheme questions"
  ON marking_scheme_questions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins can insert marking scheme questions"
  ON marking_scheme_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update marking scheme questions"
  ON marking_scheme_questions FOR UPDATE
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

CREATE POLICY "Admins can delete marking scheme questions"
  ON marking_scheme_questions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
