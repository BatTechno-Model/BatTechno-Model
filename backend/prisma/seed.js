import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create admin user with strong password
  // Note: For production, use a strong password. This is dev only.
  const adminPassword = await bcrypt.hash('Admin@123Strong!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@battechno.com' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@battechno.com',
      phone: '+1234567890',
      role: 'ADMIN',
      passwordHash: adminPassword,
    },
  });
  console.log('✅ Created admin:', admin.email);

  // Create instructor
  const instructorPassword = await bcrypt.hash('instructor123', 10);
  const instructor = await prisma.user.upsert({
    where: { email: 'instructor@battechno.com' },
    update: {},
    create: {
      name: 'Ahmed Instructor',
      email: 'instructor@battechno.com',
      phone: '+1234567891',
      role: 'INSTRUCTOR',
      passwordHash: instructorPassword,
    },
  });
  console.log('✅ Created instructor:', instructor.email);

  // Create students
  const studentPasswords = await Promise.all([
    bcrypt.hash('student123', 10),
    bcrypt.hash('student123', 10),
    bcrypt.hash('student123', 10),
  ]);

  const student1 = await prisma.user.upsert({
    where: { email: 'student1@battechno.com' },
    update: {},
    create: {
      name: 'محمد الطالب',
      email: 'student1@battechno.com',
      phone: '+1234567892',
      role: 'STUDENT',
      passwordHash: studentPasswords[0],
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'student2@battechno.com' },
    update: {},
    create: {
      name: 'فاطمة الطالبة',
      email: 'student2@battechno.com',
      phone: '+1234567893',
      role: 'STUDENT',
      passwordHash: studentPasswords[1],
    },
  });

  const student3 = await prisma.user.upsert({
    where: { email: 'student3@battechno.com' },
    update: {},
    create: {
      name: 'علي الطالب',
      email: 'student3@battechno.com',
      phone: '+1234567894',
      role: 'STUDENT',
      passwordHash: studentPasswords[2],
    },
  });
  console.log('✅ Created 3 students');

  // Create course
  const course = await prisma.course.create({
    data: {
      title: 'Full-Stack Web Development',
      description: 'Learn modern full-stack development with React and Node.js',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-06-15'),
      createdBy: instructor.id,
    },
  });
  console.log('✅ Created course:', course.title);

  // Enroll students
  await prisma.enrollment.createMany({
    data: [
      { userId: student1.id, courseId: course.id },
      { userId: student2.id, courseId: course.id },
      { userId: student3.id, courseId: course.id },
    ],
    skipDuplicates: true,
  });
  console.log('✅ Enrolled students');

  // Create sessions
  const sessionDates = [
    new Date('2024-01-15'),
    new Date('2024-01-17'),
    new Date('2024-01-20'),
    new Date('2024-01-22'),
  ];

  const sessions = await Promise.all(
    sessionDates.map((date, idx) =>
      prisma.session.create({
        data: {
          courseId: course.id,
          date,
          startTime: '10:00',
          endTime: '12:00',
          topic: `Session ${idx + 1}: Introduction to ${idx === 0 ? 'React' : idx === 1 ? 'Node.js' : idx === 2 ? 'Database' : 'Deployment'}`,
          notes: `This is session ${idx + 1} notes.`,
        },
      })
    )
  );
  console.log('✅ Created', sessions.length, 'sessions');

  // Create sample attendance (some present, some absent)
  for (const session of sessions) {
    await prisma.attendance.createMany({
      data: [
        { sessionId: session.id, studentId: student1.id, status: 'PRESENT' },
        { sessionId: session.id, studentId: student2.id, status: 'PRESENT' },
        { sessionId: session.id, studentId: student3.id, status: 'ABSENT' },
      ],
      skipDuplicates: true,
    });
  }
  console.log('✅ Created sample attendance records');

  // Create assignment (published)
  const assignment = await prisma.assignment.create({
    data: {
      courseId: course.id,
      title: 'Build a Todo App',
      description: 'Create a full-stack todo application with React frontend and Node.js backend',
      dueDate: new Date('2024-02-15'),
      maxScore: 100,
      isPublished: true,
      rubric: {
        frontend: { max: 30, description: 'React components and UI' },
        backend: { max: 30, description: 'API endpoints and logic' },
        database: { max: 20, description: 'Database design' },
        codeQuality: { max: 20, description: 'Clean code and best practices' },
      },
    },
  });
  console.log('✅ Created assignment:', assignment.title);

  // Create sample assignment resources
  await prisma.assignmentResource.createMany({
    data: [
      {
        assignmentId: assignment.id,
        type: 'LINK',
        name: 'Assignment Guidelines',
        url: 'https://example.com/guidelines',
        createdBy: instructor.id,
      },
      {
        assignmentId: assignment.id,
        type: 'LINK',
        name: 'Design Mockups',
        url: 'https://figma.com/mockups',
        createdBy: instructor.id,
      },
    ],
  });
  console.log('✅ Created assignment resources');

  // Create sample submission
  const submission = await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      studentId: student1.id,
      status: 'SUBMITTED',
      note: 'My submission notes',
      assets: {
        create: [
          {
            type: 'LINK',
            url: 'https://github.com/student1/todo-app',
            name: 'GitHub Repository',
          },
          {
            type: 'LINK',
            url: 'https://todo-app-demo.vercel.app',
            name: 'Live Demo',
          },
        ],
      },
    },
  });
  console.log('✅ Created sample submission');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Login Credentials (DEV ONLY):');
  console.log('Admin: admin@battechno.com / Admin@123Strong!');
  console.log('⚠️  Admin password must be changed in production!');
  console.log('Instructor: instructor@battechno.com / instructor123');
  console.log('Student: student1@battechno.com / student123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
