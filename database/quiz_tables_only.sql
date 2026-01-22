-- ============================================
-- QUIZ TABLES SQL - For Neon SQL Editor
-- ============================================
-- انسخ هذا الكود والصقه في Neon SQL Editor
-- Copy this code and paste it in Neon SQL Editor

-- Create ENUM types for quizzes (if not already exists)
DO $$ BEGIN
    CREATE TYPE "QuizType" AS ENUM ('PRE', 'POST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TRUE_FALSE', 'SHORT_TEXT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create Quiz table
CREATE TABLE IF NOT EXISTS "Quiz" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "QuizType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "timeLimitMinutes" INTEGER,
    "attemptsAllowed" INTEGER NOT NULL DEFAULT 1,
    "availableFrom" TIMESTAMP(3),
    "availableTo" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- Create QuizQuestion table
CREATE TABLE IF NOT EXISTS "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "choices" JSONB,
    "correctAnswer" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- Create QuizAttempt table
CREATE TABLE IF NOT EXISTS "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- Create QuizAnswer table
CREATE TABLE IF NOT EXISTS "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "earnedPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- Create StudentEvaluation table
CREATE TABLE IF NOT EXISTS "StudentEvaluation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "preAttemptId" TEXT,
    "postAttemptId" TEXT,
    "preScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "prePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "postPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "improvementScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "improvementPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentEvaluation_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Quiz tables
CREATE UNIQUE INDEX IF NOT EXISTS "Quiz_sessionId_type_key" ON "Quiz"("sessionId", "type");
CREATE INDEX IF NOT EXISTS "Quiz_courseId_idx" ON "Quiz"("courseId");
CREATE INDEX IF NOT EXISTS "Quiz_sessionId_idx" ON "Quiz"("sessionId");
CREATE INDEX IF NOT EXISTS "Quiz_status_idx" ON "Quiz"("status");
CREATE INDEX IF NOT EXISTS "Quiz_createdBy_idx" ON "Quiz"("createdBy");

CREATE INDEX IF NOT EXISTS "QuizQuestion_quizId_idx" ON "QuizQuestion"("quizId");
CREATE INDEX IF NOT EXISTS "QuizQuestion_orderIndex_idx" ON "QuizQuestion"("orderIndex");

CREATE UNIQUE INDEX IF NOT EXISTS "QuizAttempt_quizId_studentId_attemptNumber_key" ON "QuizAttempt"("quizId", "studentId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "QuizAttempt_quizId_idx" ON "QuizAttempt"("quizId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_status_idx" ON "QuizAttempt"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");
CREATE INDEX IF NOT EXISTS "QuizAnswer_attemptId_idx" ON "QuizAnswer"("attemptId");
CREATE INDEX IF NOT EXISTS "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

CREATE UNIQUE INDEX IF NOT EXISTS "StudentEvaluation_sessionId_studentId_key" ON "StudentEvaluation"("sessionId", "studentId");
CREATE INDEX IF NOT EXISTS "StudentEvaluation_courseId_idx" ON "StudentEvaluation"("courseId");
CREATE INDEX IF NOT EXISTS "StudentEvaluation_sessionId_idx" ON "StudentEvaluation"("sessionId");
CREATE INDEX IF NOT EXISTS "StudentEvaluation_studentId_idx" ON "StudentEvaluation"("studentId");

-- Add foreign keys for Quiz tables
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Quiz_courseId_fkey'
    ) THEN
        ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Quiz_sessionId_fkey'
    ) THEN
        ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Quiz_createdBy_fkey'
    ) THEN
        ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'QuizQuestion_quizId_fkey'
    ) THEN
        ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'QuizAttempt_quizId_fkey'
    ) THEN
        ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'QuizAttempt_studentId_fkey'
    ) THEN
        ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'QuizAnswer_attemptId_fkey'
    ) THEN
        ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'QuizAnswer_questionId_fkey'
    ) THEN
        ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvaluation_courseId_fkey'
    ) THEN
        ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvaluation_sessionId_fkey'
    ) THEN
        ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvaluation_studentId_fkey'
    ) THEN
        ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvaluation_preAttemptId_fkey'
    ) THEN
        ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_preAttemptId_fkey" FOREIGN KEY ("preAttemptId") REFERENCES "QuizAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'StudentEvaluation_postAttemptId_fkey'
    ) THEN
        ALTER TABLE "StudentEvaluation" ADD CONSTRAINT "StudentEvaluation_postAttemptId_fkey" FOREIGN KEY ("postAttemptId") REFERENCES "QuizAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Create trigger to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to Quiz tables
DROP TRIGGER IF EXISTS update_quiz_updated_at ON "Quiz";
CREATE TRIGGER update_quiz_updated_at BEFORE UPDATE ON "Quiz"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizquestion_updated_at ON "QuizQuestion";
CREATE TRIGGER update_quizquestion_updated_at BEFORE UPDATE ON "QuizQuestion"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quizattempt_updated_at ON "QuizAttempt";
CREATE TRIGGER update_quizattempt_updated_at BEFORE UPDATE ON "QuizAttempt"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_studentevaluation_updated_at ON "StudentEvaluation";
CREATE TRIGGER update_studentevaluation_updated_at BEFORE UPDATE ON "StudentEvaluation"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
