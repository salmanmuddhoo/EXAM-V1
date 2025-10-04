import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, ChevronRight, Loader2, FileText, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface GradeLevel {
  id: string;
  name: string;
  display_order: number;
}

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
  isOpen: boolean;
  onClose: () => void;
  onSelectPaper: (paperId: string, hasExistingConv: boolean) => void;
}

type Step = 'grade' | 'subject' | 'paper';

export function PaperSelectionModal({ isOpen, onClose, onSelectPaper }: Props) {
  const { user } = useAuth();
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [papers, setPapers] = useState<ExamPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<Step>('grade');
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [existingConvs, setExistingConvs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      fetchData();
      setCurrentStep('grade');
      setSelectedGrade(null);
      setSelectedSubject(null);
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [gradesRes, subjectsRes, papersRes] = await Promise.all([
        supabase.from('grade_levels').select('*').order('display_order'),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('exam_papers').select('id, title, subject_id, grade_level_id').order('title'),
      ]);

      if (gradesRes.error) throw gradesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (papersRes.error) throw papersRes.error;

      setGradeLevels(gradesRes.data || []);
      setSubjects(subjectsRes.data || []);
      setPapers(papersRes.data || []);

      // Fetch existing conversations for current user
      if (user) {
        const { data: convs, error } = await supabase
          .from('conversations')
          .select('exam_paper_id')
          .eq('user_id', user.id);

        if (error) throw error;

        const convMap: Record<string, boolean> = {};
        convs?.forEach((c: any) => {
          convMap[c.exam_paper_id] = true;
        });
        setExistingConvs(convMap);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAvailableSubjectsForGrade = (gradeId: string) => {
    const subjectIds = new Set(
      papers
        .filter(p => p.grade_level_id === gradeId)
        .map(p => p.subject_id)
    );
    return subjects.filter(s => subjectIds.has(s.id));
  };

  const getPapersForSubjectAndGrade = (subjectId: string, gradeId: string) => {
    return papers.filter(p => p.subject_id === subjectId && p.grade_level_id === gradeId);
  };

  const handleGradeClick = (grade: GradeLevel) => {
    setSelectedGrade(grade);
    setSelectedSubject(null);
    setCurrentStep('subject');
  };

  const handleSubjectClick = (subject: Subject) => {
    setSelectedSubject(subject);
    setCurrentStep('paper');
  };

  const handlePaperClick = (paper: ExamPaper) => {
    const hasExisting = existingConvs[paper.id] || false;
    onSelectPaper(paper.id, hasExisting);
    handleClose();
  };

  const handleBack = () => {
    if (currentStep === 'paper') {
      setSelectedSubject(null);
      setCurrentStep('subject');
    } else if (currentStep === 'subject') {
      setSelectedGrade(null);
      setCurrentStep('grade');
    }
  };

  const handleClose = () => {
    setSelectedGrade(null);
    setSelectedSubject(null);
    setCurrentStep('grade');
    onClose();
  };

  if (!isOpen) return null;

  const availableSubjects = selectedGrade ? getAvailableSubjectsForGrade(selectedGrade.id) : [];
  const availablePapers = selectedGrade && selectedSubject
    ? getPapersForSubjectAndGrade(selectedSubject.id, selectedGrade.id)
    : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {currentStep !== 'grade' && (
              <button onClick={handleBack} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {currentStep === 'grade' && 'Select Grade Level'}
                {currentStep === 'subject' && `Grade ${selectedGrade?.name} - Select Subject`}
                {currentStep === 'paper' && `${selectedSubject?.name} - Select Paper`}
              </h2>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          ) : (
            <>
              {currentStep === 'grade' && gradeLevels.map(grade => (
                <button key={grade.id} onClick={() => handleGradeClick(grade)} className="w-full text-left px-4 py-4 rounded-lg border-2 border-gray-200 hover:border-black hover:bg-gray-50 transition-all flex items-center justify-between group">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">Grade {grade.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {getAvailableSubjectsForGrade(grade.id).length} subjects available
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" />
                </button>
              ))}

              {currentStep === 'subject' && availableSubjects.map(subject => (
                <button key={subject.id} onClick={() => handleSubjectClick(subject)} className="w-full text-left px-4 py-4 rounded-lg border-2 border-gray-200 hover:border-black hover:bg-gray-50 transition-all flex items-center justify-between group">
                  <div>
                    <p className="font-semibold text-gray-900 text-lg">{subject.name}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {getPapersForSubjectAndGrade(subject.id, selectedGrade!.id).length} papers available
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" />
                </button>
              ))}

              {currentStep === 'paper' && availablePapers.map(paper => (
                <button key={paper.id} onClick={() => handlePaperClick(paper)} className="w-full text-left px-4 py-4 rounded-lg border-2 border-gray-200 hover:border-black hover:bg-gray-50 transition-all flex items-center justify-between group">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <p className="font-semibold text-gray-900">{paper.title}</p>
                  </div>
                  {existingConvs[paper.id] && <span className="text-xs text-green-600 font-medium">Continue conversation</span>}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            {currentStep === 'grade' && 'Select a grade level to view available subjects'}
            {currentStep === 'subject' && 'Select a subject to view available exam papers'}
            {currentStep === 'paper' && 'Select an exam paper to start or continue a conversation'}
          </p>
        </div>
      </div>
    </div>
  );
}
