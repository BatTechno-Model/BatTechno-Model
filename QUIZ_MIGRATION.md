# Quiz Feature Migration Guide

## ⚠️ Important: Run Database Migration First

The quiz feature requires new database tables. You **must** run the Prisma migration before using the quiz features.

## Migration Steps

### 1. Generate Prisma Client
```bash
cd backend
npx prisma generate
```

### 2. Run Migration
```bash
npx prisma migrate dev --name add_quizzes
```

This will:
- Create the new tables: `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer`, `StudentEvaluation`
- Add the necessary indexes and constraints
- Update the Prisma client

### 3. (Optional) Seed Sample Quizzes
```bash
npm run seed
```

This will create sample pre/post quizzes for testing.

### 4. Restart Backend Server
```bash
npm run dev
```

## Troubleshooting

### Error: "Failed to fetch quizzes" (500)
- **Cause**: Migration not run - tables don't exist
- **Solution**: Run steps 1-2 above

### Error: "Table 'Quiz' does not exist"
- **Cause**: Migration not applied to database
- **Solution**: 
  ```bash
  cd backend
  npx prisma db push
  ```
  Or run the migration again:
  ```bash
  npx prisma migrate dev --name add_quizzes
  ```

### Error: "Prisma Client not generated"
- **Cause**: Prisma client is out of date
- **Solution**: 
  ```bash
  cd backend
  npx prisma generate
  ```

## Verification

After migration, verify tables exist:
```bash
cd backend
npx prisma studio
```

You should see:
- Quiz
- QuizQuestion
- QuizAttempt
- QuizAnswer
- StudentEvaluation

## Manual SQL Migration (Alternative)

If Prisma migrations fail, you can manually run the SQL from `database/neon_schema.sql` (after updating it with the new quiz tables) in your Neon SQL Editor.
