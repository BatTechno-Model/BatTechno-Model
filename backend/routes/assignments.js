import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateAssignment } from '../utils/validation.js';

const router = express.Router();

// Get assignments by course
router.get('/course/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;
    const { role, id: userId } = req.user;

    const where = { courseId };
    // Students only see published assignments
    if (role === 'STUDENT') {
      where.isPublished = true;
    }

    let assignments;
    try {
      assignments = await prisma.assignment.findMany({
        where,
        include: {
          _count: {
            select: {
              submissions: true,
            },
          },
          resources: {
            select: {
              id: true,
              type: true,
              name: true,
              url: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      });
    } catch (error) {
      // Fallback if resources relation doesn't exist
      console.warn('Error fetching assignments with resources, trying without:', error.message);
      assignments = await prisma.assignment.findMany({
        where,
        include: {
          _count: {
            select: {
              submissions: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      });
      // Add empty resources array
      assignments = assignments.map((a) => ({ ...a, resources: [] }));
    }

    // If student, include their submission status
    if (role === 'STUDENT') {
      const assignmentsWithStatus = await Promise.all(
        assignments.map(async (assignment) => {
          const submission = await prisma.submission.findFirst({
            where: {
              assignmentId: assignment.id,
              studentId: userId,
            },
            orderBy: { submittedAt: 'desc' },
          });

          return {
            ...assignment,
            mySubmission: submission
              ? {
                  id: submission.id,
                  status: submission.status,
                  submittedAt: submission.submittedAt,
                }
              : null,
          };
        })
      );

      return res.json({ assignments: assignmentsWithStatus });
    }

    res.json({ assignments });
  } catch (error) {
    console.error('Get assignments error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch assignments',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code,
    });
  }
});

// Get assignment by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
        resources: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        submissions: role === 'STUDENT' ? false : {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assets: true,
            reviews: {
              include: {
                reviewer: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Students can only view published assignments
    if (role === 'STUDENT' && !assignment.isPublished) {
      return res.status(403).json({ error: 'Assignment not published yet' });
    }

    // If student, include their submission
    if (role === 'STUDENT') {
      const mySubmission = await prisma.submission.findFirst({
        where: {
          assignmentId: id,
          studentId: userId,
        },
        include: {
          assets: true,
          reviews: {
            include: {
              reviewer: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      return res.json({
        assignment: {
          ...assignment,
          mySubmission,
        },
      });
    }

    res.json({ assignment });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// Create assignment
router.post('/', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), validateAssignment, async (req, res) => {
  try {
    const { courseId, title, description, dueDate, maxScore, rubric, isPublished } = req.body;

    const assignment = await prisma.assignment.create({
      data: {
        courseId,
        title,
        description,
        dueDate: new Date(dueDate),
        maxScore: maxScore || 100,
        rubric: rubric || null,
        isPublished: isPublished === true,
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

    res.status(201).json({ assignment });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

// Update assignment
router.put('/:id', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), validateAssignment, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, maxScore, rubric, isPublished } = req.body;

    const assignment = await prisma.assignment.update({
      where: { id },
      data: {
        title,
        description,
        dueDate: new Date(dueDate),
        maxScore,
        rubric,
        ...(isPublished !== undefined && { isPublished: isPublished === true }),
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

    res.json({ assignment });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// Publish/Unpublish assignment
router.patch('/:id/publish', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    const assignment = await prisma.assignment.update({
      where: { id },
      data: { isPublished: isPublished === true },
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    res.json({ assignment });
  } catch (error) {
    console.error('Publish assignment error:', error);
    res.status(500).json({ error: 'Failed to update assignment publish status' });
  }
});

// Delete assignment
router.delete('/:id', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.assignment.delete({
      where: { id },
    });

    res.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

export default router;
