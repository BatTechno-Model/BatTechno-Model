# Quick Start Guide

## 🚀 Terminal Commands

### Backend Setup & Run
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

### Frontend Setup & Run
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with VITE_API_URL=http://localhost:5000/api/v1
npm run dev
```

## 🔑 Admin Login Credentials

From seed script:
- **Email**: `admin@battechno.com`
- **Password**: `admin123`

Other accounts:
- **Instructor**: `instructor@battechno.com` / `instructor123`
- **Student**: `student1@battechno.com` / `student123`

## 📍 Neon SQL Editor Script Location

The PostgreSQL schema script is located at:
```
database/neon_schema.sql
```

Copy the entire contents and paste into Neon SQL Editor, then run it.

## ✅ Feature Verification Checklist

### Authentication
- [ ] Login with admin/instructor/student accounts
- [ ] Register new user
- [ ] Language toggle (AR/EN) works
- [ ] Logout works

### Course Management
- [ ] View courses list
- [ ] Create new course (admin/instructor)
- [ ] View course details
- [ ] Enroll students in course

### Sessions & Attendance
- [ ] Create sessions for a course
- [ ] View sessions list
- [ ] Mark attendance (Present/Absent/Late/Excused)
- [ ] Mark all present button works
- [ ] View attendance summary

### Assignments
- [ ] Create assignment
- [ ] View assignments list
- [ ] Submit assignment (student) with files/links
- [ ] Review submission (instructor)
- [ ] Update submission status

### UI/UX
- [ ] Bottom navigation works
- [ ] Page transitions smooth
- [ ] RTL layout works in Arabic
- [ ] LTR layout works in English
- [ ] Mobile-responsive design
- [ ] Loading states show skeletons
- [ ] Error states display properly
- [ ] Toast notifications appear

## 🐛 Common Issues

### Backend won't start
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Run `npx prisma generate` again

### Frontend can't connect to backend
- Verify backend is running on port 5000
- Check VITE_API_URL in frontend/.env
- Check CORS settings in backend

### Database errors
- Run migrations: `npx prisma migrate dev`
- Reset database: `npx prisma migrate reset`
- Re-seed: `npm run seed`

### File upload fails
- Ensure `backend/uploads` directory exists
- Check file size limits in .env
- Verify multer configuration

---

**Happy coding! 🎉**
