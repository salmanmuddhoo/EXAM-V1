import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, ArrowLeft, Loader2 } from 'lucide-react';

interface Props {
  gradeId: string;
  gradeName: string;
  subjectId: string;
  subjectName: string;
  onBack: () => void;
  onSelectYear: (year: number) => void;
}

export function YearsPage({ gradeId, gradeName, subjectId, subjectName, onBack, onSelectYear }: Props) {
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYears();
  }, [gradeId, subjectId]);

  const fetchYears = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_papers')
        .select('year')
        .eq('grade_level_id', gradeId)
        .eq('subject_id', subjectId)
        .order('year', { ascending: false });

      if (error) throw error;

      const uniqueYears = Array.from(new Set(data.map(paper => paper.year)));
      setYears(uniqueYears);
    } catch (error) {
      console.error('Error fetching years:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-600 hover:text-black mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Subjects</span>
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {subjectName} - {gradeName}
          </h1>
          <p className="text-gray-600">Select a year to view exam papers</p>
        </div>

        {years.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No exam papers available</p>
            <p className="text-sm text-gray-500">
              Check back later for exam papers in this subject
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => onSelectYear(year)}
                className="group relative overflow-hidden bg-white rounded-lg border-2 border-gray-200 hover:border-black transition-all duration-200 p-6 text-center"
              >
                <div className="flex flex-col items-center">
                  <Calendar className="w-8 h-8 text-gray-400 group-hover:text-black transition-colors mb-3" />
                  <h3 className="text-2xl font-bold text-gray-900">{year}</h3>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
