import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, FileText, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createPdfPreviewUrl, revokePdfPreviewUrl, convertPdfToBase64Images, PdfImagePart } from '../lib/pdfUtils';

interface ExamPaper {
  id: string;
  title: string;
  subject_id: string;
  grade_level_id: string;
  year: number;
  pdf_url: string;
  subjects: { name: string };
  grade_levels: { name: string };
  marking_schemes: { id: string; pdf_url: string } | null;
}

interface Subject {
  id: string;
  name: string;
}

interface GradeLevel {
  id: string;
  name: string;
}

export function ExamPaperManager() {
  const { user } = useAuth();
  const [examPapers, setExamPapers] = useState<ExamPaper[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject_id: '',
    grade_level_id: '',
    year: new Date().getFullYear(),
  });
  const [examPaperFile, setExamPaperFile] = useState<File | null>(null);
  const [markingSchemeFile, setMarkingSchemeFile] = useState<File | null>(null);
  const [examPaperPreviewUrl, setExamPaperPreviewUrl] = useState<string>('');
  const [markingSchemePreviewUrl, setMarkingSchemePreviewUrl] = useState<string>('');
  const [examPaperImages, setExamPaperImages] = useState<PdfImagePart[]>([]);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [papersRes, subjectsRes, gradesRes] = await Promise.all([
        supabase
          .from('exam_papers')
          .select(`
            *,
            subjects (name),
            grade_levels (name),
            marking_schemes (id, pdf_url)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('subjects').select('*').order('name'),
        supabase.from('grade_levels').select('*').order('display_order'),
      ]);

      if (papersRes.error) throw papersRes.error;
      if (subjectsRes.error) throw subjectsRes.error;
      if (gradesRes.error) throw gradesRes.error;

      setExamPapers(papersRes.data || []);
      setSubjects(subjectsRes.data || []);
      setGradeLevels(gradesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, bucket: string, folder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);

    return { path: data.path, url: publicUrl };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!examPaperFile) {
      alert('Please select an exam paper PDF');
      return;
    }

    if (!user) {
      alert('You must be logged in to upload exam papers');
      return;
    }

    setUploading(true);

    try {
      const examPaperUpload = await uploadFile(examPaperFile, 'exam-papers', 'papers');

      const { data: examPaper, error: examError } = await supabase
        .from('exam_papers')
        .insert([
          {
            title: formData.title,
            subject_id: formData.subject_id,
            grade_level_id: formData.grade_level_id,
            year: formData.year,
            pdf_url: examPaperUpload.url,
            pdf_path: examPaperUpload.path,
            uploaded_by: user.id,
          },
        ])
        .select()
        .single();

      if (examError) throw examError;

      let markingSchemeId: string | undefined;
      let markingSchemePath: string | undefined;

      if (markingSchemeFile && examPaper) {
        const markingSchemeUpload = await uploadFile(markingSchemeFile, 'marking-schemes', 'schemes');

        const { data: schemeData, error: schemeError } = await supabase.from('marking_schemes').insert([
          {
            exam_paper_id: examPaper.id,
            pdf_url: markingSchemeUpload.url,
            pdf_path: markingSchemeUpload.path,
            uploaded_by: user.id,
          },
        ])
        .select()
        .single();

        if (schemeError) throw schemeError;

        if (schemeData) {
          markingSchemeId = schemeData.id;
          markingSchemePath = schemeData.pdf_path;
        }
      }

      try {
        setProcessingStatus('Converting PDF to images...');

        const pageImages = examPaperImages.map((part, index) => ({
          pageNumber: index + 1,
          base64Image: part.inlineData.data,
        }));

        let markingSchemeImageData: Array<{ pageNumber: number; base64Image: string }> = [];

        if (markingSchemeFile) {
          const {convertPdfToBase64Images} = await import('../lib/pdfUtils');
          setProcessingStatus('Converting marking scheme to images...');
          const schemeImages = await convertPdfToBase64Images(markingSchemeFile);
          markingSchemeImageData = schemeImages.map((part, index) => ({
            pageNumber: index + 1,
            base64Image: part.inlineData.data,
          }));
        }

        setProcessingStatus('Running OCR and detecting questions...');

        const processingResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-exam-paper`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              examPaperId: examPaper.id,
              examPaperPath: examPaperUpload.path,
              markingSchemeId: markingSchemeId,
              markingSchemePath: markingSchemePath,
              pageImages: pageImages,
              markingSchemeImages: markingSchemeImageData.length > 0 ? markingSchemeImageData : undefined,
            }),
          }
        );

        if (!processingResponse.ok) {
          console.warn('Processing function not available yet. PDF uploaded but not processed.');
          setProcessingStatus('');
          setFormData({ title: '', subject_id: '', grade_level_id: '', year: new Date().getFullYear() });
          setExamPaperFile(null);
          setMarkingSchemeFile(null);
          setIsAdding(false);
          fetchData();
          alert('Exam paper uploaded successfully! Note: Question optimization not yet available. Please deploy the process-exam-paper Edge Function.');
        } else {
          const processingResult = await processingResponse.json();
          console.log('Processing result:', processingResult);

          setProcessingStatus('');
          setFormData({ title: '', subject_id: '', grade_level_id: '', year: new Date().getFullYear() });
          setExamPaperFile(null);
          setMarkingSchemeFile(null);
          setIsAdding(false);
          fetchData();
          alert(`Exam paper uploaded and processed successfully! Detected ${processingResult.examQuestionsCount} questions.`);
        }
      } catch (processingError) {
        console.warn('Processing error (non-fatal):', processingError);
        setProcessingStatus('');
        setFormData({ title: '', subject_id: '', grade_level_id: '', year: new Date().getFullYear() });
        setExamPaperFile(null);
        setMarkingSchemeFile(null);
        setIsAdding(false);
        fetchData();
        alert('Exam paper uploaded successfully! Note: Automatic question processing failed. The paper will use full PDF mode.');
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (paper: ExamPaper) => {
    if (!confirm('Are you sure you want to delete this exam paper?')) return;

    try {
      await supabase.storage.from('exam-papers').remove([paper.pdf_path]);

      if (paper.marking_schemes) {
        const { data: scheme } = await supabase
          .from('marking_schemes')
          .select('pdf_path')
          .eq('id', paper.marking_schemes.id)
          .single();

        if (scheme) {
          await supabase.storage.from('marking-schemes').remove([scheme.pdf_path]);
        }
      }

      const { error } = await supabase.from('exam_papers').delete().eq('id', paper.id);
      if (error) throw error;

      fetchData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleExamPaperChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (examPaperPreviewUrl) {
      revokePdfPreviewUrl(examPaperPreviewUrl);
    }

    setExamPaperFile(file);
    const previewUrl = createPdfPreviewUrl(file);
    setExamPaperPreviewUrl(previewUrl);

    setProcessingPdf(true);
    try {
      const images = await convertPdfToBase64Images(file);
      setExamPaperImages(images);
      console.log(`PDF converted to ${images.length} images for AI processing`);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Error processing PDF. The file will still be uploaded.');
    } finally {
      setProcessingPdf(false);
    }
  };

  const handleMarkingSchemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (markingSchemePreviewUrl) {
      revokePdfPreviewUrl(markingSchemePreviewUrl);
    }

    setMarkingSchemeFile(file);
    const previewUrl = createPdfPreviewUrl(file);
    setMarkingSchemePreviewUrl(previewUrl);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setFormData({ title: '', subject_id: '', grade_level_id: '' });
    setExamPaperFile(null);
    setMarkingSchemeFile(null);
    if (examPaperPreviewUrl) {
      revokePdfPreviewUrl(examPaperPreviewUrl);
      setExamPaperPreviewUrl('');
    }
    if (markingSchemePreviewUrl) {
      revokePdfPreviewUrl(markingSchemePreviewUrl);
      setMarkingSchemePreviewUrl('');
    }
    setExamPaperImages([]);
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading exam papers...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <FileText className="w-6 h-6 text-black" />
          <h2 className="text-2xl font-semibold text-gray-900">Exam Papers</h2>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Exam Paper</span>
          </button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-900 mb-1">
                Exam Paper Title
              </label>
              <input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black "
                placeholder="e.g., Mid-term Examination 2024"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-900 mb-1">
                  Subject
                </label>
                <select
                  id="subject"
                  value={formData.subject_id}
                  onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black "
                >
                  <option value="">Select a subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="grade" className="block text-sm font-medium text-gray-900 mb-1">
                  Grade Level
                </label>
                <select
                  id="grade"
                  value={formData.grade_level_id}
                  onChange={(e) => setFormData({ ...formData, grade_level_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black "
                >
                  <option value="">Select a grade</option>
                  {gradeLevels.map((grade) => (
                    <option key={grade.id} value={grade.id}>
                      {grade.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-900 mb-1">
                  Year
                </label>
                <input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  min="2000"
                  max="2099"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-black "
                  placeholder="e.g., 2024"
                />
              </div>
            </div>

            <div>
              <label htmlFor="exam-paper" className="block text-sm font-medium text-gray-900 mb-1">
                Exam Paper PDF (Required)
              </label>
              <div className="flex items-center space-x-3">
                <label className="flex-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-black transition-colors">
                  <Upload className="w-5 h-5 text-gray-600 mr-2" />
                  <span className="text-sm text-gray-600">
                    {examPaperFile ? examPaperFile.name : 'Choose exam paper PDF'}
                  </span>
                  <input
                    id="exam-paper"
                    type="file"
                    accept=".pdf"
                    onChange={handleExamPaperChange}
                    className="hidden"
                  />
                </label>
              </div>
              {processingPdf && (
                <p className="text-xs text-gray-600 mt-2 flex items-center">
                  <span className="animate-spin mr-2">⚙️</span>
                  Processing PDF for AI (converting to images)...
                </p>
              )}
              {examPaperImages.length > 0 && (
                <p className="text-xs text-gray-600 mt-2">
                  ✓ PDF processed: {examPaperImages.length} pages ready for AI
                </p>
              )}
              {examPaperPreviewUrl && (
                <div className="mt-3 border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Preview</span>
                    <button
                      type="button"
                      onClick={() => {
                        revokePdfPreviewUrl(examPaperPreviewUrl);
                        setExamPaperPreviewUrl('');
                        setExamPaperFile(null);
                        setExamPaperImages([]);
                      }}
                      className="text-gray-600 hover:text-black"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <embed
                    src={examPaperPreviewUrl}
                    type="application/pdf"
                    className="w-full h-96"
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="marking-scheme" className="block text-sm font-medium text-gray-900 mb-1">
                Marking Scheme PDF (Optional)
              </label>
              <div className="flex items-center space-x-3">
                <label className="flex-1 flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-black transition-colors">
                  <Upload className="w-5 h-5 text-gray-600 mr-2" />
                  <span className="text-sm text-gray-600">
                    {markingSchemeFile ? markingSchemeFile.name : 'Choose marking scheme PDF'}
                  </span>
                  <input
                    id="marking-scheme"
                    type="file"
                    accept=".pdf"
                    onChange={handleMarkingSchemeChange}
                    className="hidden"
                  />
                </label>
              </div>
              {markingSchemePreviewUrl && (
                <div className="mt-3 border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">Preview</span>
                    <button
                      type="button"
                      onClick={() => {
                        revokePdfPreviewUrl(markingSchemePreviewUrl);
                        setMarkingSchemePreviewUrl('');
                        setMarkingSchemeFile(null);
                      }}
                      className="text-gray-600 hover:text-black"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <embed
                    src={markingSchemePreviewUrl}
                    type="application/pdf"
                    className="w-full h-96"
                  />
                </div>
              )}
            </div>

            {processingStatus && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 flex items-center">
                  <span className="animate-spin mr-2">⚙️</span>
                  {processingStatus}
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading & Processing...' : 'Upload Exam Paper'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={uploading}
                className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {examPapers.length === 0 ? (
          <div className="text-center py-8 text-gray-600">
            No exam papers uploaded yet. Click "Upload Exam Paper" to get started.
          </div>
        ) : (
          examPapers.map((paper) => (
            <div
              key={paper.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div>
                <h3 className="font-semibold text-gray-900">{paper.title}</h3>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-sm text-gray-600">
                    {paper.subjects.name} • {paper.grade_levels.name} • {paper.year}
                  </span>
                  {paper.marking_schemes && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      Has Marking Scheme
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <a
                  href={paper.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm text-black hover:bg-gray-50 rounded-lg transition-colors"
                >
                  View PDF
                </a>
                <button
                  onClick={() => handleDelete(paper)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
