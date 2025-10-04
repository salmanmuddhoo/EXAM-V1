import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Crown, Sparkles, Gift, Check, X, AlertCircle } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  monthly_price: number;
  yearly_price: number;
  features: any;
}

interface Subject {
  id: string;
  name: string;
}

interface GradeLevel {
  id: string;
  name: string;
}

export function SubscriptionManagement({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { subscription, refreshSubscription } = useSubscription();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [step, setStep] = useState<'select-plan' | 'configure-student' | 'confirm'>('select-plan');

  const [grades, setGrades] = useState<GradeLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGradeId, setSelectedGradeId] = useState<string>('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlans();
    fetchGradesAndSubjects();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err) {
      console.error('Error fetching plans:', err);
    }
  };

  const fetchGradesAndSubjects = async () => {
    try {
      const [gradesRes, subjectsRes] = await Promise.all([
        supabase.from('grade_levels').select('*').order('display_order'),
        supabase.from('subjects').select('*').order('name')
      ]);

      if (gradesRes.error) throw gradesRes.error;
      if (subjectsRes.error) throw subjectsRes.error;

      setGrades(gradesRes.data || []);
      setSubjects(subjectsRes.data || []);
    } catch (err) {
      console.error('Error fetching grades and subjects:', err);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    setSelectedPlan(plan);

    if (plan.name === 'student') {
      setStep('configure-student');
    } else {
      setStep('confirm');
    }
  };

  const handleSubjectToggle = (subjectId: string) => {
    setSelectedSubjectIds(prev => {
      if (prev.includes(subjectId)) {
        return prev.filter(id => id !== subjectId);
      } else if (prev.length < 8) {
        return [...prev, subjectId];
      }
      return prev;
    });
  };

  const handleConfirmSubscription = async () => {
    if (!user || !selectedPlan) return;

    setLoading(true);
    setError('');

    try {
      if (selectedPlan.name === 'student' && (!selectedGradeId || selectedSubjectIds.length === 0)) {
        setError('Please select a grade and at least one subject');
        setLoading(false);
        return;
      }

      const price = billingCycle === 'monthly' ? selectedPlan.monthly_price : selectedPlan.yearly_price;
      const expiresAt = billingCycle === 'one_time' ? null :
        new Date(Date.now() + (billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();

      const subscriptionData: any = {
        user_id: user.id,
        plan_id: selectedPlan.id,
        billing_cycle: selectedPlan.name === 'free' ? 'one_time' : billingCycle,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: expiresAt
      };

      if (selectedPlan.name === 'student') {
        subscriptionData.selected_grade_id = selectedGradeId;
        subscriptionData.selected_subject_ids = selectedSubjectIds;
      }

      if (subscription && subscription.plan.name !== 'free') {
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', subscription.id);

        if (updateError) throw updateError;
      }

      const { data: newSub, error: subError } = await supabase
        .from('user_subscriptions')
        .insert([subscriptionData])
        .select()
        .single();

      if (subError) throw subError;

      if (selectedPlan.name !== 'free' && price > 0) {
        await supabase.from('purchase_history').insert([{
          user_id: user.id,
          subscription_id: newSub.id,
          plan_id: selectedPlan.id,
          amount: price,
          billing_cycle: billingCycle,
          payment_method: 'manual',
          status: 'completed',
          purchased_at: new Date().toISOString()
        }]);
      }

      await refreshSubscription();
      onClose();
    } catch (err: any) {
      console.error('Error updating subscription:', err);
      setError(err.message || 'Failed to update subscription');
    } finally {
      setLoading(false);
    }
  };

  const renderPlanSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Plan</h3>
        <p className="text-gray-600">Select a plan that fits your needs</p>
      </div>

      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === 'monthly' ? 'bg-white shadow-sm' : 'text-gray-700'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === 'yearly' ? 'bg-white shadow-sm' : 'text-gray-700'
            }`}
          >
            Yearly (Save 17%)
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {plans.map(plan => {
          const price = billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price;
          const isCurrent = subscription?.plan.id === plan.id;

          return (
            <div
              key={plan.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                isCurrent
                  ? 'border-black bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => !isCurrent && handleSelectPlan(plan)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {plan.name === 'free' ? <Gift className="w-5 h-5" /> :
                     plan.name === 'pro' ? <Crown className="w-5 h-5" /> :
                     <Sparkles className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{plan.display_name}</h4>
                    {isCurrent && <span className="text-xs text-gray-600">Current Plan</span>}
                  </div>
                </div>
                <div className="text-right">
                  {plan.name === 'free' ? (
                    <p className="text-lg font-bold">Free</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">${price}</p>
                      <p className="text-xs text-gray-600">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderStudentConfiguration = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Configure Student Plan</h3>
        <p className="text-gray-600">Select 1 grade and up to 8 subjects</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Select Grade Level
        </label>
        <select
          value={selectedGradeId}
          onChange={(e) => setSelectedGradeId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
        >
          <option value="">Choose a grade...</option>
          {grades.map(grade => (
            <option key={grade.id} value={grade.id}>{grade.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900 mb-2">
          Select Subjects ({selectedSubjectIds.length}/8)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {subjects.map(subject => (
            <button
              key={subject.id}
              onClick={() => handleSubjectToggle(subject.id)}
              disabled={!selectedSubjectIds.includes(subject.id) && selectedSubjectIds.length >= 8}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                selectedSubjectIds.includes(subject.id)
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 hover:border-gray-300'
              } ${!selectedSubjectIds.includes(subject.id) && selectedSubjectIds.length >= 8 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{subject.name}</span>
                {selectedSubjectIds.includes(subject.id) && <Check className="w-4 h-4" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={() => setStep('select-plan')}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={() => setStep('confirm')}
          disabled={!selectedGradeId || selectedSubjectIds.length === 0}
          className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Subscription</h3>
        <p className="text-gray-600">Review your selection</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 space-y-4">
        <div>
          <p className="text-sm text-gray-600">Plan</p>
          <p className="text-lg font-semibold text-gray-900">{selectedPlan?.display_name}</p>
        </div>

        {selectedPlan?.name === 'student' && (
          <>
            <div>
              <p className="text-sm text-gray-600">Grade</p>
              <p className="text-lg font-semibold text-gray-900">
                {grades.find(g => g.id === selectedGradeId)?.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Subjects ({selectedSubjectIds.length})</p>
              <div className="flex flex-wrap gap-2">
                {selectedSubjectIds.map(id => (
                  <span key={id} className="px-3 py-1 bg-white rounded-full text-sm">
                    {subjects.find(s => s.id === id)?.name}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

        {selectedPlan && selectedPlan.name !== 'free' && (
          <div className="border-t border-gray-200 pt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">
                ${billingCycle === 'monthly' ? selectedPlan.monthly_price : selectedPlan.yearly_price}
                <span className="text-sm text-gray-600">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={() => {
            if (selectedPlan?.name === 'student') {
              setStep('configure-student');
            } else {
              setStep('select-plan');
            }
          }}
          disabled={loading}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleConfirmSubscription}
          disabled={loading}
          className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? 'Processing...' : 'Confirm'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Manage Subscription</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {step === 'select-plan' && renderPlanSelection()}
          {step === 'configure-student' && renderStudentConfiguration()}
          {step === 'confirm' && renderConfirmation()}
        </div>
      </div>
    </div>
  );
}
