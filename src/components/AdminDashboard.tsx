import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, GraduationCap, FileText } from 'lucide-react';
import { SubjectManager } from './SubjectManager';
import { GradeLevelManager } from './GradeLevelManager';
import { ExamPaperManager } from './ExamPaperManager';

type Tab = 'subjects' | 'grades' | 'exams';

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('exams');
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const tabs = [
    { id: 'exams' as Tab, label: 'Exam Papers', icon: FileText },
    { id: 'subjects' as Tab, label: 'Subjects', icon: BookOpen },
    { id: 'grades' as Tab, label: 'Grade Levels', icon: GraduationCap },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-black p-2 rounded-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
                <p className="text-xs text-gray-600">{profile?.email}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="flex items-center space-x-2 px-4 py-2 text-gray-900 hover:bg-gray-50 rounded transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {activeTab === 'subjects' && <SubjectManager />}
          {activeTab === 'grades' && <GradeLevelManager />}
          {activeTab === 'exams' && <ExamPaperManager />}
        </div>
      </div>
    </div>
  );
}
