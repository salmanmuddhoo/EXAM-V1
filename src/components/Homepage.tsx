import { BookOpen, Brain, CheckCircle, ArrowRight, Sparkles, Crown, Gift, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Props {
  onGetStarted: () => void;
}

interface PlanFeatures {
  questions_per_month: number;
  max_papers: number;
  chat_persistence: boolean;
  pdf_export: boolean;
  all_grades: boolean;
  all_subjects: boolean;
  grade_limit?: number;
  subject_limit?: number;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
  monthly_price: number;
  yearly_price: number;
  features: PlanFeatures;
}

export function Homepage({ onGetStarted }: Props) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetchPlans();
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
    } catch (error) {
      console.error('Error fetching plans:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-20 sm:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Master Your Exams with AI-Powered Study Assistant
            </h1>
            <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed">
              Access past exam papers with an intelligent AI tutor that guides you through
              every question, providing detailed explanations and personalized learning support.
            </p>
            <button
              onClick={onGetStarted}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Everything You Need to Succeed
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<BookOpen className="w-8 h-8" />}
              title="Comprehensive Exam Library"
              description="Access a growing collection of past exam papers organized by grade level and subject, all in one place."
            />
            <FeatureCard
              icon={<Brain className="w-8 h-8" />}
              title="AI-Powered Learning"
              description="Get instant, intelligent responses to your questions. Our AI tutor provides step-by-step explanations and practical examples."
            />
            <FeatureCard
              icon={<Zap className="w-8 h-8" />}
              title="Interactive Study Experience"
              description="View exam papers alongside AI chat. Ask questions, request clarifications, and learn at your own pace."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Choose Your Plan
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Start free or unlock premium features with our flexible plans
            </p>
            <div className="inline-flex items-center bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === 'monthly'
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  billingCycle === 'yearly'
                    ? 'bg-black text-white'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Yearly
                <span className="ml-1.5 text-xs">(Save 17%)</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                billingCycle={billingCycle}
                onGetStarted={onGetStarted}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step
              number="1"
              title="Browse Exam Papers"
              description="Navigate through organized exam papers by grade level and subject using our intuitive menu."
            />
            <Step
              number="2"
              title="View & Study"
              description="Open any exam paper to view it directly in your browser. No downloads needed."
            />
            <Step
              number="3"
              title="Ask the AI Tutor"
              description="Get help on any question. Our AI provides detailed explanations, examples, and tips to help you understand every concept."
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Why Students Love Our Platform
              </h2>
              <div className="space-y-4">
                <Benefit text="Learn at your own pace with 24/7 AI assistance" />
                <Benefit text="Get detailed explanations for every exam question" />
                <Benefit text="Access marking schemes for better understanding" />
                <Benefit text="Practice with real past exam papers" />
                <Benefit text="No downloads required - everything works in your browser" />
                <Benefit text="Free access to all exam papers and AI assistance" />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-8 border border-gray-200">
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="bg-black text-white rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0 font-bold">
                    ?
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium mb-1">Student Question</p>
                    <p className="text-gray-600 text-sm">How do I solve question 3 part (a)?</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="bg-gray-100 text-gray-900 rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-900 font-medium mb-1">AI Tutor Response</p>
                    <p className="text-gray-600 text-sm">
                      Let me break down question 3(a) for you. First, identify the key information given...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Start Learning?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Sign up now to unlock the full potential of AI-powered exam preparation.
          </p>
          <button
            onClick={onGetStarted}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors text-lg font-medium"
          >
            <span>Sign Up Free</span>
            <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-sm text-gray-500 mt-4">
            No credit card required. Start learning in seconds.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center text-gray-600 text-sm">
            <p>&copy; {new Date().getFullYear()} Exam Study Assistant. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-lg mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-black text-white rounded-full mb-4 text-xl font-bold">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <div className="flex items-start space-x-3">
      <CheckCircle className="w-6 h-6 text-black flex-shrink-0 mt-0.5" />
      <span className="text-gray-700">{text}</span>
    </div>
  );
}

function PricingCard({
  plan,
  billingCycle,
  onGetStarted
}: {
  plan: Plan;
  billingCycle: 'monthly' | 'yearly';
  onGetStarted: () => void;
}) {
  const price = billingCycle === 'monthly' ? plan.monthly_price : plan.yearly_price;
  const isPopular = plan.name === 'student';
  const isFree = plan.name === 'free';
  const isPro = plan.name === 'pro';

  const getIcon = () => {
    if (isFree) return <Gift className="w-6 h-6" />;
    if (isPro) return <Crown className="w-6 h-6" />;
    return <Sparkles className="w-6 h-6" />;
  };

  const getFeatureList = () => {
    const features = [];

    if (isFree) {
      features.push(`${plan.features.questions_per_month} questions per month`);
      features.push(`Access up to ${plan.features.max_papers} exam papers`);
      features.push('AI tutor assistance');
      features.push('No chat history saved');
    } else if (plan.name === 'student') {
      features.push('Unlimited questions');
      features.push('1 grade level');
      features.push('Up to 8 subjects');
      features.push('All years available');
      features.push('Chat history saved');
      features.push('Access to marking schemes');
    } else if (isPro) {
      features.push('Everything in Student');
      features.push('All grade levels');
      features.push('All subjects');
      features.push('Export chats to PDF');
      features.push('Priority support');
      features.push('Early access to new features');
    }

    return features;
  };

  return (
    <div className={`relative bg-white rounded-lg shadow-sm border-2 transition-all hover:shadow-lg ${
      isPopular ? 'border-black' : 'border-gray-200'
    }`}>
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
          <span className="bg-black text-white text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2 rounded-lg ${isFree ? 'bg-gray-100' : isPro ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>
            {getIcon()}
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">{plan.display_name}</h3>
          </div>
        </div>

        <div className="mb-6">
          {isFree ? (
            <div className="flex items-baseline">
              <span className="text-4xl font-bold text-gray-900">Free</span>
            </div>
          ) : (
            <div className="flex items-baseline">
              <span className="text-4xl font-bold text-gray-900">${price}</span>
              <span className="text-gray-600 ml-2">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
            </div>
          )}
        </div>

        <button
          onClick={onGetStarted}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors mb-6 ${
            isPopular || isPro
              ? 'bg-black text-white hover:bg-gray-800'
              : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
          }`}
        >
          {isFree ? 'Start Free' : 'Get Started'}
        </button>

        <div className="space-y-3">
          {getFeatureList().map((feature, index) => (
            <div key={index} className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
