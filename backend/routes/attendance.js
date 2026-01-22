import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { attendanceBulkSchema } from '../utils/validation.js';

const router = express.Router();

// Get attendance for a session
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const attendances = await prisma.attendance.findMany({
      where: { sessionId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        session: {
          select: {
            id: true,
            date: true,
            topic: true,
          },
        },
      },
      orderBy: {
        student: {
          name: 'asc',
        },
      },
    });

    res.json({ attendances });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// Bulk upsert attendance for a session
router.post('/bulk', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const data = attendanceBulkSchema.parse(req.body);
    const { sessionId, attendances } = data;

    // Verify session exists
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Upsert all attendances
    const results = await Promise.all(
      attendances.map((att) =>
        prisma.attendance.upsert({
          where: {
            sessionId_studentId: {
              sessionId,
              studentId: att.studentId,
            },
          },
          update: {
            status: att.status,
            note: att.note,
          },
          create: {
            sessionId,
            studentId: att.studentId,
            status: att.status,
            note: att.note,
          },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      )
    );

    res.json({ attendances: results });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Bulk upsert attendance error:', error);
    res.status(500).json({ error: 'Failed to update attendance' });
  }
});

// Get attendance summary for a student in a course
router.get('/student/:studentId/course/:courseId', authenticateToken, async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    const sessions = await prisma.session.findMany({
      where: { courseId },
      include: {
        attendances: {
          where: { studentId },
        },
      },
      orderBy: { date: 'asc' },
    });

    const totalSessions = sessions.length;
    const presentCount = sessions.filter(
      (s) => s.attendances[0]?.status === 'PRESENT'
    ).length;
    const absentCount = sessions.filter(
      (s) => s.attendances[0]?.status === 'ABSENT'
    ).length;
    const lateCount = sessions.filter(
      (s) => s.attendances[0]?.status === 'LATE'
    ).length;
    const excusedCount = sessions.filter(
      (s) => s.attendances[0]?.status === 'EXCUSED'
    ).length;

    const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

    res.json({
      summary: {
        totalSessions,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        date: s.date,
        topic: s.topic,
        status: s.attendances[0]?.status || 'ABSENT',
        note: s.attendances[0]?.note,
      })),
    });
  } catch (error) {
    console.error('Get attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Get all students attendance summary for a course
router.get('/course/:courseId/summary', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { courseId } = req.params;

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
          },
        },
      },
    });

    const sessions = await prisma.session.findMany({
      where: { courseId },
      orderBy: { date: 'asc' },
    });

    const summaries = await Promise.all(
      enrollments.map(async (enrollment) => {
        const attendances = await prisma.attendance.findMany({
          where: {
            sessionId: { in: sessions.map((s) => s.id) },
            studentId: enrollment.userId,
          },
        });

        const totalSessions = sessions.length;
        const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
        const attendanceRate = totalSessions > 0 ? (presentCount / totalSessions) * 100 : 0;

        return {
          student: enrollment.user,
          totalSessions,
          presentCount,
          absentCount: attendances.filter((a) => a.status === 'ABSENT').length,
          lateCount: attendances.filter((a) => a.status === 'LATE').length,
          excusedCount: attendances.filter((a) => a.status === 'EXCUSED').length,
          attendanceRate: Math.round(attendanceRate * 100) / 100,
        };
      })
    );

    res.json({ summaries });
  } catch (error) {
    console.error('Get course attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Get all students attendance summary across all courses (admin only)
router.get('/students/summary', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    // Get all students with their profiles
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        profile: {
          select: {
            avatar: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Get all courses
    const courses = await prisma.course.findMany({
      include: {
        sessions: {
          select: {
            id: true,
            date: true,
          },
        },
      },
    });

    // Get all enrollments
    const enrollments = await prisma.enrollment.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Calculate attendance for each student
    const studentSummaries = await Promise.all(
      students.map(async (student) => {
        // Get all courses this student is enrolled in
        const studentCourses = enrollments
          .filter((e) => e.userId === student.id)
          .map((e) => e.course);

        // Get all sessions from enrolled courses
        const allSessionIds = courses
          .filter((c) => studentCourses.some((sc) => sc.id === c.id))
          .flatMap((c) => c.sessions.map((s) => s.id));

        // Get all attendances for this student
        const attendances = await prisma.attendance.findMany({
          where: {
            studentId: student.id,
            sessionId: { in: allSessionIds },
          },
        });

        // Calculate stats
        const totalSessions = allSessionIds.length;
        const presentCount = attendances.filter((a) => a.status === 'PRESENT').length;
        const absentCount = attendances.filter((a) => a.status === 'ABSENT').length;
        const lateCount = attendances.filter((a) => a.status === 'LATE').length;
        const excusedCount = attendances.filter((a) => a.status === 'EXCUSED').length;
        const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

        return {
          student,
          courses: studentCourses.map((c) => c.title),
          summary: {
            totalSessions,
            presentCount,
            absentCount,
            lateCount,
            excusedCount,
            attendanceRate,
          },
        };
      })
    );

    res.json({ summaries: studentSummaries });
  } catch (error) {
    console.error('Get all students attendance summary error:', error);
    res.status(500).json({ error: 'Failed to fetch students attendance summary' });
  }
});

export default router;
