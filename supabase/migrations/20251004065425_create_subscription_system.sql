/*
  # Create Subscription and Monetization System

  ## Overview
  This migration creates a comprehensive subscription system with three tiers:
  - **Free**: 10 questions/month, 2 papers max, no chat persistence
  - **Student**: One grade + 8 subjects, chat persistence, recurring/one-time
  - **Pro**: All grades/subjects, chat persistence, PDF export, recurring/one-time

  ## New Tables

  ### `subscription_plans`
  Defines available subscription plans with pricing and limits
  - `id` (uuid, primary key)
  - `name` (text) - Plan name: 'free', 'student', 'pro'
  - `display_name` (text) - Display name for UI
  - `monthly_price` (numeric) - Monthly price in dollars
  - `yearly_price` (numeric) - Yearly price in dollars
  - `features` (jsonb) - Plan features and limits
  - `is_active` (boolean) - Whether plan is available for purchase
  - `created_at`, `updated_at` (timestamptz)

  ### `user_subscriptions`
  Tracks user subscription status and entitlements
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `plan_id` (uuid, foreign key to subscription_plans)
  - `billing_cycle` (text) - 'monthly', 'yearly', 'one_time'
  - `status` (text) - 'active', 'expired', 'cancelled'
  - `selected_grade_id` (uuid, nullable) - For Student plan
  - `selected_subject_ids` (uuid[]) - For Student plan (max 8)
  - `started_at` (timestamptz)
  - `expires_at` (timestamptz, nullable)
  - `cancelled_at` (timestamptz, nullable)
  - `created_at`, `updated_at` (timestamptz)

  ### `user_usage_tracking`
  Tracks usage for free tier limits
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `month_year` (text) - Format: 'YYYY-MM'
  - `questions_asked` (integer) - Count of questions this month
  - `papers_accessed` (uuid[]) - List of paper IDs accessed
  - `created_at`, `updated_at` (timestamptz)

  ### `subscription_config`
  Admin-configurable limits and settings
  - `id` (uuid, primary key)
  - `key` (text, unique) - Config key
  - `value` (jsonb) - Config value
  - `description` (text)
  - `updated_at` (timestamptz)

  ### `purchase_history`
  Records all subscription purchases
  - `id` (uuid, primary key)
  - `user_id` (uuid, foreign key to auth.users)
  - `subscription_id` (uuid, foreign key to user_subscriptions)
  - `plan_id` (uuid, foreign key to subscription_plans)
  - `amount` (numeric)
  - `billing_cycle` (text)
  - `payment_method` (text)
  - `transaction_id` (text, nullable)
  - `status` (text) - 'completed', 'pending', 'failed'
  - `purchased_at` (timestamptz)

  ## Security
  - All tables have RLS enabled
  - Users can only access their own data
  - Admins have full access to all tables

  ## Important Notes
  1. Free tier is automatically assigned to new users
  2. Chat persistence is controlled by subscription tier
  3. Student plan requires grade and subject selection
  4. Pro plan downgrades retain chats in read-only mode
*/

-- Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name IN ('free', 'student', 'pro')),
  display_name text NOT NULL,
  monthly_price numeric(10,2) NOT NULL DEFAULT 0,
  yearly_price numeric(10,2) NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'one_time')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  selected_grade_id uuid REFERENCES grade_levels(id) ON DELETE SET NULL,
  selected_subject_ids uuid[] DEFAULT ARRAY[]::uuid[],
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_usage_tracking table
CREATE TABLE IF NOT EXISTS user_usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  questions_asked integer NOT NULL DEFAULT 0,
  papers_accessed uuid[] DEFAULT ARRAY[]::uuid[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Create subscription_config table
CREATE TABLE IF NOT EXISTS subscription_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Create purchase_history table
CREATE TABLE IF NOT EXISTS purchase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL,
  billing_cycle text NOT NULL,
  payment_method text,
  transaction_id text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed')),
  purchased_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_usage_tracking_user_month ON user_usage_tracking(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_purchase_history_user_id ON purchase_history(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_history_purchased_at ON purchase_history(purchased_at DESC);

-- Enable RLS on all tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscription_plans (public read, admin write)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON user_subscriptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all subscriptions"
  ON user_subscriptions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for user_usage_tracking
CREATE POLICY "Users can view own usage"
  ON user_usage_tracking FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own usage"
  ON user_usage_tracking FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all usage"
  ON user_usage_tracking FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for subscription_config (admins only)
CREATE POLICY "Anyone can view subscription config"
  ON subscription_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage subscription config"
  ON subscription_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for purchase_history
CREATE POLICY "Users can view own purchase history"
  ON purchase_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchase history"
  ON purchase_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert purchase records"
  ON purchase_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, monthly_price, yearly_price, features) VALUES
  ('free', 'Free Tier', 0, 0, '{
    "questions_per_month": 10,
    "max_papers": 2,
    "chat_persistence": false,
    "pdf_export": false,
    "all_grades": false,
    "all_subjects": false
  }'::jsonb),
  ('student', 'Student Package', 9.99, 99.99, '{
    "questions_per_month": -1,
    "max_papers": -1,
    "chat_persistence": true,
    "pdf_export": false,
    "all_grades": false,
    "all_subjects": false,
    "grade_limit": 1,
    "subject_limit": 8
  }'::jsonb),
  ('pro', 'Pro Package', 19.99, 199.99, '{
    "questions_per_month": -1,
    "max_papers": -1,
    "chat_persistence": true,
    "pdf_export": true,
    "all_grades": true,
    "all_subjects": true
  }'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Insert default configuration
INSERT INTO subscription_config (key, value, description) VALUES
  ('free_questions_limit', '10', 'Maximum questions per month for free tier'),
  ('free_papers_limit', '2', 'Maximum papers accessible for free tier'),
  ('student_subject_limit', '8', 'Maximum subjects for student plan'),
  ('student_grade_limit', '1', 'Maximum grades for student plan')
ON CONFLICT (key) DO NOTHING;

-- Function to automatically assign free tier to new users
CREATE OR REPLACE FUNCTION assign_free_tier_to_new_user()
RETURNS TRIGGER AS $$
DECLARE
  free_plan_id uuid;
BEGIN
  SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'free' LIMIT 1;
  
  IF free_plan_id IS NOT NULL THEN
    INSERT INTO user_subscriptions (user_id, plan_id, billing_cycle, status)
    VALUES (NEW.id, free_plan_id, 'one_time', 'active');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to assign free tier when profile is created
DROP TRIGGER IF EXISTS trigger_assign_free_tier ON profiles;
CREATE TRIGGER trigger_assign_free_tier
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_free_tier_to_new_user();

-- Function to get current user's active subscription with plan details
CREATE OR REPLACE FUNCTION get_user_subscription()
RETURNS TABLE (
  subscription_id uuid,
  plan_name text,
  display_name text,
  status text,
  features jsonb,
  selected_grade_id uuid,
  selected_subject_ids uuid[],
  expires_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    sp.name,
    sp.display_name,
    us.status,
    sp.features,
    us.selected_grade_id,
    us.selected_subject_ids,
    us.expires_at
  FROM user_subscriptions us
  JOIN subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = auth.uid()
    AND us.status = 'active'
  ORDER BY us.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access a specific paper
CREATE OR REPLACE FUNCTION can_access_paper(paper_id uuid)
RETURNS boolean AS $$
DECLARE
  user_sub record;
  paper_info record;
BEGIN
  SELECT * INTO user_sub FROM get_user_subscription() LIMIT 1;
  
  IF user_sub IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT grade_level_id, subject_id INTO paper_info
  FROM exam_papers
  WHERE id = paper_id;
  
  IF user_sub.plan_name = 'pro' THEN
    RETURN true;
  END IF;
  
  IF user_sub.plan_name = 'student' THEN
    RETURN (
      paper_info.grade_level_id = user_sub.selected_grade_id AND
      paper_info.subject_id = ANY(user_sub.selected_subject_ids)
    );
  END IF;
  
  IF user_sub.plan_name = 'free' THEN
    DECLARE
      current_month text := to_char(now(), 'YYYY-MM');
      usage_record record;
      free_limit integer;
    BEGIN
      SELECT * INTO usage_record
      FROM user_usage_tracking
      WHERE user_id = auth.uid() AND month_year = current_month;
      
      SELECT (value::text)::integer INTO free_limit
      FROM subscription_config
      WHERE key = 'free_papers_limit';
      
      IF usage_record IS NOT NULL THEN
        RETURN array_length(usage_record.papers_accessed, 1) < free_limit 
               OR paper_id = ANY(usage_record.papers_accessed);
      END IF;
      
      RETURN true;
    END;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track paper access
CREATE OR REPLACE FUNCTION track_paper_access(paper_id uuid)
RETURNS void AS $$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO user_usage_tracking (user_id, month_year, papers_accessed)
  VALUES (auth.uid(), current_month, ARRAY[paper_id])
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    papers_accessed = array_append(
      CASE 
        WHEN paper_id = ANY(user_usage_tracking.papers_accessed) THEN user_usage_tracking.papers_accessed
        ELSE array_append(user_usage_tracking.papers_accessed, paper_id)
      END,
      NULL
    ),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track question asked
CREATE OR REPLACE FUNCTION track_question_asked()
RETURNS void AS $$
DECLARE
  current_month text := to_char(now(), 'YYYY-MM');
BEGIN
  INSERT INTO user_usage_tracking (user_id, month_year, questions_asked)
  VALUES (auth.uid(), current_month, 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET
    questions_asked = user_usage_tracking.questions_asked + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
