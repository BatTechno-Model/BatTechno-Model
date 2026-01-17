import express from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { reviewSchema } from '../utils/validation.js';

const router = express.Router();

// Create or update review
router.post('/', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { submissionId, score, rubricResult, feedback } = req.body;
    const reviewerId = req.user.id;

    const data = reviewSchema.parse({ score, rubricResult, feedback });

    const review = await prisma.review.upsert({
      where: {
        submissionId_reviewerId: {
          submissionId,
          reviewerId,
        },
      },
      update: {
        score: data.score,
        rubricResult: data.rubricResult,
        feedback: data.feedback,
      },
      create: {
        submissionId,
        reviewerId,
        score: data.score,
        rubricResult: data.rubricResult,
        feedback: data.feedback,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
          },
        },
        submission: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignment: {
              select: {
                id: true,
                title: true,
                maxScore: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ review });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Create review error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// Get reviews for a submission
router.get('/submission/:submissionId', authenticateToken, async (req, res) => {
  try {
    const { submissionId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { submissionId },
      include: {
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

export default router;
