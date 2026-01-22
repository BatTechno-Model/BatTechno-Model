# BatTechno Model

A beautiful, mobile-app-like platform for BatTechno full-stack courses. Manage courses, sessions, attendance, assignments, and student submissions with a modern, RTL-ready interface.

## 🚀 Features

- **Course Management**: Create and manage courses with student enrollment
- **Session Scheduling**: Schedule lecture sessions with dates and times
- **Attendance System**: Mark attendance (Present/Absent/Late/Excused) with export capabilities
- **Assignments**: Create assignments with rubrics, students submit with files/links
- **Review System**: Instructors review submissions with scoring and feedback
- **Pre/Post Exams**: Create internal exams (PRE and POST) with auto-grading, random question selection, and scoring normalized to out of 10
- **CV Profile System**: Comprehensive profile with conditional student fields, skills, interests, portfolio links
- **Smart Suggestions**: Autocomplete suggestions for country, city, university, major, skills, and interests (filtered by country)
- **Admin Students Directory**: Search, filter, and view all students with performance metrics
- **Student Reports**: Detailed reports with attendance, assignments, exams, overall score, alerts, and recommendations
- **PDF Export**: Download branded student reports as PDF (admin only)
- **Performance Metrics**: Automatic calculation of overall scores, alerts, and personalized recommendations
- **Mobile-First UI**: Beautiful, app-like interface with bottom navigation
- **RTL Support**: Full Arabic (RTL) and English (LTR) support with i18n
- **Animations**: Smooth transitions and micro-interactions with Framer Motion

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- Git

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "BatTechno Model"
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your database URL and secrets:

```env
DATABASE_URL="postgresql://user:password@host:5432/battechno?schema=public"
JWT_ACCESS_SECRET="your-super-secret-access-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=5000
NODE_ENV=development
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=10485760
FRONTEND_URL="http://localhost:5173"
```

### 3. Database Setup (Neon)

**Option A: Using Neon SQL Editor (Recommended for quick setup)**

1. Create a new project in [Neon](https://neon.tech)
2. Copy your connection string
3. Open Neon Console → SQL Editor
4. Copy and paste the **entire contents** of `database/neon_schema.sql`
5. Click "Run" to execute the script
6. All tables, indexes, and constraints will be created

**Option B: Using Prisma Migrations**

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

**Important**: The `neon_schema.sql` file includes all tables including Profile, SuggestionValue, and StudentCourseMetrics. Make sure to run the complete script.

### 4. Seed Database

```bash
cd backend
npm run seed
```

This creates:
- Admin user: `admin@battechno.com` / `admin123`
- Instructor: `instructor@battechno.com` / `instructor123`
- 3 Students: `student1@battechno.com` / `student123` (and student2, student3)
- Sample course, sessions, attendance, and assignment

### 5. Start Backend Server

```bash
cd backend
npm run dev
```

Backend runs on `http://localhost:5000`

### 6. Frontend Setup

Open a new terminal:

```bash
cd frontend
npm install
```

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 7. Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on `http://localhost:5173`

## 📱 Usage

1. Open `http://localhost:5173` in your browser
2. Login with:
   - **Admin**: `admin@battechno.com` / `admin123`
   - **Instructor**: `instructor@battechno.com` / `instructor123`
   - **Student**: `student1@battechno.com` / `student123`

## 🗂️ Project Structure

```
BatTechno Model/
├── backend/
│   ├── config/          # Database configuration
│   ├── middleware/      # Auth middleware
│   ├── routes/          # API routes
│   ├── utils/           # Utilities (upload, validation)
│   ├── prisma/          # Prisma schema and seed
│   ├── uploads/         # Uploaded files (created automatically)
│   └── server.js        # Express server
├── frontend/
│   ├── src/
│   │   ├── components/ # Reusable components
│   │   ├── context/    # React context (Auth)
│   │   ├── pages/       # Page components
│   │   ├── i18n/        # Internationalization
│   │   └── utils/       # API utilities
│   └── public/
└── database/
    └── neon_schema.sql  # PostgreSQL schema for Neon
```

## 🔑 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user

### Courses
- `GET /api/v1/courses` - List courses
- `GET /api/v1/courses/:id` - Get course details
- `POST /api/v1/courses` - Create course (Admin/Instructor)
- `PUT /api/v1/courses/:id` - Update course
- `DELETE /api/v1/courses/:id` - Delete course
- `POST /api/v1/courses/:id/enrollments` - Enroll students

### Sessions
- `GET /api/v1/sessions/course/:courseId` - List sessions
- `POST /api/v1/sessions` - Create session
- `POST /api/v1/sessions/bulk` - Bulk create sessions

### Attendance
- `GET /api/v1/attendance/session/:sessionId` - Get attendance for session
- `POST /api/v1/attendance/bulk` - Bulk update attendance
- `GET /api/v1/attendance/course/:courseId/summary` - Course attendance summary

### Assignments
- `GET /api/v1/assignments/course/:courseId` - List assignments
- `POST /api/v1/assignments` - Create assignment
- `GET /api/v1/assignments/:id` - Get assignment details

### Submissions
- `POST /api/v1/submissions` - Create submission (with file upload)
- `GET /api/v1/submissions/assignment/:assignmentId` - List submissions
- `PATCH /api/v1/submissions/:id/status` - Update submission status

### Reviews
- `POST /api/v1/reviews` - Create/update review
- `GET /api/v1/reviews/submission/:submissionId` - Get reviews

### Exams (Admin)
- `POST /api/v1/sessions/:sessionId/exams` - Create exam (PRE or POST)
- `GET /api/v1/sessions/:sessionId/exams` - List exams for session
- `GET /api/v1/exams/:examId` - Get exam details
- `PUT /api/v1/exams/:examId` - Update exam
- `PUT /api/v1/exams/:examId/status` - Update exam status (DRAFT/PUBLISHED/LOCKED)
- `POST /api/v1/exams/:examId/questions` - Add question to exam
- `PUT /api/v1/questions/:questionId` - Update question
- `DELETE /api/v1/questions/:questionId` - Delete question
- `GET /api/v1/sessions/:sessionId/exams/analytics` - Get exam analytics for session
- `GET /api/v1/courses/:courseId/exams/analytics` - Get exam analytics for course

### Exams (Student)
- `GET /api/v1/my/exams` - Get available exams
- `POST /api/v1/exams/:examId/attempts/start` - Start exam attempt (random questions selected)
- `POST /api/v1/attempts/:attemptId/answer` - Submit answer (autosave)
- `POST /api/v1/attempts/:attemptId/submit` - Submit exam attempt (auto-graded, score out of 10)
- `GET /api/v1/my/exams/:examId/result` - Get exam result

### Profile
- `GET /api/v1/profile` - Get current user's profile
- `PUT /api/v1/profile` - Update current user's profile

### Suggestions (Autocomplete)
- `GET /api/v1/suggestions?key=country&q=jo` - Get suggestions for country
- `GET /api/v1/suggestions?key=city&q=am&country=Jordan` - Get city suggestions (filtered by country)
- `GET /api/v1/suggestions?key=university&q=uni&country=Jordan` - Get university suggestions
- `GET /api/v1/suggestions?key=major&q=soft` - Get major suggestions
- `GET /api/v1/suggestions?key=skills&q=re` - Get skill suggestions
- `GET /api/v1/suggestions?key=interests&q=fr` - Get interest suggestions

### Admin - Students Directory
- `GET /api/v1/admin/students` - List students with filters (search, city, country, isStudent, courseId, alertType, lowPerformance, pagination)
- `GET /api/v1/admin/students/:studentId/report` - Get detailed student report
- `GET /api/v1/admin/students/:studentId/report.pdf` - Download student report as PDF

## 🎨 Tech Stack

### Backend
- Node.js + Express
- PostgreSQL (Neon)
- Prisma ORM
- JWT Authentication
- Multer (file uploads)
- Zod (validation)

### Frontend
- React 18 (Vite)
- TailwindCSS
- Framer Motion (animations)
- React Router
- TanStack Query
- i18next (Arabic/English)
- React Hook Form + Zod

## 📝 Environment Variables

### Backend (.env)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_ACCESS_SECRET` - JWT access token secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `PORT` - Server port (default: 5000)
- `FRONTEND_URL` - Frontend URL for CORS

### Frontend (.env)
- `VITE_API_URL` - Backend API URL

## 📝 Using Profile & CV Features

### Editing Your Profile

1. Navigate to **Profile** from the bottom navigation
2. Fill in your information:
   - **Full Name**: Must contain at least 4 words
   - **Is Student**: Toggle to show/hide student-specific fields
   - **Country/City**: Use autocomplete suggestions (defaults to Jordan/Amman)
   - **Phone, Nationality, Bio**: Optional personal information
   - **Skills & Interests**: Add multiple items using the array input
   - **Portfolio Links**: GitHub, LinkedIn, Website URLs
   - **Emergency Contact**: Optional contact information

### Student-Specific Fields

When "Is Student" is enabled, additional fields appear:
- **University**: Required (with autocomplete suggestions filtered by country)
- **Major**: Required (with autocomplete suggestions)
- **Education Level**: Optional (Bachelor/Master/PhD)
- **Graduation Year**: Optional

### Smart Suggestions

The system learns from previous user inputs and provides autocomplete suggestions:
- **Country**: No filtering
- **City**: Filtered by selected country
- **University**: Filtered by selected country
- **Major**: No filtering
- **Skills & Interests**: No filtering
- **Heard From**: No filtering

Suggestions are ranked by:
1. Prefix matches first
2. Usage count (most used first)
3. Recently used first

**Note**: When you change the country, city and university suggestions refresh automatically. Invalid selections are cleared with confirmation.

## 📝 Using Admin Features

### Students Directory

1. Navigate to `/admin/students` (Admin only)
2. Use filters to search students:
   - **Search**: By name or email
   - **Country/City**: Filter by location
   - **Is Student**: Filter by student status
   - **Alert Type**: Filter by alert type (HIGH_ABSENCE, MISSING_ASSIGNMENTS, LOW_EXAMS, NO_ACTIVITY_14_DAYS)
   - **Low Performance**: Show only students with overall score < 60
3. View student metrics:
   - Overall Score (0-100)
   - Alerts count and badges
   - Course enrollment
4. Click on a student row or "View" button to see detailed report

### Student Report

1. Access from Students Directory or navigate to `/admin/students/:studentId/report`
2. View comprehensive information:
   - **Profile Overview**: All profile fields
   - **Course Performance**: Per-course breakdown:
     - Attendance summary (total, present, absent, late, excused, rate)
     - Assignments summary (total, submitted, approved, needs changes, completion rate, quality score)
     - Exams/Quizzes summary (attempts, average score)
     - Overall Score (0-100)
     - Alerts (if any)
     - Recommendations (personalized suggestions)
   - **Recent Activity**: Timeline of last 14 days (attendance, submissions, quiz/exam attempts)
3. **Download PDF**: Click "Download PDF" button to generate a branded report

### Performance Metrics

The system automatically calculates:
- **Overall Score** (0-100): Weighted combination of:
  - Attendance: 30%
  - Assignments: 40% (50% completion + 50% quality)
  - Exams/Quizzes: 30%
  - Weights auto-adjust if modules are missing

- **Alerts**:
  - `HIGH_ABSENCE`: Attendance rate < 75%
  - `MISSING_ASSIGNMENTS`: Assignment completion < 70%
  - `LOW_EXAMS`: Exam average < 6/10
  - `NO_ACTIVITY_14_DAYS`: No activity in last 14 days

- **Recommendations**: Personalized suggestions based on:
  - Alert types
  - Weak quiz topics (if available)
  - Assignment struggles (Frontend/Backend inference)

Metrics are recomputed automatically when:
- Attendance is updated
- Assignment submission/review is updated
- Exam attempt is submitted

## 📝 Using Exams Feature

### For Admins/Instructors

#### Creating an Exam
1. Navigate to a course and open a session
2. In the session details, find the "Exams" section
3. Click "Create Pre-Exam" or "Create Post-Exam"
4. Fill in exam details:
   - **Title**: Exam title
   - **Description**: Optional description
   - **Exam Question Count**: Number of questions to show per attempt (e.g., 10)
   - **Time Limit**: Optional time limit in minutes
   - **Attempts Allowed**: Number of attempts (default: 1)
   - **Show Solutions After Submit**: Enable to show correct answers after submission
   - **Available From/To**: Optional availability window
5. Click "Save" to create the exam

#### Building Question Bank
1. After creating an exam, you'll see the "Exam Question Bank" section
2. Click "Add Exam Question"
3. Choose question type:
   - **MCQ**: Multiple choice with 2+ choices
     - Enter prompt
     - Add choices (click "Add Choice" for more)
     - Select correct choice index (starts from 0)
     - Set points
   - **TRUE_FALSE**: True/False question
     - Enter prompt
     - Select correct answer (True/False)
     - Set points
4. Click "Save" to add the question
5. Repeat to build your question bank

**Important**: The `examQuestionCount` determines how many questions are randomly selected from your question bank for each student attempt. For example, if you have 30 questions and set `examQuestionCount` to 10, each student will get 10 random questions.

#### Publishing Exams
1. After adding questions, click "Publish Exam" to make it available to students
2. Use "Lock Exam" to prevent new attempts while keeping analytics accessible
3. View analytics by clicking "View Exam Analytics" to see student scores

### For Students

#### Taking an Exam
1. Available exams appear on your Dashboard and in session details
2. Click "Take Exam" to start
3. Answer questions one by one (answers are auto-saved)
4. Use Previous/Next to navigate
5. Timer shows remaining time if enabled
6. Click "Submit Exam" when finished

#### Viewing Results
1. After submission, you'll see your score out of 10
2. If solutions are enabled, you can review correct answers
3. View improvement if both PRE and POST exams are completed

### Scoring System

- **Raw Score**: Sum of points for correct answers
- **Max Raw Score**: Sum of points for all questions in the attempt
- **Final Score (out of 10)**: `(rawScore / maxRawScore) * 10`, rounded to 1 decimal
- **Percentage**: `(rawScore / maxRawScore) * 100`

Example: If a student gets 8 out of 10 questions correct (each worth 1 point), the final score is `(8/10) * 10 = 8.0/10`.

### Analytics

Admins can view:
- Student names and scores
- PRE exam scores (out of 10)
- POST exam scores (out of 10)
- Improvement (delta between POST and PRE)
- Access via session or course level analytics

## ✅ Verification Checklist

- [ ] Backend server starts without errors
- [ ] Frontend dev server starts without errors
- [ ] Database tables created successfully (including Profile, SuggestionValue, StudentCourseMetrics)
- [ ] Seed script runs and creates sample data
- [ ] Can login with admin/instructor/student accounts
- [ ] Can edit profile with all fields (Profile page)
- [ ] Autocomplete suggestions work (country, city, university, major, skills, interests)
- [ ] Conditional student fields appear/disappear correctly
- [ ] Can create a course (as admin/instructor)
- [ ] Can enroll students in a course
- [ ] Can create sessions
- [ ] Can mark attendance
- [ ] Can create assignments
- [ ] Can submit assignments (as student)
- [ ] Can review submissions (as instructor)
- [ ] Can create exams (PRE and POST) with question bank
- [ ] Can take exams as student (random questions selected)
- [ ] Exam scoring works correctly (out of 10)
- [ ] Exam analytics show student scores and improvement
- [ ] Admin can access Students Directory (`/admin/students`)
- [ ] Admin can view Student Reports with all sections
- [ ] Admin can download Student Report PDF
- [ ] Performance metrics are calculated correctly (overall score, alerts, recommendations)
- [ ] Language toggle works (AR/EN)
- [ ] Bottom navigation works
- [ ] All buttons and links functional
- [ ] No console errors

## 🐛 Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` in `.env` is correct
- Check Neon project is active
- Ensure IP allowlist allows your IP (if applicable)

### CORS Errors
- Verify `FRONTEND_URL` in backend `.env` matches frontend URL
- Check backend server is running

### File Upload Issues
- Ensure `uploads/` directory exists in backend
- Check file size limits in `.env`

### Prisma Issues
- Run `npx prisma generate` after schema changes
- Run `npx prisma migrate dev` to sync database

### Exam Migration Issues
- If exam tables don't exist, run: `cd backend && npx prisma migrate dev --name add_exams`
- Or manually execute SQL from `database/neon_schema.sql` (exam tables section)

## 📄 License

This project is private and proprietary.

## 👥 Support

For issues or questions, contact the development team.

---

**Built with ❤️ for BatTechno**
