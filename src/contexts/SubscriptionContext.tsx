import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

interface SubscriptionFeatures {
  questions_per_month: number;
  max_papers: number;
  chat_persistence: boolean;
  pdf_export: boolean;
  all_grades: boolean;
  all_subjects: boolean;
  grade_limit?: number;
  subject_limit?: number;
}

interface SubscriptionPlan {
  id: string;
  name: 'free' | 'student' | 'pro';
  display_name: string;
  monthly_price: number;
  yearly_price: number;
  features: SubscriptionFeatures;
}

interface UserSubscription {
  id: string;
  plan_id: string;
  plan: SubscriptionPlan;
  status: 'active' | 'expired' | 'cancelled';
  selected_grade_id: string | null;
  selected_subject_ids: string[];
  expires_at: string | null;
}

interface UsageTracking {
  questions_asked: number;
  papers_accessed: string[];
}

interface SubscriptionContextType {
  subscription: UserSubscription | null;
  usage: UsageTracking | null;
  loading: boolean;
  canAccessPaper: (paperId: string, gradeId: string, subjectId: string) => boolean;
  canAskQuestion: () => boolean;
  trackPaperAccess: (paperId: string) => Promise<void>;
  trackQuestionAsked: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setUsage(null);
      setLoading(false);
      return;
    }

    try {
      const { data: subData, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
          id,
          plan_id,
          status,
          selected_grade_id,
          selected_subject_ids,
          expires_at,
          subscription_plans (
            id,
            name,
            display_name,
            monthly_price,
            yearly_price,
            features
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError) throw subError;

      if (subData) {
        const planData = Array.isArray(subData.subscription_plans)
          ? subData.subscription_plans[0]
          : subData.subscription_plans;

        setSubscription({
          id: subData.id,
          plan_id: subData.plan_id,
          plan: planData as SubscriptionPlan,
          status: subData.status,
          selected_grade_id: subData.selected_grade_id,
          selected_subject_ids: subData.selected_subject_ids,
          expires_at: subData.expires_at,
        });
      }

      const currentMonth = new Date().toISOString().slice(0, 7);
      const { data: usageData, error: usageError } = await supabase
        .from('user_usage_tracking')
        .select('questions_asked, papers_accessed')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth)
        .maybeSingle();

      if (usageError && usageError.code !== 'PGRST116') throw usageError;

      setUsage(usageData || { questions_asked: 0, papers_accessed: [] });
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const canAccessPaper = (paperId: string, gradeId: string, subjectId: string): boolean => {
    if (!subscription) return false;

    const { plan } = subscription;

    if (plan.name === 'pro') {
      return true;
    }

    if (plan.name === 'student') {
      return (
        gradeId === subscription.selected_grade_id &&
        subscription.selected_subject_ids.includes(subjectId)
      );
    }

    if (plan.name === 'free') {
      const maxPapers = plan.features.max_papers;
      const accessedPapers = usage?.papers_accessed || [];

      if (accessedPapers.includes(paperId)) {
        return true;
      }

      return accessedPapers.length < maxPapers;
    }

    return false;
  };

  const canAskQuestion = (): boolean => {
    if (!subscription) return false;

    const { plan } = subscription;

    if (plan.name === 'pro' || plan.name === 'student') {
      return true;
    }

    if (plan.name === 'free') {
      const questionsLimit = plan.features.questions_per_month;
      const questionsAsked = usage?.questions_asked || 0;
      return questionsAsked < questionsLimit;
    }

    return false;
  };

  const trackPaperAccess = async (paperId: string) => {
    if (!user) return;

    try {
      await supabase.rpc('track_paper_access', { paper_id: paperId });
      await fetchSubscription();
    } catch (error) {
      console.error('Error tracking paper access:', error);
    }
  };

  const trackQuestionAsked = async () => {
    if (!user) return;

    try {
      await supabase.rpc('track_question_asked');
      await fetchSubscription();
    } catch (error) {
      console.error('Error tracking question:', error);
    }
  };

  const refreshSubscription = async () => {
    await fetchSubscription();
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        usage,
        loading,
        canAccessPaper,
        canAskQuestion,
        trackPaperAccess,
        trackQuestionAsked,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
