export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'student'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'student'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'student'
          created_at?: string
          updated_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      grade_levels: {
        Row: {
          id: string
          name: string
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      exam_papers: {
        Row: {
          id: string
          title: string
          subject_id: string
          grade_level_id: string
          year: number
          pdf_url: string
          pdf_path: string
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          subject_id: string
          grade_level_id: string
          year: number
          pdf_url: string
          pdf_path: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          subject_id?: string
          grade_level_id?: string
          year?: number
          pdf_url?: string
          pdf_path?: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      marking_schemes: {
        Row: {
          id: string
          exam_paper_id: string
          pdf_url: string
          pdf_path: string
          uploaded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam_paper_id: string
          pdf_url: string
          pdf_path: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam_paper_id?: string
          pdf_url?: string
          pdf_path?: string
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          exam_paper_id: string
          title: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exam_paper_id: string
          title: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exam_paper_id?: string
          title?: string
          created_at?: string
          updated_at?: string
        }
      }
      conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
      }
      subscription_plans: {
        Row: {
          id: string
          name: 'free' | 'student' | 'pro'
          display_name: string
          monthly_price: number
          yearly_price: number
          features: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: 'free' | 'student' | 'pro'
          display_name: string
          monthly_price?: number
          yearly_price?: number
          features?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: 'free' | 'student' | 'pro'
          display_name?: string
          monthly_price?: number
          yearly_price?: number
          features?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_subscriptions: {
        Row: {
          id: string
          user_id: string
          plan_id: string
          billing_cycle: 'monthly' | 'yearly' | 'one_time'
          status: 'active' | 'expired' | 'cancelled'
          selected_grade_id: string | null
          selected_subject_ids: string[]
          started_at: string
          expires_at: string | null
          cancelled_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan_id: string
          billing_cycle: 'monthly' | 'yearly' | 'one_time'
          status?: 'active' | 'expired' | 'cancelled'
          selected_grade_id?: string | null
          selected_subject_ids?: string[]
          started_at?: string
          expires_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan_id?: string
          billing_cycle?: 'monthly' | 'yearly' | 'one_time'
          status?: 'active' | 'expired' | 'cancelled'
          selected_grade_id?: string | null
          selected_subject_ids?: string[]
          started_at?: string
          expires_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_usage_tracking: {
        Row: {
          id: string
          user_id: string
          month_year: string
          questions_asked: number
          papers_accessed: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          month_year: string
          questions_asked?: number
          papers_accessed?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month_year?: string
          questions_asked?: number
          papers_accessed?: string[]
          created_at?: string
          updated_at?: string
        }
      }
      subscription_config: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          updated_at?: string
        }
      }
      purchase_history: {
        Row: {
          id: string
          user_id: string
          subscription_id: string | null
          plan_id: string
          amount: number
          billing_cycle: string
          payment_method: string | null
          transaction_id: string | null
          status: 'completed' | 'pending' | 'failed'
          purchased_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subscription_id?: string | null
          plan_id: string
          amount: number
          billing_cycle: string
          payment_method?: string | null
          transaction_id?: string | null
          status?: 'completed' | 'pending' | 'failed'
          purchased_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subscription_id?: string | null
          plan_id?: string
          amount?: number
          billing_cycle?: string
          payment_method?: string | null
          transaction_id?: string | null
          status?: 'completed' | 'pending' | 'failed'
          purchased_at?: string
        }
      }
      exam_questions: {
        Row: {
          id: string
          exam_paper_id: string
          question_number: string
          page_numbers: number[]
          image_urls: string[]
          image_paths: string[]
          ocr_text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          exam_paper_id: string
          question_number: string
          page_numbers?: number[]
          image_urls?: string[]
          image_paths?: string[]
          ocr_text?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          exam_paper_id?: string
          question_number?: string
          page_numbers?: number[]
          image_urls?: string[]
          image_paths?: string[]
          ocr_text?: string
          created_at?: string
          updated_at?: string
        }
      }
      marking_scheme_questions: {
        Row: {
          id: string
          marking_scheme_id: string
          question_number: string
          page_numbers: number[]
          image_urls: string[]
          image_paths: string[]
          ocr_text: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          marking_scheme_id: string
          question_number: string
          page_numbers?: number[]
          image_urls?: string[]
          image_paths?: string[]
          ocr_text?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          marking_scheme_id?: string
          question_number?: string
          page_numbers?: number[]
          image_urls?: string[]
          image_paths?: string[]
          ocr_text?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
