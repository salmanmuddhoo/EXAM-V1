# Exam Study Assistant - Setup Instructions

This AI-powered exam study assistant helps students learn through interactive guidance on exam papers.

## Features

- **Professional Landing Page**: Modern homepage showcasing features and benefits
- **Hierarchical Navigation**: Organized exam papers by Grade → Subject → Papers in navbar menu
- **Auth-Gated AI Chat**: Students can view PDFs publicly, but must sign in to chat with AI
- **Admin Portal**: Admins can upload exam papers with instant PDF preview and AI processing
- **In-App PDF Viewer**: PDFs load directly in the app (no external tabs)
- **Mobile Optimized**: Responsive design with collapsible navigation
- **Black & White Design**: Clean, minimal interface
- **AI Assistant**: Gemini-powered chat providing structured answers with:
  - Clear explanations
  - Practical examples
  - Tips for full marks
  - Complete solutions

## Getting Started

### 1. Configure Gemini API Key

The application uses Google's Gemini AI. You need to set up your API key:

1. Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Set the environment variable in your Supabase project:
   - Go to your Supabase Dashboard
   - Navigate to Settings → Edge Functions → Secrets
   - Add a new secret: `GEMINI_API_KEY` with your API key value

### 2. Create Your First Admin Account

1. Open the application
2. Click "Sign In" in the top right
3. Click "Don't have an account? Sign up"
4. Fill in your details and select "Admin" as account type
5. Sign up and log in

**Note**: Admin access is controlled at the application level. Only users who sign up with the "Admin" role will see the admin dashboard when they log in.

### 3. Set Up Content

Once logged in as admin, you'll see the admin dashboard:

1. **Add Subjects**: Go to Subjects tab and add subjects (e.g., Mathematics, Physics, Chemistry)
2. **Add Grade Levels**: Go to Grade Levels tab and add grades (e.g., Grade 9, Grade 10)
3. **Upload Exam Papers**: Go to Exam Papers tab and upload:
   - Exam paper title
   - Select subject and grade
   - Upload exam paper PDF (required)
   - Upload marking scheme PDF (optional but recommended for better AI responses)

### 4. Test the Student Experience

1. Visit the homepage to see the professional landing page
2. Navigate through exam papers using the navbar menu: Grade → Subject → Papers
3. Click on any paper to open the viewer
4. View the PDF (no login required)
5. Try to use the chat - you'll be prompted to sign in
6. Sign in and chat with the AI for help with exam questions

## Usage Tips

### For Admins:
- Upload marking schemes along with exam papers for more accurate AI guidance
- Organize papers by subject and grade level for easy navigation
- Use descriptive titles for exam papers

### For Students:
- Ask specific questions about exam problems
- Request clarification on concepts
- Ask for examples or alternative solutions
- The AI provides structured responses to help you learn effectively

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Storage + Edge Functions)
- **AI**: Google Gemini API for intelligent responses
- **Storage**: PDFs stored in Supabase Storage with public access
- **Authentication**: Supabase Auth with role-based access (admin/student)

## Support

The application is designed to work seamlessly. If you encounter any issues:
- Ensure your Gemini API key is correctly configured
- Check that PDFs are under 50MB in size
- Verify that subjects and grades are created before uploading papers
