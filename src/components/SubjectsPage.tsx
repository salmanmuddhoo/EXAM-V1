import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, BookOpen, ChevronRight, Loader2 } from 'lucide-react';

interface Subject {
  id: string;
  name: string;
}

interface ExamPaper {
  id: string;
  title: string;
  subject_id: string;
  grade_level_id: string;
}

interface Props {
  gradeId: string;
  gradeName: string;
  onBack: () => void;
  onSelectSubject: (subjectId: string, subjectName: string) => void;
}

export function SubjectsPage({ gradeId, gradeName, onBack, onSelectSubject }: Props) {
  const [subjects, setSubjects] = useState<Array<{ subject: Subject; paperCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubjects();
  }, [gradeId]);

  const fetchSubjects = async () => {
    try {
      setLoading(true);

      const [subjectsRes, papersRes] = await Promise.all([
        supabase.from('subjects').select('*').order('name'),
        supabase.from('exam_papers').select('id, subject_id').eq('grade_level_id', gradeId)
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (papersRes.error) throw papersRes.error;

      const papers = papersRes.data || [];
      const allSubjects = subjectsRes.data || [];

      const paperCountBySubject = papers.reduce((acc, paper) => {
        acc[paper.subject_id] = (acc[paper.subject_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const subjectsWithPapers = allSubjects
        .filter(subject => paperCountBySubject[subject.id] > 0)
        .map(subject => ({
          subject,
          paperCount: paperCountBySubject[subject.id]
        }));

      setSubjects(subjectsWithPapers);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-black transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </button>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Grade {gradeName}</h1>
          <p className="text-gray-600">Select a subject to view available exam papers</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading subjects...</p>
            </div>
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No subjects available</h3>
            <p className="text-gray-500">There are no exam papers for this grade yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map(({ subject, paperCount }) => (
              <button
                key={subject.id}
                onClick={() => onSelectSubject(subject.id, subject.name)}
                className="bg-white border-2 border-gray-200 rounded-lg p-6 hover:border-black hover:shadow-lg transition-all group text-left"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-black transition-colors">
                    <BookOpen className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{subject.name}</h3>
                <p className="text-sm text-gray-500">
                  {paperCount} {paperCount === 1 ? 'paper' : 'papers'} available
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
