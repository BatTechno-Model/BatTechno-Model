-- Create CourseInstructor table for many-to-many relationship between courses and instructors
CREATE TABLE IF NOT EXISTS "CourseInstructor" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CourseInstructor_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint to prevent duplicate instructor-course pairs
CREATE UNIQUE INDEX IF NOT EXISTS "CourseInstructor_courseId_instructorId_key" 
  ON "CourseInstructor"("courseId", "instructorId");

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "CourseInstructor_courseId_idx" 
  ON "CourseInstructor"("courseId");

CREATE INDEX IF NOT EXISTS "CourseInstructor_instructorId_idx" 
  ON "CourseInstructor"("instructorId");

-- Add foreign key constraints
ALTER TABLE "CourseInstructor" 
  ADD CONSTRAINT "CourseInstructor_courseId_fkey" 
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseInstructor" 
  ADD CONSTRAINT "CourseInstructor_instructorId_fkey" 
  FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
