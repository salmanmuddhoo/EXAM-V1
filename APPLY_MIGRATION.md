# Apply Year Migration

The year field migration needs to be applied manually to your Supabase database.

## Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase dashboard: https://0ec90b57d6e95fcbda19832f.supabase.co
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste this SQL:

```sql
-- Add year column to exam_papers table
ALTER TABLE exam_papers ADD COLUMN year integer NOT NULL DEFAULT 2025;

-- Create index on year for efficient filtering
CREATE INDEX IF NOT EXISTS idx_exam_papers_year ON exam_papers(year);

-- Create composite index for grade, subject, and year queries
CREATE INDEX IF NOT EXISTS idx_exam_papers_grade_subject_year
  ON exam_papers(grade_level_id, subject_id, year);
```

5. Click "Run" to execute the migration
6. You should see "Success. No rows returned"

## Option 2: Using SQL File

Run the SQL from the migration file located at:
`supabase/migrations/20251002120000_add_year_to_exam_papers.sql`

## Verification

After running the migration, you should be able to:
- Upload exam papers with a year field
- See the year displayed in the admin dashboard
- Navigate through Grade → Subject → Year → Papers as a student

## Troubleshooting

If you get an error that the column already exists, the migration has already been applied. You can verify by trying to upload an exam paper again.
