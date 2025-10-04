import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send, Loader2, FileText, MessageSquare, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { convertPdfToBase64Images } from '../lib/pdfUtils';
import { ChatMessage } from './ChatMessage';

interface ExamPaper {
  id: string;
  title: string;
  pdf_url: string;
  pdf_path: string;
  subjects: { name: string };
  grade_levels: { name: string };
  marking_schemes: { pdf_url: string; pdf_path: string } | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  paperId: string;
  conversationId?: string | null;
  onBack: () => void;
  onLoginRequired: () => void;
}

export function ExamViewer({ paperId, conversationId, onBack, onLoginRequired }: Props) {
  const { user } = useAuth();
  const [examPaper, setExamPaper] = useState<ExamPaper | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(true);
  const [examPaperImages, setExamPaperImages] = useState<string[]>([]);
  const [markingSchemeImages, setMarkingSchemeImages] = useState<string[]>([]);
  const [processingPdfs, setProcessingPdfs] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamingMessageIndex, setStreamingMessageIndex] = useState<number | null>(null);
  const [mobileView, setMobileView] = useState<'pdf' | 'chat'>('pdf');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId || null);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchExamPaper();

    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [paperId]);

  useEffect(() => {
    if (conversationId && user) {
      loadConversation(conversationId);
    }
  }, [conversationId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (examPaper?.pdf_path && isMobile !== null) {
      loadPdfBlob();
    }
  }, [examPaper, isMobile]);

  const extractQuestionNumber = (text: string): string | null => {
    // Match patterns like: "Question 1", "Q1", "question 1a", "Q 2b", etc.
    const patterns = [
      /question\s*(\d+[a-z]?)/i,
      /q\.?\s*(\d+[a-z]?)/i,
      /^(\d+[a-z]?)\b/i,
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].toLowerCase();
      }
    }
    
    return null;
  };

  const loadPdfBlob = async () => {
    if (!examPaper) return;

    try {
      setPdfLoading(true);
      setProcessingPdfs(true);

      const { data, error } = await supabase.storage
        .from('exam-papers')
        .download(examPaper.pdf_path);

      if (error) throw error;

      const pdfBlob = new Blob([data], { type: 'application/pdf' });

      if (isMobile) {
        const { data: { publicUrl } } = supabase.storage
          .from('exam-papers')
          .getPublicUrl(examPaper.pdf_path);
        setPdfBlobUrl(publicUrl);
      } else {
        const url = URL.createObjectURL(pdfBlob);
        setPdfBlobUrl(url);
      }

      const examFile = new File([pdfBlob], 'exam.pdf', { type: 'application/pdf' });
      const examImages = await convertPdfToBase64Images(examFile);
      setExamPaperImages(examImages.map(img => img.inlineData.data));

      if (examPaper.marking_schemes?.pdf_path) {
        try {
          const { data: schemeData } = await supabase.storage
            .from('marking-schemes')
            .download(examPaper.marking_schemes.pdf_path);

          if (schemeData) {
            const schemeBlob = new Blob([schemeData], { type: 'application/pdf' });
            const schemeFile = new File([schemeBlob], 'scheme.pdf', { type: 'application/pdf' });
            const schemeImages = await convertPdfToBase64Images(schemeFile);
            setMarkingSchemeImages(schemeImages.map(img => img.inlineData.data));
          }
        } catch (schemeError) {
          console.error('Error loading marking scheme:', schemeError);
        }
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
      const { data: { publicUrl } } = supabase.storage
        .from('exam-papers')
        .getPublicUrl(examPaper.pdf_path);
      setPdfBlobUrl(publicUrl || examPaper.pdf_url);
    } finally {
      setPdfLoading(false);
      setProcessingPdfs(false);
    }
  };

  const fetchExamPaper = async () => {
    try {
      const { data, error } = await supabase
        .from('exam_papers')
        .select(`
          *,
          subjects (name),
          grade_levels (name),
          marking_schemes (pdf_url, pdf_path)
        `)
        .eq('id', paperId)
        .single();

      if (error) throw error;
      setExamPaper(data);
    } catch (error) {
      console.error('Error fetching exam paper:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('role, content, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })));
      setCurrentConversationId(convId);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  const saveMessageToConversation = async (userMessage: string, assistantMessage: string) => {
    if (!user) return;

    try {
      let convId = currentConversationId;

      if (!convId) {
        const title = userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '');

        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            exam_paper_id: paperId,
            title: title
          })
          .select()
          .single();

        if (convError) throw convError;
        convId = newConv.id;
        setCurrentConversationId(convId);
      }

      const { error: msgError } = await supabase
        .from('conversation_messages')
        .insert([
          {
            conversation_id: convId,
            role: 'user',
            content: userMessage
          },
          {
            conversation_id: convId,
            role: 'assistant',
            content: assistantMessage
          }
        ]);

      if (msgError) throw msgError;
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || sending || !examPaper) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);

    try {
      // Try to detect question number from user input
      const questionNumber = extractQuestionNumber(userMessage);
      
      let requestBody: any = {
        question: userMessage,
        provider: 'gemini',
        examPaperId: examPaper.id,
      };

      // Try to use optimized mode with specific question
      if (questionNumber) {
        console.log(`Detected question number: ${questionNumber}`);
        
        // Fetch the specific question from database
        const { data: questionData, error: questionError } = await supabase
          .from('exam_questions')
          .select('id, question_number, ocr_text, image_url, page_numbers')
          .eq('exam_paper_id', examPaper.id)
          .eq('question_number', questionNumber)
          .maybeSingle();

        if (questionData && !questionError) {
          console.log(`Found optimized question data for Q${questionNumber}`);
          
          // Use optimized mode - send only the specific question image
          requestBody.optimizedMode = true;
          requestBody.questionNumber = questionNumber;
          requestBody.questionText = questionData.ocr_text;
          requestBody.questionImageUrl = questionData.image_url;
          
          // Fetch the actual image from the URL
          if (questionData.image_url) {
            try {
              const imageResponse = await fetch(questionData.image_url);
              const imageBlob = await imageResponse.blob();
              const reader = new FileReader();
              
              const base64Image = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                  const result = reader.result as string;
                  // Remove the data:image/jpeg;base64, prefix
                  const base64 = result.split(',')[1];
                  resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(imageBlob);
              });
              
              requestBody.examPaperImages = [base64Image];
              console.log(`Loaded question image (${base64Image.length} chars)`);
            } catch (imageError) {
              console.warn('Failed to load question image, falling back to full PDF mode');
              requestBody.optimizedMode = false;
            }
          }
          
          // Check if there's a marking scheme
          if (examPaper.marking_schemes) {
            const { data: schemeData } = await supabase
              .from('marking_schemes')
              .select('id')
              .eq('exam_paper_id', examPaper.id)
              .maybeSingle();

            if (schemeData) {
              requestBody.markingSchemeId = schemeData.id;
            }
          }
        } else {
          console.log(`Question ${questionNumber} not found in database, using fallback mode`);
          requestBody.optimizedMode = false;
        }
      }

      // Fallback to full PDF mode if optimized mode not available
      if (!requestBody.optimizedMode) {
        console.log('Using full PDF fallback mode');
        
        if (examPaperImages.length === 0) {
          alert('Please wait for the exam paper to finish processing.');
          setSending(false);
          return;
        }
        
        requestBody.examPaperImages = examPaperImages;
        requestBody.markingSchemeImages = markingSchemeImages;
        
        if (examPaper.marking_schemes) {
          const { data: schemeData } = await supabase
            .from('marking_schemes')
            .select('id')
            .eq('exam_paper_id', examPaper.id)
            .maybeSingle();

          if (schemeData) {
            requestBody.markingSchemeId = schemeData.id;
          }
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exam-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      const assistantMessage = data.answer;

      if (requestBody.optimizedMode) {
        console.log(`Used optimized mode: sent 1 image instead of ${examPaperImages.length + markingSchemeImages.length}`);
        console.log(`Cost savings: approximately ${Math.round(((examPaperImages.length + markingSchemeImages.length - 1) / (examPaperImages.length + markingSchemeImages.length)) * 100)}%`);
      } else {
        console.log(`Used full PDF fallback mode (${examPaperImages.length + markingSchemeImages.length} images)`);
      }

      setMessages((prev) => {
        const newMessages = [...prev, { role: 'assistant', content: assistantMessage }];
        setStreamingMessageIndex(newMessages.length - 1);
        return newMessages;
      });

      setTimeout(() => {
        setStreamingMessageIndex(null);
      }, (assistantMessage.length / 3) * 15 + 200);

      await saveMessageToConversation(userMessage, assistantMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (!examPaper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Exam paper not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden fixed inset-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">{examPaper.title}</h1>
            <p className="text-xs text-gray-500">
              {examPaper.grade_levels.name} - {examPaper.subjects.name}
            </p>
          </div>
        </div>

        {/* Mobile toggle - Capsule Switch */}
        <div className="flex md:hidden">
          <div className="relative bg-gray-200 rounded-full p-1 flex items-center">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-black rounded-full transition-transform duration-300 ease-in-out ${
                mobileView === 'chat' ? 'translate-x-[calc(100%+8px)]' : 'translate-x-0'
              }`}
            />
            <button
              onClick={() => setMobileView('pdf')}
              className={`relative z-10 px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
                mobileView === 'pdf'
                  ? 'text-white'
                  : 'text-gray-600'
              }`}
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMobileView('chat')}
              className={`relative z-10 px-4 py-1.5 text-sm font-medium transition-colors duration-300 ${
                mobileView === 'chat'
                  ? 'text-white'
                  : 'text-gray-600'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Panel Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - PDF Viewer */}
        <div className={`${mobileView === 'pdf' ? 'flex' : 'hidden md:flex'} flex-1 bg-gray-100 relative`}>
          {pdfLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Loading PDF...</p>
              </div>
            </div>
          ) : pdfBlobUrl ? (
            isMobile ? (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfBlobUrl)}&embedded=true`}
                className="w-full h-full border-0"
                title="Exam Paper"
                allow="fullscreen"
              />
            ) : (
              <iframe
                src={pdfBlobUrl}
                className="w-full h-full border-0"
                title="Exam Paper"
                allow="fullscreen"
              />
            )
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md p-6">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Unable to load PDF viewer.</p>
                <a
                  href={examPaper.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                >
                  Open PDF in New Tab
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Chat Area */}
        <div className={`${mobileView === 'chat' ? 'flex' : 'hidden md:flex'} w-full md:w-[500px] lg:w-[600px] flex-col bg-white border-l border-gray-200 h-full pb-safe`}>
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
            <h2 className="font-semibold text-gray-900">AI Study Assistant</h2>
            <p className="text-xs text-gray-500 mt-1">
              {processingPdfs ? (
                <span className="flex items-center">
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  Processing PDFs for AI analysis...
                </span>
              ) : (
                "Ask your question in this format: Question 1"
              )}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ scrollBehavior: 'smooth' }}>
            {!user ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <Lock className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign In Required</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Sign in to chat with the AI tutor and get help with your exam questions.
                  </p>
                  <button
                    onClick={onLoginRequired}
                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    Sign In or Sign Up
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm">
                  <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Start a conversation with the AI tutor to get help with your exam questions
                  </p>
                </div>
              </div>
            ) : null}

            {messages.map((message, index) => (
              <ChatMessage
                key={index}
                role={message.role}
                content={message.content}
                isStreaming={index === streamingMessageIndex}
                onStreamUpdate={scrollToBottom}
              />
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {user && (
            <div className="px-4 pt-4 pb-20 md:pb-4 border-t border-gray-200 bg-white flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  disabled={sending}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:outline-none focus:border-black transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}