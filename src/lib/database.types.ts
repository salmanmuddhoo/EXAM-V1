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
      chat_conversations: {
        Row: {
          id: string
          student_id: string | null
          exam_paper_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id?: string | null
          exam_paper_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string | null
          exam_paper_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
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
