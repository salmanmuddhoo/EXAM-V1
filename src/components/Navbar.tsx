import { useState, useEffect } from 'react';
import { Menu, X, ChevronDown, BookOpen, LogIn, LogOut, LayoutDashboard, MessageSquare } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface GradeLevel {
  id: string;
  name: string;
  display_order: number;
}

interface Props {
  onNavigateHome: () => void;
  onNavigateAdmin: () => void;
  onNavigateLogin: () => void;
  onNavigateChatHub?: () => void;
  onSelectGrade: (gradeId: string, gradeName: string) => void;
  currentView: string;
}

export function Navbar({ onNavigateHome, onNavigateAdmin, onNavigateLogin, onNavigateChatHub, onSelectGrade, currentView }: Props) {
  const { user, profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([]);
  const [openMobileGrades, setOpenMobileGrades] = useState(false);

  useEffect(() => {
    fetchGradeLevels();
  }, []);

  const fetchGradeLevels = async () => {
    try {
      const { data, error } = await supabase
        .from('grade_levels')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setGradeLevels(data || []);
    } catch (error) {
      console.error('Error fetching grade levels:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setMobileMenuOpen(false);
      onNavigateHome();
    } catch (error) {
      console.error('Error signing out:', error);
      setMobileMenuOpen(false);
      onNavigateHome();
    }
  };

  const handleGradeClick = (gradeId: string, gradeName: string) => {
    onSelectGrade(gradeId, gradeName);
    setMobileMenuOpen(false);
    setOpenMobileGrades(false);
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <button
            onClick={onNavigateHome}
            className="flex items-center space-x-2 text-gray-900 hover:text-gray-600 transition-colors"
          >
            <BookOpen className="w-6 h-6" />
            <span className="font-semibold text-lg hidden sm:inline">Exam Study Assistant</span>
            <span className="font-semibold text-lg sm:hidden">ESA</span>
          </button>

          <div className="hidden md:flex items-center space-x-1">
            {gradeLevels.map((grade) => (
              <button
                key={grade.id}
                onClick={() => handleGradeClick(grade.id, grade.name)}
                className="px-4 py-2 text-gray-700 hover:text-black hover:bg-gray-50 rounded-lg transition-colors font-medium"
              >
                Grade {grade.name}
              </button>
            ))}

            <div className="w-px h-6 bg-gray-200 mx-2" />

            {user ? (
              <>
                {profile?.role !== 'admin' && onNavigateChatHub && (
                  <button
                    onClick={onNavigateChatHub}
                    className="flex items-center space-x-1 px-4 py-2 text-gray-700 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>My Conversations</span>
                  </button>
                )}
                {profile?.role === 'admin' && (
                  <button
                    onClick={onNavigateAdmin}
                    className="flex items-center space-x-1 px-4 py-2 text-gray-700 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Admin</span>
                  </button>
                )}
                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 px-4 py-2 text-gray-700 hover:text-black hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={onNavigateLogin}
                className="flex items-center space-x-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-700 hover:text-black"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="space-y-2">
              <div className="border-b border-gray-200 pb-3 mb-3">
                <button
                  onClick={() => setOpenMobileGrades(!openMobileGrades)}
                  className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-gray-900"
                >
                  <span>Grades</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${openMobileGrades ? 'rotate-180' : ''}`} />
                </button>

                {openMobileGrades && (
                  <div className="mt-2 space-y-1">
                    {gradeLevels.map((grade) => (
                      <button
                        key={grade.id}
                        onClick={() => handleGradeClick(grade.id, grade.name)}
                        className="w-full text-left px-6 py-2 text-gray-700 hover:bg-gray-50 hover:text-black transition-colors"
                      >
                        Grade {grade.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {user ? (
                <>
                  {profile?.role !== 'admin' && onNavigateChatHub && (
                    <button
                      onClick={() => {
                        onNavigateChatHub();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-50"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>My Conversations</span>
                    </button>
                  )}
                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => {
                        onNavigateAdmin();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-50"
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span>Admin Dashboard</span>
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    onNavigateLogin();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 mx-4"
                  style={{ width: 'calc(100% - 2rem)' }}
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
