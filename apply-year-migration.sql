-- Add year column to exam_papers table
ALTER TABLE exam_papers ADD COLUMN IF NOT EXISTS year integer NOT NULL DEFAULT 2025;

-- Create index on year for efficient filtering
CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON exam_papers(year);

-- Create composite index for grade, subject, and year queries
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade_subject_year
  ON exam_papers(grade_level_id, subject_id, year);
