import express from 'express';
import { body } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { handleValidationErrors } from '../utils/validation.js';

const router = express.Router();

// ========== ADMIN ENDPOINTS ==========

// Create exam (PRE or POST)
router.post('/sessions/:sessionId/exams', authenticateToken, requireRole('ADMIN'), [
  body('type').isIn(['PRE', 'POST']).withMessage('Type must be PRE or POST'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('examQuestionCount').isInt({ min: 1 }).withMessage('Exam question count must be at least 1'),
  body('timeLimitMinutes').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Time limit must be a positive integer'),
  body('attemptsAllowed').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Attempts allowed must be a positive integer'),
  body('availableFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available from date is required'),
  body('availableTo').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available to date is required'),
  body('showSolutionsAfterSubmit').optional().isBoolean().withMessage('showSolutionsAfterSubmit must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      type, 
      title, 
      description, 
      examQuestionCount,
      timeLimitMinutes, 
      attemptsAllowed, 
      availableFrom, 
      availableTo,
      showSolutionsAfterSubmit 
    } = req.body;
    const createdBy = req.user.id;

    // Check if exam of this type already exists for this session
    const existing = await prisma.exam.findUnique({
      where: {
        sessionId_type: {
          sessionId,
          type,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: `A ${type} exam already exists for this session` });
    }

    // Get session to verify it exists and get courseId
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { courseId: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const exam = await prisma.exam.create({
      data: {
        courseId: session.courseId,
        sessionId,
        type,
        title,
        description,
        examQuestionCount,
        timeLimitMinutes: timeLimitMinutes || null,
        attemptsAllowed: attemptsAllowed || 1,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableTo: availableTo ? new Date(availableTo) : null,
        showSolutionsAfterSubmit: showSolutionsAfterSubmit ?? false,
        createdBy,
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true },
        },
        creator: {
          select: { id: true, name: true },
        },
        _count: {
          select: { questions: true },
        },
      },
    });

    res.status(201).json({ exam });
  } catch (error) {
    console.error('Create exam error:', error);
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('model Exam')) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Exam tables do not exist. Please run: cd backend && npx prisma migrate dev --name add_exams',
        command: 'cd backend && npx prisma migrate dev --name add_exams',
      });
    }
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// Get exams for a session
router.get('/sessions/:sessionId/exams', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role } = req.user;

    const exams = await prisma.exam.findMany({
      where: { sessionId },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true },
        },
        creator: {
          select: { id: true, name: true },
        },
        _count: {
          select: { questions: true, attempts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ exams });
  } catch (error) {
    console.error('Get exams error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    if (
      errorCode === 'P2021' || 
      errorCode === 'P2001' ||
      errorMessage.includes('does not exist') || 
      errorMessage.includes('relation') || 
      errorMessage.includes('table') ||
      errorMessage.includes('Unknown model') ||
      errorMessage.includes('model Exam')
    ) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Exam tables do not exist. Please run: cd backend && npx prisma migrate dev --name add_exams',
        command: 'cd backend && npx prisma migrate dev --name add_exams',
        details: process.env.NODE_ENV === 'development' ? {
          code: errorCode,
          message: errorMessage,
          meta: error.meta,
        } : undefined,
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch exams',
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'An error occurred while fetching exams',
      code: process.env.NODE_ENV === 'development' ? errorCode : undefined,
    });
  }
});

// Get exam by ID
router.get('/exams/:examId', authenticateToken, async (req, res) => {
  try {
    const { examId } = req.params;
    const { role, id: userId } = req.user;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true, date: true },
        },
        creator: {
          select: { id: true, name: true },
        },
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        _count: {
          select: { questions: true, attempts: true },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Students can only see published exams for enrolled courses
    if (role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findFirst({
        where: {
          userId,
          courseId: exam.courseId,
          status: 'ACTIVE',
        },
      });

      if (!enrollment || exam.status !== 'PUBLISHED') {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({ exam });
  } catch (error) {
    console.error('Get exam error:', error);
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
});

// Update exam
router.put('/exams/:examId', authenticateToken, requireRole('ADMIN'), [
  body('title').optional({ checkFalsy: true }).isString().notEmpty().withMessage('Title cannot be empty'),
  body('examQuestionCount').optional().isInt({ min: 1 }).withMessage('Exam question count must be at least 1'),
  body('timeLimitMinutes').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Time limit must be a positive integer'),
  body('attemptsAllowed').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Attempts allowed must be a positive integer'),
  body('availableFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available from date is required'),
  body('availableTo').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available to date is required'),
  body('showSolutionsAfterSubmit').optional().isBoolean().withMessage('showSolutionsAfterSubmit must be a boolean'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { examId } = req.params;
    const { 
      title, 
      description, 
      examQuestionCount,
      timeLimitMinutes, 
      attemptsAllowed, 
      availableFrom, 
      availableTo,
      showSolutionsAfterSubmit 
    } = req.body;
    
    // Trim title and description if provided
    const trimmedTitle = title && typeof title === 'string' ? title.trim() : undefined;
    const trimmedDescription = description && typeof description === 'string' ? description.trim() : undefined;

    // Check exam exists
    const existing = await prisma.exam.findUnique({
      where: { id: examId },
      select: { _count: { select: { questions: true } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Validate examQuestionCount doesn't exceed available questions
    if (examQuestionCount !== undefined && examQuestionCount > existing._count.questions) {
      return res.status(400).json({ 
        error: `examQuestionCount (${examQuestionCount}) cannot exceed number of questions (${existing._count.questions})` 
      });
    }

    const updateData = {};
    if (trimmedTitle !== undefined) updateData.title = trimmedTitle;
    if (trimmedDescription !== undefined) updateData.description = trimmedDescription || null;
    if (examQuestionCount !== undefined) updateData.examQuestionCount = examQuestionCount;
    if (timeLimitMinutes !== undefined) updateData.timeLimitMinutes = timeLimitMinutes || null;
    if (attemptsAllowed !== undefined) updateData.attemptsAllowed = attemptsAllowed || 1;
    if (availableFrom !== undefined) updateData.availableFrom = availableFrom ? new Date(availableFrom) : null;
    if (availableTo !== undefined) updateData.availableTo = availableTo ? new Date(availableTo) : null;
    if (showSolutionsAfterSubmit !== undefined) updateData.showSolutionsAfterSubmit = showSolutionsAfterSubmit;

    const exam = await prisma.exam.update({
      where: { id: examId },
      data: updateData,
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true },
        },
        creator: {
          select: { id: true, name: true },
        },
        _count: {
          select: { questions: true },
        },
      },
    });

    res.json({ exam });
  } catch (error) {
    console.error('Update exam error:', error);
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

// Update exam status
router.put('/exams/:examId/status', authenticateToken, requireRole('ADMIN'), [
  body('status').isIn(['DRAFT', 'PUBLISHED', 'LOCKED']).withMessage('Status must be DRAFT, PUBLISHED, or LOCKED'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { examId } = req.params;
    const { status } = req.body;

    const exam = await prisma.exam.update({
      where: { id: examId },
      data: { status },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true },
        },
      },
    });

    res.json({ exam });
  } catch (error) {
    console.error('Update exam status error:', error);
    res.status(500).json({ error: 'Failed to update exam status' });
  }
});

// ========== QUESTION MANAGEMENT ==========

// Get all questions for an exam (ordered)
router.get('/exams/:examId/questions', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { examId } = req.params;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const questions = await prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { orderIndex: 'asc' },
    });

    res.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// Create question
router.post('/exams/:examId/questions', authenticateToken, requireRole('ADMIN'), [
  body('questionType').isIn(['MCQ', 'TRUE_FALSE']).withMessage('Question type must be MCQ or TRUE_FALSE'),
  body('prompt').trim().notEmpty().withMessage('Prompt is required'),
  body('choices').optional().isArray().withMessage('Choices must be an array'),
  body('correctAnswer').notEmpty().withMessage('Correct answer is required'),
  body('points').optional().isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('explanation').optional({ checkFalsy: true }).isString().withMessage('Explanation must be a string'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { examId } = req.params;
    const { questionType, prompt, choices, correctAnswer, points, explanation } = req.body;
    
    // Trim explanation if provided
    const trimmedExplanation = explanation && typeof explanation === 'string' ? explanation.trim() : null;

    // Validate exam exists
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true, _count: { select: { questions: true } } },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Validate MCQ has choices
    if (questionType === 'MCQ' && (!choices || !Array.isArray(choices) || choices.length < 2)) {
      return res.status(400).json({ error: 'MCQ questions must have at least 2 choices' });
    }

    // Validate correctAnswer format
    if (questionType === 'MCQ') {
      const correctIndex = typeof correctAnswer === 'number' ? correctAnswer : parseInt(correctAnswer);
      if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) {
        return res.status(400).json({ error: 'Correct answer must be a valid choice index' });
      }
    } else if (questionType === 'TRUE_FALSE') {
      if (typeof correctAnswer !== 'boolean' && correctAnswer !== 'true' && correctAnswer !== 'false') {
        return res.status(400).json({ error: 'TRUE_FALSE correct answer must be a boolean' });
      }
    }

    const nextOrderIndex = exam._count.questions;

    const question = await prisma.examQuestion.create({
      data: {
        examId,
        questionType,
        prompt,
        choices: questionType === 'MCQ' ? choices : null,
        correctAnswer: questionType === 'MCQ' 
          ? correctIndex 
          : (correctAnswer === 'true' || correctAnswer === true),
        points: points || 1,
        explanation: trimmedExplanation || null,
        orderIndex: nextOrderIndex,
      },
      include: {
        exam: {
          select: { id: true, title: true },
        },
      },
    });

    res.status(201).json({ question });
  } catch (error) {
    console.error('Create question error:', error);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Update question
router.put('/questions/:questionId', authenticateToken, requireRole('ADMIN'), [
  body('prompt').optional({ checkFalsy: true }).trim().notEmpty().withMessage('Prompt cannot be empty'),
  body('choices').optional().isArray().withMessage('Choices must be an array'),
  body('correctAnswer').optional().notEmpty().withMessage('Correct answer cannot be empty'),
  body('points').optional().isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('explanation').optional({ checkFalsy: true }).isString().withMessage('Explanation must be a string'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { questionId } = req.params;
    const { prompt, choices, correctAnswer, points, explanation } = req.body;
    
    // Trim explanation if provided
    const trimmedExplanation = explanation && typeof explanation === 'string' ? explanation.trim() : null;

    const existing = await prisma.examQuestion.findUnique({
      where: { id: questionId },
      include: { exam: { select: { id: true, examQuestionCount: true, _count: { select: { questions: true } } } } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const updateData = {};
    // Trim prompt if provided
    const trimmedPrompt = prompt && typeof prompt === 'string' ? prompt.trim() : undefined;
    if (trimmedPrompt !== undefined) updateData.prompt = trimmedPrompt;
    if (points !== undefined) updateData.points = points;
    if (explanation !== undefined) updateData.explanation = trimmedExplanation || null;

    // Handle choices and correctAnswer for MCQ
    if (existing.questionType === 'MCQ') {
      if (choices !== undefined) {
        if (!Array.isArray(choices) || choices.length < 2) {
          return res.status(400).json({ error: 'MCQ questions must have at least 2 choices' });
        }
        updateData.choices = choices;
      }

      if (correctAnswer !== undefined) {
        const correctIndex = typeof correctAnswer === 'number' ? correctAnswer : parseInt(correctAnswer);
        const choicesToCheck = choices || existing.choices;
        if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= choicesToCheck.length) {
          return res.status(400).json({ error: 'Correct answer must be a valid choice index' });
        }
        updateData.correctAnswer = correctIndex;
      }
    } else if (existing.questionType === 'TRUE_FALSE') {
      if (correctAnswer !== undefined) {
        updateData.correctAnswer = correctAnswer === 'true' || correctAnswer === true;
      }
    }

    const question = await prisma.examQuestion.update({
      where: { id: questionId },
      data: updateData,
      include: {
        exam: {
          select: { id: true, title: true },
        },
      },
    });

    res.json({ question });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete question
router.delete('/questions/:questionId', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { questionId } = req.params;

    const question = await prisma.examQuestion.findUnique({
      where: { id: questionId },
      select: { examId: true, orderIndex: true },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await prisma.examQuestion.delete({
      where: { id: questionId },
    });

    // Reorder remaining questions
    await prisma.examQuestion.updateMany({
      where: {
        examId: question.examId,
        orderIndex: { gt: question.orderIndex },
      },
      data: {
        orderIndex: { decrement: 1 },
      },
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Reorder questions
router.put('/exams/:examId/questions/reorder', authenticateToken, requireRole('ADMIN'), [
  body('orderedIds').isArray().withMessage('orderedIds must be an array'),
  body('orderedIds.*').isString().withMessage('Each ID must be a string'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { examId } = req.params;
    const { orderedIds } = req.body;

    // Verify exam exists
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Verify all questions belong to this exam
    const questions = await prisma.examQuestion.findMany({
      where: {
        id: { in: orderedIds },
        examId,
      },
    });

    if (questions.length !== orderedIds.length) {
      return res.status(400).json({ error: 'Some questions do not belong to this exam' });
    }

    // Update orderIndex for each question
    await Promise.all(
      orderedIds.map((questionId, index) =>
        prisma.examQuestion.update({
          where: { id: questionId },
          data: { orderIndex: index },
        })
      )
    );

    res.json({ message: 'Questions reordered successfully' });
  } catch (error) {
    console.error('Reorder questions error:', error);
    res.status(500).json({ error: 'Failed to reorder questions' });
  }
});

// Duplicate question
router.post('/questions/:questionId/duplicate', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { questionId } = req.params;

    const original = await prisma.examQuestion.findUnique({
      where: { id: questionId },
    });

    if (!original) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Get the next orderIndex (after original)
    const nextOrderIndex = original.orderIndex + 1;

    // Shift all questions after original down by 1
    await prisma.examQuestion.updateMany({
      where: {
        examId: original.examId,
        orderIndex: { gte: nextOrderIndex },
      },
      data: {
        orderIndex: { increment: 1 },
      },
    });

    // Create duplicate
    const duplicate = await prisma.examQuestion.create({
      data: {
        examId: original.examId,
        questionType: original.questionType,
        prompt: `${original.prompt} (Copy)`,
        choices: original.choices,
        correctAnswer: original.correctAnswer,
        points: original.points,
        explanation: original.explanation,
        orderIndex: nextOrderIndex,
      },
      include: {
        exam: {
          select: { id: true, title: true },
        },
      },
    });

    res.status(201).json({ question: duplicate });
  } catch (error) {
    console.error('Duplicate question error:', error);
    res.status(500).json({ error: 'Failed to duplicate question' });
  }
});

// Bulk update questions (for autosave)
router.put('/exams/:examId/questions/bulk', authenticateToken, requireRole('ADMIN'), [
  body('questions').isArray().withMessage('Questions must be an array'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { examId } = req.params;
    const { questions } = req.body;

    // Verify exam exists
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      select: { id: true },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Update each question
    const updatedQuestions = await Promise.all(
      questions.map(async (q) => {
        const { id, prompt, choices, correctAnswer, points, explanation, orderIndex } = q;

        // Validate question belongs to exam
        const existing = await prisma.examQuestion.findFirst({
          where: { id, examId },
        });

        if (!existing) {
          throw new Error(`Question ${id} does not belong to this exam`);
        }

        const updateData = {};
        if (prompt !== undefined) updateData.prompt = prompt.trim();
        if (points !== undefined) updateData.points = points;
        if (orderIndex !== undefined) updateData.orderIndex = orderIndex;
        if (explanation !== undefined) {
          updateData.explanation = explanation && typeof explanation === 'string' ? explanation.trim() : null;
        }

        // Handle choices and correctAnswer for MCQ
        if (existing.questionType === 'MCQ') {
          if (choices !== undefined) {
            if (!Array.isArray(choices) || choices.length < 2) {
              throw new Error('MCQ questions must have at least 2 choices');
            }
            updateData.choices = choices;
          }

          if (correctAnswer !== undefined) {
            const correctIndex = typeof correctAnswer === 'number' ? correctAnswer : parseInt(correctAnswer);
            const choicesToCheck = choices || existing.choices;
            if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= choicesToCheck.length) {
              throw new Error('Correct answer must be a valid choice index');
            }
            updateData.correctAnswer = correctIndex;
          }
        } else if (existing.questionType === 'TRUE_FALSE') {
          if (correctAnswer !== undefined) {
            updateData.correctAnswer = correctAnswer === 'true' || correctAnswer === true;
          }
        }

        return prisma.examQuestion.update({
          where: { id },
          data: updateData,
        });
      })
    );

    res.json({ questions: updatedQuestions });
  } catch (error) {
    console.error('Bulk update questions error:', error);
    res.status(400).json({ error: error.message || 'Failed to bulk update questions' });
  }
});

// ========== STUDENT ENDPOINTS ==========

// Get available exams for student
router.get('/my/exams', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { id: studentId } = req.user;
    const now = new Date();

    // Get enrolled courses
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: studentId,
        status: 'ACTIVE',
      },
      select: { courseId: true },
    });

    const courseIds = enrollments.map(e => e.courseId);

    const exams = await prisma.exam.findMany({
      where: {
        courseId: { in: courseIds },
        status: 'PUBLISHED',
        OR: [
          { availableFrom: null },
          { availableFrom: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { availableTo: null },
              { availableTo: { gte: now } },
            ],
          },
        ],
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true, date: true },
        },
        _count: {
          select: { questions: true },
        },
      },
      orderBy: [
        { session: { date: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    // Check attempts for each exam
    const examsWithAttempts = await Promise.all(
      exams.map(async (exam) => {
        const attempts = await prisma.examAttempt.findMany({
          where: {
            examId: exam.id,
            studentId,
          },
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        });

        const canTake = attempts.length === 0 || 
          (attempts[0].status === 'SUBMITTED' && attempts.length < exam.attemptsAllowed);

        return {
          ...exam,
          canTake,
          lastAttempt: attempts[0] || null,
        };
      })
    );

    res.json({ exams: examsWithAttempts });
  } catch (error) {
    console.error('Get my exams error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check if it's a missing table error
    if (error.code === 'P2021' || error.message?.includes('does not exist') || error.message?.includes('model Exam')) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Exam tables do not exist. Please run: cd backend && npx prisma migrate dev --name add_exams',
        command: 'cd backend && npx prisma migrate dev --name add_exams',
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch exams',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code,
    });
  }
});

// Start exam attempt
router.post('/exams/:examId/attempts/start', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { examId } = req.params;
    const { id: studentId } = req.user;
    const now = new Date();

    // Get exam with questions
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
        },
        course: {
          select: { id: true },
        },
      },
    });

    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: studentId,
        courseId: exam.courseId,
        status: 'ACTIVE',
      },
    });

    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled in this course' });
    }

    // Check status
    if (exam.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Exam is not available' });
    }

    // Check availability window
    if (exam.availableFrom && new Date(exam.availableFrom) > now) {
      return res.status(403).json({ error: 'Exam is not yet available' });
    }
    if (exam.availableTo && new Date(exam.availableTo) < now) {
      return res.status(403).json({ error: 'Exam is no longer available' });
    }

    // Check attempts allowed
    const existingAttempts = await prisma.examAttempt.findMany({
      where: {
        examId,
        studentId,
      },
    });

    if (existingAttempts.length >= exam.attemptsAllowed) {
      const latestAttempt = existingAttempts.find(a => a.status === 'IN_PROGRESS');
      if (!latestAttempt) {
        return res.status(403).json({ error: 'Maximum attempts reached' });
      }
      // Return existing in-progress attempt
      const attemptWithQuestions = await prisma.examAttempt.findUnique({
        where: { id: latestAttempt.id },
        include: {
          exam: {
            include: {
              questions: {
                where: {
                  id: { in: latestAttempt.servedQuestionIds || [] },
                },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      });

      return res.json({ attempt: attemptWithQuestions });
    }

    // Validate examQuestionCount
    if (exam.examQuestionCount > exam.questions.length) {
      return res.status(400).json({ 
        error: `Exam requires ${exam.examQuestionCount} questions but only ${exam.questions.length} available` 
      });
    }

    // Select random questions
    const questionCount = Math.min(exam.examQuestionCount, exam.questions.length);
    const shuffled = [...exam.questions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, questionCount);
    const servedQuestionIds = selectedQuestions.map(q => q.id);

    // Get next attempt number
    const attemptNumber = existingAttempts.length + 1;

    // Create attempt
    const attempt = await prisma.examAttempt.create({
      data: {
        examId,
        studentId,
        attemptNumber,
        servedQuestionIds,
        maxRawScore: selectedQuestions.reduce((sum, q) => sum + q.points, 0),
      },
      include: {
        exam: {
          include: {
            questions: {
              where: {
                id: { in: servedQuestionIds },
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    // Remove correct answers from questions before sending to student
    const questionsWithoutAnswers = attempt.exam.questions.map(q => {
      const { correctAnswer, ...questionWithoutAnswer } = q;
      return questionWithoutAnswer;
    });

    res.json({
      attempt: {
        ...attempt,
        exam: {
          ...attempt.exam,
          questions: questionsWithoutAnswers,
        },
      },
    });
  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({ error: 'Failed to start exam attempt' });
  }
});

// Submit answer (autosave)
router.post('/attempts/:attemptId/answer', authenticateToken, requireRole('STUDENT'), [
  body('questionId').notEmpty().withMessage('Question ID is required'),
  body('answer').notEmpty().withMessage('Answer is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, answer } = req.body;
    const { id: studentId } = req.user;

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: true,
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.studentId !== studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (attempt.status === 'SUBMITTED') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    // Verify question is part of served questions
    if (!attempt.servedQuestionIds.includes(questionId)) {
      return res.status(400).json({ error: 'Question not part of this attempt' });
    }

    const question = attempt.exam.questions.find(q => q.id === questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Grade answer
    let isCorrect = false;
    if (question.questionType === 'MCQ') {
      const correctIndex = typeof question.correctAnswer === 'number' 
        ? question.correctAnswer 
        : parseInt(question.correctAnswer);
      const studentAnswer = typeof answer === 'number' ? answer : parseInt(answer);
      isCorrect = studentAnswer === correctIndex;
    } else if (question.questionType === 'TRUE_FALSE') {
      const correctAnswer = question.correctAnswer === true || question.correctAnswer === 'true';
      const studentAnswer = answer === true || answer === 'true' || answer === 'True';
      isCorrect = studentAnswer === correctAnswer;
    }

    const earnedPoints = isCorrect ? question.points : 0;

    // Upsert answer
    const examAnswer = await prisma.examAnswer.upsert({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
      update: {
        answer,
        isCorrect,
        earnedPoints,
      },
      create: {
        attemptId,
        questionId,
        answer,
        isCorrect,
        earnedPoints,
      },
    });

    res.json({ answer: examAnswer });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

// Submit attempt
router.post('/attempts/:attemptId/submit', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { id: studentId } = req.user;
    const now = new Date();

    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            questions: {
              where: {
                id: { in: [] }, // Will be populated from servedQuestionIds
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.studentId !== studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (attempt.status === 'SUBMITTED') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    // Check time limit
    if (attempt.exam.timeLimitMinutes) {
      const elapsedMinutes = (now - new Date(attempt.startedAt)) / (1000 * 60);
      if (elapsedMinutes > attempt.exam.timeLimitMinutes) {
        return res.status(400).json({ error: 'Time limit exceeded' });
      }
    }

    // Get all answers for this attempt
    const answers = await prisma.examAnswer.findMany({
      where: { attemptId },
      include: {
        question: true,
      },
    });

    // Calculate scores
    const rawScore = answers.reduce((sum, a) => sum + a.earnedPoints, 0);
    const maxRawScore = attempt.maxRawScore || attempt.exam.questions.reduce((sum, q) => sum + q.points, 0);
    
    // Normalize to out of 10
    const finalScore10 = maxRawScore > 0 
      ? Math.round((rawScore / maxRawScore) * 10 * 10) / 10 // Round to 1 decimal
      : 0;
    const percentage = maxRawScore > 0 ? (rawScore / maxRawScore) * 100 : 0;

    // Update attempt
    const submittedAttempt = await prisma.examAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
        rawScore,
        maxRawScore,
        finalScore10,
        percentage,
      },
      include: {
        exam: {
          include: {
            questions: {
              where: {
                id: { in: attempt.servedQuestionIds || [] },
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    // Include correct answers if showSolutionsAfterSubmit is enabled
    if (attempt.exam.showSolutionsAfterSubmit) {
      res.json({ attempt: submittedAttempt });
    } else {
      // Remove correct answers
      const attemptWithoutAnswers = {
        ...submittedAttempt,
        exam: {
          ...submittedAttempt.exam,
          questions: submittedAttempt.exam.questions.map(q => {
            const { correctAnswer, ...questionWithoutAnswer } = q;
            return questionWithoutAnswer;
          }),
        },
      };
      res.json({ attempt: attemptWithoutAnswers });
    }
  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: 'Failed to submit attempt' });
  }
});

// Get exam result by attempt ID
router.get('/attempts/:attemptId/result', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { id: studentId } = req.user;

    const attempt = await prisma.examAttempt.findUnique({
      where: {
        id: attemptId,
      },
      include: {
        exam: {
          include: {
            session: {
              select: { id: true, topic: true },
            },
            course: {
              select: { id: true, title: true },
            },
            questions: {
              where: {
                id: { in: [] }, // Will be populated from servedQuestionIds
              },
            },
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.studentId !== studentId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Populate questions from servedQuestionIds
    const questions = await prisma.examQuestion.findMany({
      where: {
        id: { in: attempt.servedQuestionIds || [] },
      },
      orderBy: { orderIndex: 'asc' },
    });

    res.json({ 
      attempt: {
        ...attempt,
        exam: {
          ...attempt.exam,
          questions,
        },
      },
    });
  } catch (error) {
    console.error('Get exam result error:', error);
    res.status(500).json({ error: 'Failed to fetch exam result' });
  }
});

// Get exam result (latest attempt for exam)
router.get('/my/exams/:examId/result', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { examId } = req.params;
    const { id: studentId } = req.user;

    const latestAttempt = await prisma.examAttempt.findFirst({
      where: {
        examId,
        studentId,
        status: 'SUBMITTED',
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        exam: {
          include: {
            session: {
              select: { id: true, topic: true },
            },
            course: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    if (!latestAttempt) {
      return res.status(404).json({ error: 'No submitted attempt found' });
    }

    res.json({ attempt: latestAttempt });
  } catch (error) {
    console.error('Get exam result error:', error);
    res.status(500).json({ error: 'Failed to fetch exam result' });
  }
});

// ========== ANALYTICS ENDPOINTS ==========

// Get exam analytics for a session
router.get('/sessions/:sessionId/exams/analytics', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { sessionId } = req.params;

    const exams = await prisma.exam.findMany({
      where: { sessionId },
      include: {
        attempts: {
          where: { status: 'SUBMITTED' },
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    // Group by student
    const studentMap = new Map();

    exams.forEach(exam => {
      exam.attempts.forEach(attempt => {
        const studentId = attempt.studentId;
        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            student: attempt.student,
            preScore: null,
            postScore: null,
            preAttemptId: null,
            postAttemptId: null,
          });
        }

        const studentData = studentMap.get(studentId);
        if (exam.type === 'PRE') {
          studentData.preScore = attempt.finalScore10;
          studentData.preAttemptId = attempt.id;
        } else if (exam.type === 'POST') {
          studentData.postScore = attempt.finalScore10;
          studentData.postAttemptId = attempt.id;
        }
      });
    });

    const analytics = Array.from(studentMap.values()).map(data => ({
      ...data,
      improvement: data.preScore !== null && data.postScore !== null 
        ? Math.round((data.postScore - data.preScore) * 10) / 10 
        : null,
    }));

    res.json({ analytics });
  } catch (error) {
    console.error('Get exam analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get exam analytics for a course
router.get('/courses/:courseId/exams/analytics', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { courseId } = req.params;

    const exams = await prisma.exam.findMany({
      where: { courseId },
      include: {
        session: {
          select: { id: true, topic: true, date: true },
        },
        attempts: {
          where: { status: 'SUBMITTED' },
          include: {
            student: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: {
        session: { date: 'asc' },
      },
    });

    res.json({ exams });
  } catch (error) {
    console.error('Get course exam analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
