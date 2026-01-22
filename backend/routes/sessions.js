import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateSession } from '../utils/validation.js';

const router = express.Router();

// Get sessions by course
router.get('/course/:courseId', authenticateToken, async (req, res) => {
  try {
    const { courseId } = req.params;

    const sessions = await prisma.session.findMany({
      where: { courseId },
      include: {
        _count: {
          select: {
            attendances: true,
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get all sessions (Admin only)
router.get('/all', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      include: {
        course: {
          select: {
            id: true,
            title: true,
          },
        },
        _count: {
          select: {
            attendances: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ sessions });
  } catch (error) {
    console.error('Get all sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        course: {
          include: {
            enrollments: {
              where: {
                status: 'ACTIVE',
              },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    profile: {
                      select: {
                        avatar: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        attendances: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                profile: {
                  select: {
                    avatar: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ session });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create session
router.post('/', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), validateSession, async (req, res) => {
  try {
    const { courseId, date, startTime, endTime, topic, notes } = req.body;

    const session = await prisma.session.create({
      data: {
        courseId,
        date: new Date(date),
        startTime,
        endTime,
        topic,
        notes,
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

    res.status(201).json({ session });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Bulk create sessions
router.post('/bulk', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { courseId, sessions } = req.body;

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return res.status(400).json({ error: 'Sessions array is required' });
    }

    const createdSessions = await Promise.all(
      sessions.map((s) =>
        prisma.session.create({
          data: {
            courseId,
            date: new Date(s.date),
            startTime: s.startTime,
            endTime: s.endTime,
            topic: s.topic,
            notes: s.notes,
          },
        })
      )
    );

    res.status(201).json({ sessions: createdSessions });
  } catch (error) {
    console.error('Bulk create sessions error:', error);
    res.status(500).json({ error: 'Failed to create sessions' });
  }
});

// Update session
router.put('/:id', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), validateSession, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, topic, notes } = req.body;

    const session = await prisma.session.update({
      where: { id },
      data: {
        date: new Date(date),
        startTime,
        endTime,
        topic,
        notes,
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

    res.json({ session });
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/:id', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.session.delete({
      where: { id },
    });

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
