import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateCourse } from '../utils/validation.js';

const router = express.Router();

// Get all courses
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let courses;
    if (role === 'STUDENT') {
      // For students, only show courses they are enrolled in with ACTIVE status
      // First, verify the user exists and is a student
      const student = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, name: true },
      });
      
      if (!student || student.role !== 'STUDENT') {
        console.warn(`User ${userId} is not a student or doesn't exist`);
        return res.json({ courses: [] });
      }
      
      // Get all enrollments for this student
      const studentEnrollments = await prisma.enrollment.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: {
          courseId: true,
        },
      });
      
      const enrolledCourseIds = studentEnrollments.map(e => e.courseId);
      console.log(`Student ${userId} (${student.name}): Has ${enrolledCourseIds.length} active enrollments`);
      
      if (enrolledCourseIds.length === 0) {
        console.log(`Student ${userId} has no active enrollments, returning empty courses list`);
        return res.json({ courses: [] });
      }
      
      // Get courses where student is enrolled
      courses = await prisma.course.findMany({
        where: {
          id: {
            in: enrolledCourseIds,
          },
        },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              enrollments: true,
              sessions: true,
              assignments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      
      console.log(`Student ${userId}: Found ${courses.length} enrolled courses`);
      if (courses.length > 0) {
        console.log(`Courses: ${courses.map(c => c.title).join(', ')}`);
      }
    } else {
      courses = await prisma.course.findMany({
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              enrollments: true,
              sessions: true,
              assignments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    res.json({ courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get instructors (ADMIN and INSTRUCTOR roles) - MUST be before /:id route
router.get('/instructors', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const instructors = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'INSTRUCTOR'] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({ instructors });
  } catch (error) {
    console.error('Get instructors error:', error);
    res.status(500).json({ error: 'Failed to fetch instructors', details: error.message });
  }
});

// Get course by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    // Base include without instructors
    const baseInclude = {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      enrollments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      sessions: {
        orderBy: { date: 'asc' },
      },
      assignments: {
        orderBy: { dueDate: 'asc' },
      },
    };

    // First, try to get course without instructors
    let course = await prisma.course.findUnique({
      where: { id },
      include: baseInclude,
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Try to add instructors if table exists (using raw query to avoid Prisma relation errors)
    try {
      const instructorsData = await prisma.$queryRaw`
        SELECT u.id, u.name, u.email
        FROM "CourseInstructor" ci
        JOIN "User" u ON ci."instructorId" = u.id
        WHERE ci."courseId" = ${id}
      `;
      course.instructors = instructorsData.map(inst => ({
        instructor: {
          id: inst.id,
          name: inst.name,
          email: inst.email,
        },
      }));
    } catch (instructorError) {
      // Table doesn't exist or query failed, set empty array
      course.instructors = [];
    }

    // Check if student is enrolled
    if (role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId: id,
          },
        },
      });

      if (!enrollment || enrollment.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }
    }

    res.json({ course });
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ error: 'Failed to fetch course', details: error.message });
  }
});

// Create course
router.post('/', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), validateCourse, async (req, res) => {
  try {
    const { title, description, startDate, endDate } = req.body;

    const course = await prisma.course.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        createdBy: req.user.id,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({ course });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// Update course
router.put('/:id', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), validateCourse, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, startDate, endDate, createdBy, instructorIds } = req.body;

    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.createdBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to update this course' });
    }

    // Prepare update data
    const updateData = {
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };

    // Update createdBy if provided and user is ADMIN
    if (createdBy && req.user.role === 'ADMIN') {
      // Verify the new creator is ADMIN or INSTRUCTOR
      const newCreator = await prisma.user.findUnique({
        where: { id: createdBy },
        select: { role: true },
      });
      if (newCreator && (newCreator.role === 'ADMIN' || newCreator.role === 'INSTRUCTOR')) {
        updateData.createdBy = createdBy;
      }
    }

    // Update instructors if provided (only if table exists)
    if (instructorIds !== undefined && Array.isArray(instructorIds)) {
      try {
        // Remove all existing instructors
        await prisma.courseInstructor.deleteMany({
          where: { courseId: id },
        });

        // Add new instructors (excluding the creator if they're in the list)
        const instructorsToAdd = instructorIds.filter(
          instructorId => instructorId !== updateData.createdBy && instructorId !== course.createdBy
        );

        if (instructorsToAdd.length > 0) {
          // Verify all instructors are ADMIN or INSTRUCTOR
          const validInstructors = await prisma.user.findMany({
            where: {
              id: { in: instructorsToAdd },
              role: { in: ['ADMIN', 'INSTRUCTOR'] },
            },
            select: { id: true },
          });

          const validInstructorIds = validInstructors.map(u => u.id);

          if (validInstructorIds.length > 0) {
            await prisma.courseInstructor.createMany({
              data: validInstructorIds.map(instructorId => ({
                courseId: id,
                instructorId,
              })),
              skipDuplicates: true,
            });
          }
        }
      } catch (instructorError) {
        // Table doesn't exist yet, skip instructor updates
        console.warn('CourseInstructor table not found, skipping instructor updates:', instructorError.message);
      }
    }

    const updatedCourse = await prisma.course.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Try to add instructors if table exists (using raw query)
    try {
      const instructorsData = await prisma.$queryRaw`
        SELECT u.id, u.name, u.email
        FROM "CourseInstructor" ci
        JOIN "User" u ON ci."instructorId" = u.id
        WHERE ci."courseId" = ${id}
      `;
      updatedCourse.instructors = instructorsData.map(inst => ({
        instructor: {
          id: inst.id,
          name: inst.name,
          email: inst.email,
        },
      }));
    } catch (instructorError) {
      // Table doesn't exist or query failed, set empty array
      updatedCourse.instructors = [];
    }

    res.json({ course: updatedCourse });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Delete course
router.delete('/:id', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id } = req.params;

    const course = await prisma.course.findUnique({
      where: { id },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    if (course.createdBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Not authorized to delete this course' });
    }

    await prisma.course.delete({
      where: { id },
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

// Enroll students
router.post('/:id/enrollments', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id: courseId } = req.params;
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ error: 'Student IDs array is required' });
    }

    const enrollments = await Promise.all(
      studentIds.map((studentId) =>
        prisma.enrollment.upsert({
          where: {
            userId_courseId: {
              userId: studentId,
              courseId,
            },
          },
          update: {
            status: 'ACTIVE',
          },
          create: {
            userId: studentId,
            courseId,
            status: 'ACTIVE',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        })
      )
    );

    res.json({ enrollments });
  } catch (error) {
    console.error('Enroll students error:', error);
    res.status(500).json({ error: 'Failed to enroll students' });
  }
});

// Get enrolled students
router.get('/:id/students', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id: courseId } = req.params;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        courseId,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        enrolledAt: 'desc',
      },
    });

    res.json({ students: enrollments.map((e) => e.user) });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

export default router;
