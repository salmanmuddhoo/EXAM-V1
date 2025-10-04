/*
  # Add Year Field to Exam Papers

  ## Overview
  This migration adds a year field to the exam_papers table to track which year
  an exam paper is from. This allows the same subject and grade to have papers
  from different years.

  ## Changes

  ### 1. Modified Tables
    - `exam_papers`
      - Added `year` (integer) - The year of the exam paper (e.g., 2023, 2024)
      - Added NOT NULL constraint with default value
      - Added index for better query performance

  ## Migration Details

  1. Add year column to exam_papers table
  2. Set default year to current year for existing records
  3. Make year required for future inserts
  4. Add index on year for efficient filtering
  5. Add composite index on grade_level_id, subject_id, and year for common queries

  ## Important Notes

  - Existing exam papers will be assigned the current year (2025)
  - Admins should update existing papers with correct years after migration
  - Year field is required for all new exam papers
*/

-- Add year column to exam_papers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_papers' AND column_name = 'year'
  ) THEN
    ALTER TABLE exam_papers ADD COLUMN year integer NOT NULL DEFAULT 2025;
  END IF;
END $$;

-- Create index on year for efficient filtering
CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON exam_papers(year);

-- Create composite index for grade, subject, and year queries
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade_subject_year
  ON exam_papers(grade_level_id, subject_id, year);
