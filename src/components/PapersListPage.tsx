import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, FileText, Loader2, Calendar } from 'lucide-react';

interface ExamPaper {
  id: string;
  title: string;
  created_at: string;
}

interface Props {
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  year: number;
  onBack: () => void;
  onSelectPaper: (paperId: string) => void;
}

export function PapersListPage({ gradeId, gradeName, subjectId, subjectName, year, onBack, onSelectPaper }: Props) {
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPapers();
  }, [gradeId, subjectId, year]);

  const fetchPapers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('exam_papers')
        .select('id, title, created_at')
        .eq('grade_level_id', gradeId)
        .eq('subject_id', subjectId)
        .eq('year', year)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPapers(data || []);
    } catch (error) {
      console.error('Error fetching papers:', error);
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
          <span>Back to Years</span>
        </button>

        <div className="mb-8">
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
            <span>Grade {gradeName}</span>
            <span>•</span>
            <span>{subjectName}</span>
            <span>•</span>
            <span>{year}</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{subjectName} - {year}</h1>
          <p className="text-gray-600">Select an exam paper to start studying with AI assistance</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading papers...</p>
            </div>
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No papers available</h3>
            <p className="text-gray-500">There are no exam papers for {subjectName} in {year}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {papers.map((paper) => (
              <button
                key={paper.id}
                onClick={() => onSelectPaper(paper.id)}
                className="bg-white border-2 border-gray-200 rounded-lg p-5 hover:border-black hover:shadow-lg transition-all group text-left"
              >
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-black transition-colors flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-black line-clamp-2">
                      {paper.title}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {new Date(paper.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}