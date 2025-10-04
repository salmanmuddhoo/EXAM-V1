import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, Trash2, Plus, BookOpen, FileText, Home, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PaperSelectionModal } from './PaperSelectionModal';

interface ConversationWithPaper {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  exam_paper_id: string;
  exam_papers: {
    title: string;
    subjects: { name: string };
    grade_levels: { name: string };
  };
}

interface GroupedConversations {
  [subjectName: string]: {
    [paperTitle: string]: ConversationWithPaper[];
  };
}

interface Props {
  onSelectConversation: (conversationId: string, paperId: string) => void;
  onSelectPaper: (paperId: string) => void;
  onNavigateHome: () => void;
}

export function ChatHub({ onSelectConversation, onSelectPaper, onNavigateHome }: Props) {
  const { user, signOut } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showPaperModal, setShowPaperModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          title,
          created_at,
          updated_at,
          exam_paper_id,
          exam_papers (
            title,
            subjects (name),
            grade_levels (name)
          )
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Delete this conversation? This cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      if (selectedConversation === conversationId) {
        setSelectedConversation(null);
      }

      await fetchConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation');
    }
  };

  const groupConversationsBySubjectAndPaper = (): GroupedConversations => {
    const grouped: GroupedConversations = {};

    conversations.forEach((conv) => {
      const subjectName = conv.exam_papers.subjects.name;
      const paperTitle = conv.exam_papers.title;

      if (!grouped[subjectName]) {
        grouped[subjectName] = {};
      }

      if (!grouped[subjectName][paperTitle]) {
        grouped[subjectName][paperTitle] = [];
      }

      grouped[subjectName][paperTitle].push(conv);
    });

    return grouped;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigateHome();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleNewConversation = () => {
    setShowPaperModal(true);
  };

  // Updated handler to reuse existing conversations
  const handlePaperSelected = async (paperId: string, hasExistingConv: boolean) => {
    if (!user) return;

    try {
      if (hasExistingConv) {
        // Fetch the existing conversation
        const { data: existingConv, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .eq('exam_paper_id', paperId)
          .single();

        if (error) throw error;

        setSelectedConversation(existingConv.id);
        onSelectConversation(existingConv.id, paperId);
      } else {
        // Create a new conversation
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert([{ user_id: user.id, exam_paper_id: paperId, title: 'New Conversation' }])
          .select()
          .single();

        if (error) throw error;

        setSelectedConversation(newConv.id);
        onSelectConversation(newConv.id, paperId);
        await fetchConversations();
      }
    } catch (err) {
      console.error('Error handling paper selection:', err);
    } finally {
      setShowPaperModal(false);
    }
  };

  const groupedConversations = groupConversationsBySubjectAndPaper();

  return (
    <>
      <PaperSelectionModal
        isOpen={showPaperModal}
        onClose={() => setShowPaperModal(false)}
        onSelectPaper={handlePaperSelected}
      />

      <div className="h-screen flex flex-col md:flex-row bg-gray-50">
        {/* Left Panel - Conversations List */}
        <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-900">My Conversations</h1>
              <div className="flex items-center space-x-1">
                <button
                  onClick={onNavigateHome}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Go to homepage"
                >
                  <Home className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>
            <button
              onClick={handleNewConversation}
              className="w-full px-4 py-2.5 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Conversation</span>
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-sm text-gray-500">Loading conversations...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No conversations yet</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Start a conversation by selecting an exam paper
                </p>
                <button
                  onClick={handleNewConversation}
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Browse Exam Papers
                </button>
              </div>
            ) : (
              <div className="p-3">
                {Object.entries(groupedConversations).map(([subjectName, papers]) => (
                  <div key={subjectName} className="mb-4">
                    {/* Subject Header */}
                    <div className="flex items-center space-x-2 px-2 py-1.5 mb-2">
                      <BookOpen className="w-4 h-4 text-gray-500" />
                      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {subjectName}
                      </h3>
                    </div>

                    {/* Papers under this subject */}
                    {Object.entries(papers).map(([paperTitle, convs]) => (
                      <div key={paperTitle} className="mb-3">
                        {/* Paper Title */}
                        <div className="flex items-center space-x-2 px-2 py-1 mb-1">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          <h4 className="text-xs font-medium text-gray-600 truncate">
                            {paperTitle}
                          </h4>
                        </div>

                        {/* Conversations for this paper */}
                        {convs.map((conv) => (
                          <div
                            key={conv.id}
                            onClick={() => {
                              setSelectedConversation(conv.id);
                              onSelectConversation(conv.id, conv.exam_paper_id);
                            }}
                            className={`group px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-colors ${
                              selectedConversation === conv.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="text-sm text-gray-900 truncate font-medium">
                                  {conv.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {formatDate(conv.updated_at)}
                                </p>
                              </div>
                              <button
                                onClick={(e) => deleteConversation(conv.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all flex-shrink-0"
                                title="Delete conversation"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Empty State */}
        <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-sm mb-6">
              <MessageSquare className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Select a conversation
            </h2>
            <p className="text-gray-600 mb-6">
              Choose a conversation from the left to continue, or start a new one by selecting an exam paper
            </p>
            <button
              onClick={handleNewConversation}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Browse Exam Papers
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
