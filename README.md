# BatTechno Model

A beautiful, mobile-app-like platform for BatTechno full-stack courses. Manage courses, sessions, attendance, assignments, and student submissions with a modern, RTL-ready interface.

## 🚀 Features

- **Course Management**: Create and manage courses with student enrollment
- **Session Scheduling**: Schedule lecture sessions with dates and times
- **Attendance System**: Mark attendance (Present/Absent/Late/Excused) with export capabilities
- **Assignments**: Create assignments with rubrics, students submit with files/links
- **Review System**: Instructors review submissions with scoring and feedback
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

1. Create a new project in [Neon](https://neon.tech)
2. Copy your connection string
3. Open Neon SQL Editor
4. Copy and paste the contents of `database/neon_schema.sql`
5. Run the script to create all tables

Alternatively, use Prisma migrations:

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name init
```

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

## ✅ Verification Checklist

- [ ] Backend server starts without errors
- [ ] Frontend dev server starts without errors
- [ ] Database tables created successfully
- [ ] Seed script runs and creates sample data
- [ ] Can login with admin/instructor/student accounts
- [ ] Can create a course (as admin/instructor)
- [ ] Can enroll students in a course
- [ ] Can create sessions
- [ ] Can mark attendance
- [ ] Can create assignments
- [ ] Can submit assignments (as student)
- [ ] Can review submissions (as instructor)
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

## 📄 License

This project is private and proprietary.

## 👥 Support

For issues or questions, contact the development team.

---

**Built with ❤️ for BatTechno**
