# Fix 500 Errors - Database Migration Required

## ⚠️ Problem
You're seeing 500 errors because the quiz database tables don't exist yet. The migration hasn't been run.

## ✅ Solution - Run These Commands

Open your terminal and run:

```bash
cd backend
npx prisma generate
npx prisma migrate dev --name add_quizzes
```

## 📋 Step-by-Step

1. **Open Terminal** (PowerShell, CMD, or Git Bash)

2. **Navigate to backend folder:**
   ```bash
   cd backend
   ```

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```
   This updates the Prisma client with the new Quiz models.

4. **Run Migration:**
   ```bash
   npx prisma migrate dev --name add_quizzes
   ```
   This creates and applies the migration to create quiz tables.

5. **Restart Backend Server:**
   ```bash
   npm run dev
   ```

6. **Refresh Browser:**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - This clears any cached errors

## ✅ Verify It Worked

After migration, check:

1. **Backend Console** - Should show no Prisma errors
2. **Browser Console** - 500 errors should stop
3. **Try Creating a Quiz** - Should work now

## 🔍 Check Database Health

Visit this URL in your browser to check if tables exist:
```
http://localhost:5000/health/db
```

- ✅ **200 OK** = Tables exist, everything is good
- ❌ **503 Error** = Migration needed (run the commands above)

## 🐛 Still Getting Errors?

### If migration fails:
```bash
# Try using db push instead
cd backend
npx prisma db push
```

### If you see "relation does not exist":
The migration didn't apply. Check:
1. Database connection in `.env` is correct
2. You have write permissions to the database
3. Try: `npx prisma migrate reset` (⚠️ This deletes all data!)

### Check backend logs:
Look at your backend terminal for the actual error message. It will tell you exactly what's wrong.

## 📝 What Gets Created

The migration creates these tables:
- `Quiz` - Quiz metadata
- `QuizQuestion` - Quiz questions  
- `QuizAttempt` - Student attempts
- `QuizAnswer` - Student answers
- `StudentEvaluation` - Evaluation results

## 🎯 After Migration

Once migration completes:
1. ✅ 500 errors will stop
2. ✅ You can create quizzes
3. ✅ Students can take quizzes
4. ✅ Analytics will work

---

**The migration MUST be run before quiz features will work!**
