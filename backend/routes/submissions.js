import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { submissionSchema } from '../utils/validation.js';
import { upload } from '../utils/upload.js';
import { getFileUrl, getFilePath } from '../utils/upload.js';
import fs from 'fs';

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

    console.log('Create submission request:', { 
      assignmentId, 
      studentId,
      filesCount: req.files?.length || 0,
      files: req.files?.map(f => ({ name: f.originalname, size: f.size }))
    });

    // Parse assets if provided as JSON string
    let parsedAssets = [];
    if (assets) {
      parsedAssets = typeof assets === 'string' ? JSON.parse(assets) : assets;
    }

    // Add uploaded files to assets
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        // Verify file was saved
        const filePath = getFilePath(file.filename);
        if (!fs.existsSync(filePath)) {
          console.error('File upload failed: File not saved to disk', filePath);
          throw new Error(`File upload failed: ${file.originalname} was not saved`);
        }
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

    console.log('Submission created successfully:', submission.id);
    res.status(201).json({ submission });
  } catch (error) {
    console.error('Create submission error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(500).json({ 
      error: 'Failed to create submission',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
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
