import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { submissionSchema } from '../utils/validation.js';
import { upload } from '../utils/upload.js';
import { getFileUrl } from '../utils/upload.js';

const router = express.Router();

// Get submissions for an assignment
router.get('/assignment/:assignmentId', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const submissions = await prisma.submission.findMany({
      where: { assignmentId },
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
      orderBy: { submittedAt: 'desc' },
    });

    res.json({ submissions });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

// Get submission by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: userId } = req.user;

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        assignment: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
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
    });

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check permissions
    if (role === 'STUDENT' && submission.studentId !== userId) {
      return res.status(403).json({ error: 'Not authorized to view this submission' });
    }

    res.json({ submission });
  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// Create submission (with file uploads)
// Allow up to 20 files of any type
router.post('/', authenticateToken, requireRole('STUDENT'), upload.array('files', 20), async (req, res) => {
  try {
    const { assignmentId, note, assets } = req.body;
    const studentId = req.user.id;

    // Parse assets if provided as JSON string
    let parsedAssets = [];
    if (assets) {
      parsedAssets = typeof assets === 'string' ? JSON.parse(assets) : assets;
    }

    // Add uploaded files to assets
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        parsedAssets.push({
          type: 'FILE',
          url: getFileUrl(file.filename),
          name: file.originalname,
        });
      });
    }

    const submission = await prisma.submission.create({
      data: {
        assignmentId,
        studentId,
        note,
        assets: {
          create: parsedAssets,
        },
      },
      include: {
        assignment: {
          select: {
            id: true,
            title: true,
          },
        },
        assets: true,
      },
    });

    res.status(201).json({ submission });
  } catch (error) {
    console.error('Create submission error:', error);
    res.status(500).json({ error: 'Failed to create submission' });
  }
});

// Update submission status (instructor)
router.patch('/:id/status', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    if (!['SUBMITTED', 'NEEDS_CHANGES', 'APPROVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const submission = await prisma.submission.update({
      where: { id },
      data: {
        status,
        note,
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        assets: true,
      },
    });

    res.json({ submission });
  } catch (error) {
    console.error('Update submission status error:', error);
    res.status(500).json({ error: 'Failed to update submission status' });
  }
});

export default router;
