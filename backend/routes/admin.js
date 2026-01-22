import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { computeStudentCourseMetrics } from '../utils/metrics.js';
import { generateStudentReportPDF, generateSubscribersPDF } from '../utils/pdf.js';

const router = express.Router();

// All routes require ADMIN role
router.use(authenticateToken);
router.use(requireRole('ADMIN'));

// Get students directory with filters and search
router.get('/students', async (req, res) => {
  try {
    const {
      search,
      city,
      country,
      isStudent,
      courseId,
      alertType,
      lowPerformance,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {
      role: 'STUDENT',
    };

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by profile fields (only if values are provided)
    const profileWhere = {};
    if (city && city.trim() !== '') profileWhere.city = city.trim();
    if (country && country.trim() !== '') profileWhere.country = country.trim();
    if (isStudent !== undefined && isStudent !== '' && isStudent !== 'undefined') {
      profileWhere.isStudent = isStudent === 'true';
    }

    // Get students with profiles and enrollments
    let students = await prisma.user.findMany({
      where,
      include: {
        profile: true, // Always include profile, filter later if needed
        enrollments: {
          where: {
            status: 'ACTIVE', // Only active enrollments
          },
          include: {
            course: {
              select: {
                id: true,
                title: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Found ${students.length} students from database`);

    // Filter by profile fields if specified
    // Note: Only filter if values are provided (not empty strings)
    if (city && city.trim() !== '' || country && country.trim() !== '' || (isStudent !== undefined && isStudent !== '' && isStudent !== 'undefined')) {
      const beforeFilter = students.length;
      students = students.filter((student) => {
        // If any profile filter is set but student has no profile, exclude them
        if (!student.profile) {
          return false;
        }
        if (city && city.trim() !== '' && student.profile.city !== city.trim()) return false;
        if (country && country.trim() !== '' && student.profile.country !== country.trim()) return false;
        if (isStudent !== undefined && isStudent !== '' && isStudent !== 'undefined' && student.profile.isStudent !== (isStudent === 'true')) return false;
        return true;
      });
      console.log(`Filtered from ${beforeFilter} to ${students.length} students by profile filters`);
    }

    // Filter by course if specified
    if (courseId) {
      students = students.filter((student) =>
        student.enrollments.some((e) => e.courseId === courseId)
      );
    }

    // Get metrics for each student
    const studentsWithMetrics = await Promise.allSettled(
      students.map(async (student) => {
        try {
          const courses = student.enrollments
            .filter((e) => e.status === 'ACTIVE')
            .map((e) => e.course)
            .filter((c) => c !== null); // Filter out null courses

          // Calculate metrics for each course
          const courseMetrics = await Promise.allSettled(
            courses.map(async (course) => {
              try {
                const metrics = await computeStudentCourseMetrics(student.id, course.id);
                return {
                  courseId: course.id,
                  courseTitle: course.title,
                  overallScore: metrics.overallScore || 0,
                  alerts: metrics.alerts || [],
                  recommendations: metrics.recommendations || [],
                };
              } catch (error) {
                console.error(`Error computing metrics for student ${student.id}, course ${course.id}:`, error.message);
                // Return default metrics if computation fails
                return {
                  courseId: course.id,
                  courseTitle: course.title,
                  overallScore: 0,
                  alerts: [],
                  recommendations: [],
                };
              }
            })
          ).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : r.reason || {
            courseId: null,
            courseTitle: 'Unknown',
            overallScore: 0,
            alerts: [],
            recommendations: [],
          })));

          // Calculate overall metrics across all courses
          let overallScore = 0;
          if (courseMetrics.length > 0) {
            const validScores = courseMetrics
              .map((m) => m?.overallScore)
              .filter((score) => score !== null && score !== undefined && !isNaN(score));
            if (validScores.length > 0) {
              overallScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
            }
          }

          // Collect all alerts from all courses
          const allAlerts = courseMetrics.flatMap((m) => m?.alerts || []).filter(Boolean);
          const uniqueAlerts = [...new Set(allAlerts)];

          // Check for no activity in last 14 days (global check, not per course)
          let hasAnyActivity = false;
          try {
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

            const hasRecentActivity = await Promise.allSettled([
              prisma.attendance.findFirst({
                where: {
                  studentId: student.id,
                  createdAt: { gte: fourteenDaysAgo },
                },
              }),
              prisma.submission.findFirst({
                where: {
                  studentId: student.id,
                  submittedAt: { gte: fourteenDaysAgo },
                },
              }),
              prisma.quizAttempt.findFirst({
                where: {
                  studentId: student.id,
                  createdAt: { gte: fourteenDaysAgo },
                },
              }),
              prisma.examAttempt.findFirst({
                where: {
                  studentId: student.id,
                  createdAt: { gte: fourteenDaysAgo },
                },
              }),
            ]);

            hasAnyActivity = hasRecentActivity.some((result) => 
              result.status === 'fulfilled' && result.value !== null
            );
          } catch (activityError) {
            console.error(`Error checking activity for student ${student.id}:`, activityError.message);
            // Default to false if error occurs
            hasAnyActivity = false;
          }

          if (!hasAnyActivity && courses.length > 0) {
            if (!uniqueAlerts.includes('NO_ACTIVITY_14_DAYS')) {
              uniqueAlerts.push('NO_ACTIVITY_14_DAYS');
            }
          }

          // Filter by alert type if specified
          if (alertType && !uniqueAlerts.includes(alertType)) {
            return null;
          }

          // Filter by low performance if specified
          if (lowPerformance === 'true' && overallScore >= 60) {
            return null;
          }

          return {
            id: student.id,
            name: student.name,
            email: student.email,
            phone: student.phone || null,
            profile: student.profile || null,
            courses: courses.map((c) => ({ id: c.id, title: c.title })),
            courseMetrics: courseMetrics.filter((m) => m && m.courseId),
            overallScore: Math.round(overallScore * 10) / 10, // Round to 1 decimal place
            alertsCount: uniqueAlerts.length,
            alerts: uniqueAlerts,
          };
        } catch (error) {
          console.error(`Error processing student ${student.id}:`, error.message);
          // Return null to filter out this student if there's an error
          return null;
        }
      })
    ).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean));

    // Remove null entries (filtered out)
    const filteredStudents = studentsWithMetrics.filter((s) => s !== null);
    
    console.log(`Found ${students.length} students, ${filteredStudents.length} after filtering`);
    console.log('Filters applied:', { search, city, country, isStudent, courseId, alertType, lowPerformance });

    // Get accurate total count based on filters
    // First, get all students matching the base filters
    const baseWhere = {
      role: 'STUDENT',
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    // Count students matching base criteria
    let totalCount = await prisma.user.count({
      where: baseWhere,
    });

    // If profile filters are applied, we need to count manually after filtering
    if (Object.keys(profileWhere).length > 0 || courseId || alertType || lowPerformance === 'true') {
      // Get all students matching base criteria (without pagination)
      const allStudents = await prisma.user.findMany({
        where: baseWhere,
        include: {
          profile: true,
          enrollments: {
            where: { status: 'ACTIVE' },
            include: { course: true },
          },
        },
      });

      // Apply profile filters
      let filteredAllStudents = allStudents;
      if (city && city.trim() !== '' || country && country.trim() !== '' || (isStudent !== undefined && isStudent !== '' && isStudent !== 'undefined')) {
        filteredAllStudents = allStudents.filter((student) => {
          if (!student.profile) return false;
          if (city && city.trim() !== '' && student.profile.city !== city.trim()) return false;
          if (country && country.trim() !== '' && student.profile.country !== country.trim()) return false;
          if (isStudent !== undefined && isStudent !== '' && isStudent !== 'undefined' && student.profile.isStudent !== (isStudent === 'true')) return false;
          return true;
        });
      }

      // Filter by course if specified
      if (courseId) {
        filteredAllStudents = filteredAllStudents.filter((student) =>
          student.enrollments.some((e) => e.courseId === courseId)
        );
      }

      // Calculate metrics for all filtered students to apply alert/performance filters
      const allStudentsWithMetrics = await Promise.allSettled(
        filteredAllStudents.map(async (student) => {
          try {
            const courses = student.enrollments
              .filter((e) => e.status === 'ACTIVE')
              .map((e) => e.course)
              .filter((c) => c !== null);

            const courseMetrics = await Promise.allSettled(
              courses.map(async (course) => {
                try {
                  const metrics = await computeStudentCourseMetrics(student.id, course.id);
                  return {
                    overallScore: metrics.overallScore || 0,
                    alerts: metrics.alerts || [],
                  };
                } catch (error) {
                  return {
                    overallScore: 0,
                    alerts: [],
                  };
                }
              })
            ).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : { overallScore: 0, alerts: [] })));

            let overallScore = 0;
            if (courseMetrics.length > 0) {
              const validScores = courseMetrics
                .map((m) => m?.overallScore)
                .filter((score) => score !== null && score !== undefined && !isNaN(score));
              if (validScores.length > 0) {
                overallScore = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
              }
            }

            const allAlerts = courseMetrics.flatMap((m) => m?.alerts || []).filter(Boolean);
            const uniqueAlerts = [...new Set(allAlerts)];

            // Check for no activity
            let hasAnyActivity = false;
            try {
              const fourteenDaysAgo = new Date();
              fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

              const hasRecentActivity = await Promise.allSettled([
                prisma.attendance.findFirst({
                  where: { studentId: student.id, createdAt: { gte: fourteenDaysAgo } },
                }),
                prisma.submission.findFirst({
                  where: { studentId: student.id, submittedAt: { gte: fourteenDaysAgo } },
                }),
                prisma.quizAttempt.findFirst({
                  where: { studentId: student.id, createdAt: { gte: fourteenDaysAgo } },
                }),
                prisma.examAttempt.findFirst({
                  where: { studentId: student.id, createdAt: { gte: fourteenDaysAgo } },
                }),
              ]);

              hasAnyActivity = hasRecentActivity.some((result) => 
                result.status === 'fulfilled' && result.value !== null
              );
            } catch (activityError) {
              // Default to false if error occurs
              hasAnyActivity = false;
            }

            if (!hasAnyActivity && courses.length > 0 && !uniqueAlerts.includes('NO_ACTIVITY_14_DAYS')) {
              uniqueAlerts.push('NO_ACTIVITY_14_DAYS');
            }

            // Apply filters
            if (alertType && !uniqueAlerts.includes(alertType)) {
              return null;
            }
            if (lowPerformance === 'true' && overallScore >= 60) {
              return null;
            }

            return { id: student.id };
          } catch (error) {
            console.error(`Error processing student ${student.id} for count:`, error.message);
            return null;
          }
        })
      ).then((results) => results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean));

      totalCount = allStudentsWithMetrics.filter((s) => s !== null).length;
    }

    const response = {
      data: filteredStudents,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    };
    
    console.log(`Returning ${filteredStudents.length} students, total count: ${totalCount}`);
    
    res.json(response);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get student report
router.get('/students/:studentId/report', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student with profile
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        profile: true,
        enrollments: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get enrollments with detailed metrics
    const enrollments = await Promise.all(
      student.enrollments.map(async (enrollment) => {
        const courseId = enrollment.courseId;

        // Get attendance summary
        const sessions = await prisma.session.findMany({
          where: { courseId },
          include: {
            attendances: {
              where: { studentId },
            },
          },
          orderBy: { date: 'desc' },
        });

        const attendanceSummary = {
          total: sessions.length,
          present: sessions.filter((s) => s.attendances[0]?.status === 'PRESENT').length,
          absent: sessions.filter((s) => !s.attendances[0] || s.attendances[0].status === 'ABSENT').length,
          late: sessions.filter((s) => s.attendances[0]?.status === 'LATE').length,
          excused: sessions.filter((s) => s.attendances[0]?.status === 'EXCUSED').length,
          rate: 0,
        };

        if (attendanceSummary.total > 0) {
          let presentPoints = 0;
          sessions.forEach((session) => {
            const att = session.attendances[0];
            if (att) {
              switch (att.status) {
                case 'PRESENT':
                  presentPoints += 1;
                  break;
                case 'LATE':
                  presentPoints += 0.75;
                  break;
                case 'EXCUSED':
                  presentPoints += 0.6;
                  break;
              }
            }
          });
          attendanceSummary.rate = presentPoints / attendanceSummary.total;
        }

        // Get assignments summary
        const assignments = await prisma.assignment.findMany({
          where: { courseId, isPublished: true },
          include: {
            submissions: {
              where: { studentId },
              include: {
                reviews: true,
              },
            },
          },
        });

        const assignmentSummary = {
          total: assignments.length,
          submitted: assignments.filter((a) => a.submissions.length > 0).length,
          approved: assignments.filter((a) => a.submissions[0]?.status === 'APPROVED').length,
          needsChanges: assignments.filter((a) => a.submissions[0]?.status === 'NEEDS_CHANGES').length,
          avgScore: 0,
        };

        let totalScore = 0;
        let scoredCount = 0;
        assignments.forEach((assignment) => {
          const submission = assignment.submissions[0];
          if (submission) {
            const review = submission.reviews[0];
            if (review && review.score !== null) {
              totalScore += review.score;
              scoredCount += 1;
            }
          }
        });

        if (scoredCount > 0) {
          assignmentSummary.avgScore = totalScore / scoredCount;
        }

        // Get exams/quizzes summary
        const quizAttempts = await prisma.quizAttempt.findMany({
          where: {
            studentId,
            quiz: { courseId },
            status: 'SUBMITTED',
          },
          include: {
            quiz: true,
          },
        });

        const examAttempts = await prisma.examAttempt.findMany({
          where: {
            studentId,
            exam: { courseId },
            status: 'SUBMITTED',
          },
          include: {
            exam: true,
          },
        });

        const examsSummary = {
          quizAttempts: quizAttempts.length,
          examAttempts: examAttempts.length,
          avgScore: 0,
        };

        let totalExamScore = 0;
        let examCount = 0;
        quizAttempts.forEach((attempt) => {
          if (attempt.maxScore > 0) {
            totalExamScore += (attempt.totalScore / attempt.maxScore) * 10; // Normalize to /10
            examCount += 1;
          }
        });
        examAttempts.forEach((attempt) => {
          totalExamScore += attempt.finalScore10;
          examCount += 1;
        });

        if (examCount > 0) {
          examsSummary.avgScore = totalExamScore / examCount;
        }

        // Get metrics
        let metrics;
        try {
          metrics = await computeStudentCourseMetrics(studentId, courseId);
        } catch (error) {
          metrics = {
            overallScore: 0,
            alerts: [],
            recommendations: [],
          };
        }

        return {
          course: enrollment.course,
          enrollment,
          attendanceSummary,
          assignmentSummary,
          examsSummary,
          metrics,
        };
      })
    );

    // Get timeline events
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentAttendance = await prisma.attendance.findMany({
      where: {
        studentId,
        createdAt: { gte: fourteenDaysAgo },
      },
      include: {
        session: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const recentSubmissions = await prisma.submission.findMany({
      where: {
        studentId,
        submittedAt: { gte: fourteenDaysAgo },
      },
      include: {
        assignment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    });

    const recentQuizAttempts = await prisma.quizAttempt.findMany({
      where: {
        studentId,
        createdAt: { gte: fourteenDaysAgo },
        status: 'SUBMITTED',
      },
      include: {
        quiz: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    });

    const recentExamAttempts = await prisma.examAttempt.findMany({
      where: {
        studentId,
        createdAt: { gte: fourteenDaysAgo },
        status: 'SUBMITTED',
      },
      include: {
        exam: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
      take: 20,
    });

    const timeline = [
      ...recentAttendance.map((att) => ({
        type: 'attendance',
        date: att.createdAt,
        data: {
          session: att.session,
          status: att.status,
        },
      })),
      ...recentSubmissions.map((sub) => ({
        type: 'submission',
        date: sub.submittedAt,
        data: {
          assignment: sub.assignment,
          status: sub.status,
        },
      })),
      ...recentQuizAttempts.map((attempt) => ({
        type: 'quiz',
        date: attempt.submittedAt || attempt.createdAt,
        data: {
          quiz: attempt.quiz,
          score: attempt.percentage,
        },
      })),
      ...recentExamAttempts.map((attempt) => ({
        type: 'exam',
        date: attempt.submittedAt || attempt.createdAt,
        data: {
          exam: attempt.exam,
          score: attempt.finalScore10,
        },
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      data: {
        email: student.email,
        name: student.name,
        phone: student.phone,
        profile: student.profile,
        enrollments,
        timeline,
      },
    });
  } catch (error) {
    console.error('Get student report error:', error);
    res.status(500).json({ error: 'Failed to fetch student report' });
  }
});

// Get student report PDF
router.get('/students/:studentId/report.pdf', async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student report data (reuse the report endpoint logic)
    const student = await prisma.user.findUnique({
      where: { id: studentId },
      include: {
        profile: true,
        enrollments: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Generate PDF
    const pdfBuffer = await generateStudentReportPDF(student);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="student-report-${studentId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Get subscribers list with filters and search
router.get('/subscribers', async (req, res) => {
  try {
    const {
      search,
      city,
      country,
      isStudent,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where = {};

    // Search by name or email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by profile fields
    const profileWhere = {};
    if (city) profileWhere.city = city;
    if (country) profileWhere.country = country;
    if (isStudent !== undefined) profileWhere.isStudent = isStudent === 'true';

    // Get users with profiles
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: {
            where: Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
          },
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    // Filter users that have profiles matching the criteria
    let filteredUsers = users;
    if (Object.keys(profileWhere).length > 0) {
      filteredUsers = users.filter((user) => {
        if (!user.profile) return false;
        if (city && user.profile.city !== city) return false;
        if (country && user.profile.country !== country) return false;
        if (isStudent !== undefined && user.profile.isStudent !== (isStudent === 'true')) return false;
        return true;
      });
    }

    res.json({
      data: filteredUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredUsers.length,
        totalPages: Math.ceil(filteredUsers.length / limitNum),
      },
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Download subscribers PDF
router.get('/subscribers/pdf', async (req, res) => {
  try {
    const {
      search,
      city,
      country,
      isStudent,
    } = req.query;

    // Build where clause (same as GET /subscribers)
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const profileWhere = {};
    if (city) profileWhere.city = city;
    if (country) profileWhere.country = country;
    if (isStudent !== undefined) profileWhere.isStudent = isStudent === 'true';

    const users = await prisma.user.findMany({
      where,
      include: {
        profile: {
          where: Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter users
    let filteredUsers = users;
    if (Object.keys(profileWhere).length > 0) {
      filteredUsers = users.filter((user) => {
        if (!user.profile) return false;
        if (city && user.profile.city !== city) return false;
        if (country && user.profile.country !== country) return false;
        if (isStudent !== undefined && user.profile.isStudent !== (isStudent === 'true')) return false;
        return true;
      });
    }

    // Generate PDF
    const pdfBuffer = await generateSubscribersPDF(filteredUsers);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="subscribers-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate subscribers PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
