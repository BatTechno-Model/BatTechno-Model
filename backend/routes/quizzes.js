import express from 'express';
import { body } from 'express-validator';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validateQuiz, validateQuestion, handleValidationErrors } from '../utils/validation.js';
import { computeStudentEvaluation, recomputeSessionEvaluations } from '../utils/evaluation.js';

const router = express.Router();

// ========== ADMIN ENDPOINTS ==========

// Create quiz (PRE or POST)
router.post('/courses/:courseId/sessions/:sessionId/quizzes', authenticateToken, requireRole('ADMIN'), [
  body('type').isIn(['PRE', 'POST']).withMessage('Type must be PRE or POST'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional({ checkFalsy: true }).isString().withMessage('Description must be a string'),
  body('timeLimitMinutes').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Time limit must be a positive integer'),
  body('attemptsAllowed').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Attempts allowed must be a positive integer'),
  body('availableFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available from date is required'),
  body('availableTo').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available to date is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { courseId, sessionId } = req.params;
    const { type, title, description, timeLimitMinutes, attemptsAllowed, availableFrom, availableTo } = req.body;
    const createdBy = req.user.id;
    
    // Trim description if provided
    const trimmedDescription = description && typeof description === 'string' ? description.trim() : null;

    // Check if quiz of this type already exists for this session
    const existing = await prisma.quiz.findUnique({
      where: {
        sessionId_type: {
          sessionId,
          type,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: `A ${type} quiz already exists for this session` });
    }

    // Verify session belongs to course
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { courseId: true },
    });

    if (!session || session.courseId !== courseId) {
      return res.status(404).json({ error: 'Session not found in this course' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        courseId,
        sessionId,
        type,
        title,
        description: trimmedDescription || null,
        timeLimitMinutes: timeLimitMinutes || null,
        attemptsAllowed: attemptsAllowed || 1,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableTo: availableTo ? new Date(availableTo) : null,
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
      },
    });

    res.status(201).json({ quiz });
  } catch (error) {
    console.error('Create quiz error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    // Check if it's a Prisma table doesn't exist error
    if (
      errorCode === 'P2021' || 
      errorCode === 'P2001' ||
      errorMessage.includes('does not exist') || 
      errorMessage.includes('relation') || 
      errorMessage.includes('table') ||
      errorMessage.includes('Unknown model') ||
      errorMessage.includes('model Quiz')
    ) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Quiz tables do not exist in the database. Please run the migration:',
        command: 'cd backend && npx prisma migrate dev --name add_quizzes',
        details: process.env.NODE_ENV === 'development' ? {
          code: errorCode,
          message: errorMessage,
          meta: error.meta,
        } : undefined,
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create quiz',
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'An error occurred while creating quiz',
      code: process.env.NODE_ENV === 'development' ? errorCode : undefined,
    });
  }
});

// Get quizzes for a session
router.get('/sessions/:sessionId/quizzes', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role } = req.user;

    const quizzes = await prisma.quiz.findMany({
      where: { sessionId },
      include: {
        _count: {
          select: {
            questions: true,
            attempts: true,
          },
        },
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true },
        },
      },
      orderBy: { type: 'asc' },
    });

    // Students only see published quizzes
    const filteredQuizzes = role === 'STUDENT'
      ? quizzes.filter((q) => q.status === 'PUBLISHED')
      : quizzes;

    res.json({ quizzes: filteredQuizzes });
  } catch (error) {
    console.error('Get quizzes error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error meta:', error.meta);
    
    // Check if it's a Prisma table doesn't exist error
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    
    if (
      errorCode === 'P2021' || 
      errorCode === 'P2001' ||
      errorMessage.includes('does not exist') || 
      errorMessage.includes('relation') || 
      errorMessage.includes('table') ||
      errorMessage.includes('Unknown model') ||
      errorMessage.includes('model Quiz')
    ) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'Quiz tables do not exist in the database. Please run the migration:',
        command: 'cd backend && npx prisma migrate dev --name add_quizzes',
        details: process.env.NODE_ENV === 'development' ? {
          code: errorCode,
          message: errorMessage,
          meta: error.meta,
        } : undefined,
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch quizzes',
      message: process.env.NODE_ENV === 'development' ? errorMessage : 'An error occurred while fetching quizzes',
      code: process.env.NODE_ENV === 'development' ? errorCode : undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Get quiz by ID
router.get('/quizzes/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const { role, id: userId } = req.user;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
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
          // Don't expose correct answers to students until after submission
          select: role === 'ADMIN' ? undefined : {
            id: true,
            type: true,
            prompt: true,
            choices: true,
            points: true,
            tags: true,
            orderIndex: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Students can only view published quizzes
    if (role === 'STUDENT' && quiz.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Quiz not published yet' });
    }

    // If student, include their attempts
    if (role === 'STUDENT') {
      const attempts = await prisma.quizAttempt.findMany({
        where: {
          quizId,
          studentId: userId,
        },
        orderBy: { attemptNumber: 'desc' },
      });

      return res.json({
        quiz: {
          ...quiz,
          myAttempts: attempts,
        },
      });
    }

    res.json({ quiz });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Update quiz metadata
router.put('/quizzes/:quizId', authenticateToken, requireRole('ADMIN'), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('timeLimitMinutes').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Time limit must be a positive integer'),
  body('attemptsAllowed').optional({ checkFalsy: true }).isInt({ min: 1 }).withMessage('Attempts allowed must be a positive integer'),
  body('availableFrom').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available from date is required'),
  body('availableTo').optional({ checkFalsy: true }).isISO8601().withMessage('Valid available to date is required'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { quizId } = req.params;
    const { title, description, timeLimitMinutes, attemptsAllowed, availableFrom, availableTo } = req.body;

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
      data: {
        title,
        description,
        timeLimitMinutes: timeLimitMinutes || null,
        attemptsAllowed: attemptsAllowed || 1,
        availableFrom: availableFrom ? new Date(availableFrom) : null,
        availableTo: availableTo ? new Date(availableTo) : null,
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true },
        },
      },
    });

    res.json({ quiz });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Update quiz status
router.put('/quizzes/:quizId/status', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { status } = req.body;

    if (!['DRAFT', 'PUBLISHED', 'LOCKED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const quiz = await prisma.quiz.update({
      where: { id: quizId },
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

    res.json({ quiz });
  } catch (error) {
    console.error('Update quiz status error:', error);
    res.status(500).json({ error: 'Failed to update quiz status' });
  }
});

// Delete quiz
router.delete('/quizzes/:quizId', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { quizId } = req.params;

    await prisma.quiz.delete({
      where: { id: quizId },
    });

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// ========== QUESTION CRUD ==========

// Get all questions for a quiz
router.get('/quizzes/:quizId/questions', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { quizId } = req.params;

    // Verify quiz exists
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = await prisma.quizQuestion.findMany({
      where: { quizId },
      orderBy: { orderIndex: 'asc' },
    });

    res.json({ questions });
  } catch (error) {
    console.error('Get quiz questions error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    res.status(500).json({ 
      error: 'Failed to fetch questions',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Create question
router.post('/quizzes/:quizId/questions', authenticateToken, requireRole('ADMIN'), validateQuestion, async (req, res) => {
  try {
    const { quizId } = req.params;
    let { type, prompt, choices, correctAnswer, points, tags, orderIndex } = req.body;
    
    // Trim prompt if provided
    if (prompt && typeof prompt === 'string') {
      prompt = prompt.trim();
    }
    
    // Allow empty prompt for initial question creation (user will fill it later)
    // But set a default placeholder if empty
    if (!prompt || prompt === '') {
      prompt = 'Untitled Question'; // Default placeholder
    }

    // Validate quiz exists
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Validate MCQ has choices
    if (type === 'MCQ' && (!choices || !Array.isArray(choices) || choices.length < 2)) {
      return res.status(400).json({ error: 'MCQ questions must have at least 2 choices' });
    }

    // Validate correctAnswer format
    if (type === 'MCQ') {
      const correctIndex = typeof correctAnswer === 'number' ? correctAnswer : parseInt(correctAnswer);
      if (isNaN(correctIndex) || correctIndex < 0 || (choices && correctIndex >= choices.length)) {
        return res.status(400).json({ error: 'Correct answer must be a valid choice index' });
      }
    } else if (type === 'TRUE_FALSE') {
      if (typeof correctAnswer !== 'boolean' && correctAnswer !== 'true' && correctAnswer !== 'false') {
        return res.status(400).json({ error: 'TRUE_FALSE correct answer must be a boolean' });
      }
    }

    // Get max orderIndex to set default
    const maxOrder = await prisma.quizQuestion.findFirst({
      where: { quizId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    // Handle correctAnswer - must have a value (Prisma Json field is not nullable)
    let processedCorrectAnswer;
    if (correctAnswer !== undefined && correctAnswer !== null && correctAnswer !== '') {
      if (type === 'MCQ') {
        const correctIndex = typeof correctAnswer === 'number' ? correctAnswer : parseInt(correctAnswer);
        if (!isNaN(correctIndex) && correctIndex >= 0 && (!choices || correctIndex < choices.length)) {
          processedCorrectAnswer = correctIndex;
        } else {
          processedCorrectAnswer = 0; // Default to first choice
        }
      } else if (type === 'TRUE_FALSE') {
        processedCorrectAnswer = correctAnswer === 'true' || correctAnswer === true;
      } else {
        processedCorrectAnswer = ''; // For SHORT_TEXT
      }
    } else {
      // Set default values for initial creation
      if (type === 'MCQ') {
        processedCorrectAnswer = 0; // Default to first choice
      } else if (type === 'TRUE_FALSE') {
        processedCorrectAnswer = true; // Default to true
      } else {
        processedCorrectAnswer = ''; // For SHORT_TEXT
      }
    }

    const question = await prisma.quizQuestion.create({
      data: {
        quizId,
        type,
        prompt,
        choices: choices && choices.length > 0 ? choices : null,
        correctAnswer: processedCorrectAnswer,
        points: points || 1,
        tags: tags || [],
        orderIndex: orderIndex !== undefined ? orderIndex : (maxOrder?.orderIndex ?? -1) + 1,
      },
    });

    res.status(201).json({ question });
  } catch (error) {
    console.error('Create question error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      meta: error.meta,
    });
    res.status(500).json({ 
      error: 'Failed to create question',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    });
  }
});

// Update question
router.put('/questions/:questionId', authenticateToken, requireRole('ADMIN'), [
  body('type').optional().isIn(['MCQ', 'TRUE_FALSE', 'SHORT_TEXT']).withMessage('Type must be MCQ, TRUE_FALSE, or SHORT_TEXT'),
  body('prompt').optional({ checkFalsy: true }).isString().withMessage('Prompt must be a string'),
  body('correctAnswer').optional().custom((value, { req }) => {
    // For MCQ and TRUE_FALSE, correctAnswer validation
    const type = req.body.type;
    if (type === 'MCQ' || type === 'TRUE_FALSE') {
      // Allow empty/null for partial updates, but validate if provided
      if (value !== undefined && value !== null && value !== '') {
        if (type === 'MCQ') {
          const choices = req.body.choices || [];
          const correctIndex = typeof value === 'number' ? value : parseInt(value);
          if (isNaN(correctIndex) || correctIndex < 0 || (choices.length > 0 && correctIndex >= choices.length)) {
            throw new Error('Correct answer must be a valid choice index');
          }
        } else if (type === 'TRUE_FALSE') {
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            throw new Error('TRUE_FALSE correct answer must be a boolean');
          }
        }
      }
    }
    return true;
  }),
  body('points').optional().isInt({ min: 1 }).withMessage('Points must be a positive integer'),
  body('orderIndex').optional().isInt({ min: 0 }).withMessage('Order index must be a non-negative integer'),
  body('choices').optional().isArray().withMessage('Choices must be an array'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  handleValidationErrors,
], async (req, res) => {
  try {
    const { questionId } = req.params;
    let { type, prompt, choices, correctAnswer, points, tags, orderIndex } = req.body;

    // Trim prompt if provided
    let trimmedPrompt = prompt;
    if (prompt && typeof prompt === 'string') {
      trimmedPrompt = prompt.trim();
      // Validate prompt is not empty after trimming if provided
      if (trimmedPrompt === '') {
        return res.status(400).json({ error: 'Prompt cannot be empty' });
      }
    }

    // Get existing question to preserve values if not provided
    const existing = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const updateData = {};
    if (type !== undefined) updateData.type = type;
    if (trimmedPrompt !== undefined && trimmedPrompt !== '') updateData.prompt = trimmedPrompt;
    if (choices !== undefined) updateData.choices = choices && choices.length > 0 ? choices : null;
    if (points !== undefined) updateData.points = points;
    if (tags !== undefined) updateData.tags = tags;
    if (orderIndex !== undefined) updateData.orderIndex = orderIndex;

    // Handle correctAnswer
    if (correctAnswer !== undefined) {
      const questionType = type || existing.type;
      if (questionType === 'MCQ') {
        const correctIndex = typeof correctAnswer === 'number' ? correctAnswer : parseInt(correctAnswer);
        const choicesToCheck = choices || existing.choices;
        if (!isNaN(correctIndex) && correctIndex >= 0 && choicesToCheck && Array.isArray(choicesToCheck) && correctIndex < choicesToCheck.length) {
          updateData.correctAnswer = correctIndex;
        } else if (correctAnswer === null || correctAnswer === '') {
          // Allow clearing correctAnswer
          updateData.correctAnswer = null;
        } else {
          // Keep existing if invalid
          updateData.correctAnswer = existing.correctAnswer;
        }
      } else if (questionType === 'TRUE_FALSE') {
        if (correctAnswer === null || correctAnswer === '') {
          updateData.correctAnswer = null;
        } else {
          updateData.correctAnswer = correctAnswer === 'true' || correctAnswer === true;
        }
      } else {
        updateData.correctAnswer = correctAnswer;
      }
    }

    const question = await prisma.quizQuestion.update({
      where: { id: questionId },
      data: updateData,
    });

    // Recompute affected attempts if points changed
    const quiz = await prisma.quiz.findUnique({
      where: { id: question.quizId },
      select: { sessionId: true },
    });

    if (quiz) {
      // Trigger recomputation for all students in this session
      await recomputeSessionEvaluations(quiz.sessionId).catch((err) => {
        console.error('Error recomputing evaluations:', err);
      });
    }

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

    const question = await prisma.quizQuestion.findUnique({
      where: { id: questionId },
      select: { quizId: true },
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    await prisma.quizQuestion.delete({
      where: { id: questionId },
    });

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Reorder questions
router.put('/quizzes/:quizId/questions/reorder', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { questionIds } = req.body; // Array of question IDs in new order

    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ error: 'questionIds must be an array' });
    }

    await Promise.all(
      questionIds.map((id, index) =>
        prisma.quizQuestion.update({
          where: { id },
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

// ========== STUDENT ENDPOINTS ==========

// Get available quizzes for student
router.get('/my/quizzes', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { id: studentId } = req.user;

    // Get student's enrolled courses
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: studentId,
        status: 'ACTIVE',
      },
      include: {
        course: {
          include: {
            sessions: {
              include: {
                quizzes: {
                  where: {
                    status: { in: ['PUBLISHED', 'LOCKED'] }, // Include locked quizzes so students can see their results
                  },
                  include: {
                    _count: {
                      select: {
                        attempts: {
                          where: { studentId },
                        },
                      },
                    },
                    attempts: {
                      where: { studentId },
                      orderBy: { submittedAt: 'desc' },
                      take: 1,
                      select: {
                        id: true,
                        status: true,
                        totalScore: true,
                        maxScore: true,
                        percentage: true,
                        submittedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const availableQuizzes = [];
    const now = new Date();

    for (const enrollment of enrollments) {
      for (const session of enrollment.course.sessions) {
        for (const quiz of session.quizzes) {
          // Check attempts allowed
          const attemptCount = quiz._count.attempts;
          const canTake = quiz.status === 'PUBLISHED' && attemptCount < quiz.attemptsAllowed;
          
          // Check availability window only for taking new attempts
          let availableToTake = canTake;
          if (canTake) {
            if (quiz.availableFrom && new Date(quiz.availableFrom) > now) availableToTake = false;
            if (quiz.availableTo && new Date(quiz.availableTo) < now) availableToTake = false;
          }

          // Include quiz if student can take it OR has already attempted it
          const hasAttempts = quiz.attempts && quiz.attempts.length > 0;
          if (availableToTake || hasAttempts) {
            availableQuizzes.push({
              ...quiz,
              course: enrollment.course,
              session,
              canTake: availableToTake,
              lastAttempt: hasAttempts ? quiz.attempts[0] : null,
            });
          }
        }
      }
    }

    res.json({ quizzes: availableQuizzes });
  } catch (error) {
    console.error('Get my quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Start quiz attempt
router.post('/quizzes/:quizId/attempts/start', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { id: studentId } = req.user;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        course: {
          include: {
            enrollments: {
              where: {
                userId: studentId,
                status: 'ACTIVE',
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check enrollment
    if (quiz.course.enrollments.length === 0) {
      return res.status(403).json({ error: 'Not enrolled in this course' });
    }

    // Check status
    if (quiz.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'Quiz not available' });
    }

    // Check availability window
    const now = new Date();
    if (quiz.availableFrom && new Date(quiz.availableFrom) > now) {
      return res.status(403).json({ error: 'Quiz not available yet' });
    }
    if (quiz.availableTo && new Date(quiz.availableTo) < now) {
      return res.status(403).json({ error: 'Quiz expired' });
    }

    // Check attempts allowed
    const existingAttempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        studentId,
      },
    });

    if (existingAttempts.length >= quiz.attemptsAllowed) {
      return res.status(403).json({ error: 'Maximum attempts reached' });
    }

    // Check for in-progress attempt
    const inProgress = existingAttempts.find((a) => a.status === 'IN_PROGRESS');
    if (inProgress) {
      return res.json({ attempt: inProgress });
    }

    // Create new attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        studentId,
        attemptNumber: existingAttempts.length + 1,
        maxScore: await calculateMaxScore(quizId),
      },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                type: true,
                prompt: true,
                choices: true,
                points: true,
                tags: true,
                orderIndex: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({ attempt });
  } catch (error) {
    console.error('Start attempt error:', error);
    res.status(500).json({ error: 'Failed to start quiz attempt' });
  }
});

// Submit answer (autosave)
router.post('/attempts/:attemptId/answer', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { questionId, answer } = req.body;
    const { id: studentId } = req.user;

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
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
      return res.status(403).json({ error: 'Not your attempt' });
    }

    if (attempt.status === 'SUBMITTED') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    const question = attempt.quiz.questions.find((q) => q.id === questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if answer already exists
    const existingAnswer = await prisma.quizAnswer.findUnique({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
    });

    // Evaluate answer
    const { isCorrect, earnedPoints } = evaluateAnswer(question, answer);

    if (existingAnswer) {
      await prisma.quizAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          answer: answer, // Prisma Json accepts JS values directly
          isCorrect,
          earnedPoints,
        },
      });
    } else {
      await prisma.quizAnswer.create({
        data: {
          attemptId,
          questionId,
          answer: answer, // Prisma Json accepts JS values directly
          isCorrect,
          earnedPoints,
        },
      });
    }

    res.json({ message: 'Answer saved' });
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

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: {
        quiz: {
          include: {
            questions: true,
            session: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!attempt) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    if (attempt.studentId !== studentId) {
      return res.status(403).json({ error: 'Not your attempt' });
    }

    if (attempt.status === 'SUBMITTED') {
      return res.status(400).json({ error: 'Attempt already submitted' });
    }

    // Check time limit
    if (attempt.quiz.timeLimitMinutes) {
      const elapsed = (new Date() - attempt.startedAt) / 1000 / 60;
      if (elapsed > attempt.quiz.timeLimitMinutes) {
        return res.status(400).json({ error: 'Time limit exceeded' });
      }
    }

    // Calculate total score
    const answers = await prisma.quizAnswer.findMany({
      where: { attemptId },
      include: { question: true },
    });

    const totalScore = answers.reduce((sum, a) => sum + a.earnedPoints, 0);
    const maxScore = attempt.maxScore || await calculateMaxScore(attempt.quizId);
    const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    // Update attempt
    const updatedAttempt = await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        totalScore,
        maxScore,
        percentage,
      },
      include: {
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    // Compute evaluation
    await computeStudentEvaluation(attempt.quiz.session.id, studentId).catch((err) => {
      console.error('Error computing evaluation:', err);
    });

    res.json({ attempt: updatedAttempt });
  } catch (error) {
    console.error('Submit attempt error:', error);
    res.status(500).json({ error: 'Failed to submit attempt' });
  }
});

// Get student's evaluations
router.get('/my/evaluations', authenticateToken, requireRole('STUDENT'), async (req, res) => {
  try {
    const { id: studentId } = req.user;

    const evaluations = await prisma.studentEvaluation.findMany({
      where: { studentId },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true, date: true },
        },
      },
      orderBy: { computedAt: 'desc' },
    });

    res.json({ evaluations });
  } catch (error) {
    console.error('Get my evaluations error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// ========== ANALYTICS ENDPOINTS ==========

// Get quiz attempts and results for a specific quiz
router.get('/quizzes/:quizId/attempts', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    const { quizId } = req.params;

    // Get quiz info
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        session: {
          select: { id: true, topic: true, date: true },
        },
        course: {
          select: { id: true, title: true },
        },
      },
    });

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get all attempts for this quiz
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        answers: {
          include: {
            question: {
              select: { id: true, prompt: true, points: true },
            },
          },
        },
      },
      orderBy: [
        { student: { name: 'asc' } },
        { submittedAt: 'desc' },
      ],
    });

    res.json({ quiz, attempts });
  } catch (error) {
    console.error('Get quiz attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz attempts' });
  }
});

// Get all students quiz results (admin view)
router.get('/quizzes/results/all', authenticateToken, requireRole('ADMIN', 'INSTRUCTOR'), async (req, res) => {
  try {
    // Get all students
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get all quizzes
    const quizzes = await prisma.quiz.findMany({
      where: { status: { in: ['PUBLISHED', 'LOCKED'] } },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true, date: true },
        },
      },
      orderBy: [
        { session: { date: 'desc' } },
        { createdAt: 'desc' },
      ],
    });

    // Get all attempts for all quizzes
    const allAttempts = await prisma.quizAttempt.findMany({
      where: {
        status: 'SUBMITTED',
        quizId: { in: quizzes.map(q => q.id) },
      },
      include: {
        quiz: {
          select: {
            id: true,
            title: true,
            type: true,
            course: {
              select: { title: true },
            },
            session: {
              select: { topic: true, date: true },
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
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Group attempts by student
    const studentResults = students.map(student => {
      const studentAttempts = allAttempts.filter(a => a.studentId === student.id);
      
      // Group by quiz
      const quizResults = {};
      studentAttempts.forEach(attempt => {
        const quizId = attempt.quizId;
        if (!quizResults[quizId]) {
          quizResults[quizId] = {
            quiz: attempt.quiz,
            attempts: [],
            bestScore: 0,
            bestPercentage: 0,
          };
        }
        quizResults[quizId].attempts.push(attempt);
        if (attempt.percentage > quizResults[quizId].bestPercentage) {
          quizResults[quizId].bestPercentage = attempt.percentage;
          quizResults[quizId].bestScore = attempt.totalScore;
        }
      });

      // Calculate overall stats
      const totalQuizzes = Object.keys(quizResults).length;
      const averagePercentage = totalQuizzes > 0
        ? Object.values(quizResults).reduce((sum, qr) => sum + qr.bestPercentage, 0) / totalQuizzes
        : 0;

      return {
        student,
        quizResults: Object.values(quizResults),
        totalQuizzes,
        averagePercentage,
        totalAttempts: studentAttempts.length,
      };
    });

    res.json({ students: studentResults, quizzes });
  } catch (error) {
    console.error('Get all quiz results error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
});

// Get evaluations for a session
router.get('/sessions/:sessionId/evaluations', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { sessionId } = req.params;

    const evaluations = await prisma.studentEvaluation.findMany({
      where: { sessionId },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    res.json({ evaluations });
  } catch (error) {
    console.error('Get session evaluations error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// Get evaluations for a course
router.get('/courses/:courseId/evaluations', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { courseId } = req.params;

    const evaluations = await prisma.studentEvaluation.findMany({
      where: { courseId },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        session: {
          select: { id: true, topic: true, date: true },
        },
      },
      orderBy: [
        { session: { date: 'desc' } },
        { student: { name: 'asc' } },
      ],
    });

    res.json({ evaluations });
  } catch (error) {
    console.error('Get course evaluations error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// Get evaluations for a student
router.get('/students/:studentId/evaluations', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { studentId } = req.params;

    const evaluations = await prisma.studentEvaluation.findMany({
      where: { studentId },
      include: {
        course: {
          select: { id: true, title: true },
        },
        session: {
          select: { id: true, topic: true, date: true },
        },
      },
      orderBy: { session: { date: 'desc' } },
    });

    res.json({ evaluations });
  } catch (error) {
    console.error('Get student evaluations error:', error);
    res.status(500).json({ error: 'Failed to fetch evaluations' });
  }
});

// Export CSV for session
router.get('/sessions/:sessionId/evaluations/export', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { sessionId } = req.params;

    const evaluations = await prisma.studentEvaluation.findMany({
      where: { sessionId },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        session: {
          select: { id: true, topic: true },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    // Generate CSV
    const headers = ['Student Name', 'Email', 'Pre Score', 'Pre %', 'Post Score', 'Post %', 'Improvement Score', 'Improvement %', 'Strengths', 'Weaknesses'];
    const rows = evaluations.map((e) => [
      e.student.name,
      e.student.email,
      e.preScore.toFixed(2),
      e.prePercent.toFixed(2),
      e.postScore.toFixed(2),
      e.postPercent.toFixed(2),
      e.improvementScore.toFixed(2),
      e.improvementPercent.toFixed(2),
      Array.isArray(e.strengths) ? e.strengths.join(', ') : '',
      Array.isArray(e.weaknesses) ? e.weaknesses.join(', ') : '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="evaluations-${sessionId}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export evaluations error:', error);
    res.status(500).json({ error: 'Failed to export evaluations' });
  }
});

// Export CSV for course
router.get('/courses/:courseId/evaluations/export', authenticateToken, requireRole('ADMIN'), async (req, res) => {
  try {
    const { courseId } = req.params;

    const evaluations = await prisma.studentEvaluation.findMany({
      where: { courseId },
      include: {
        student: {
          select: { id: true, name: true, email: true },
        },
        session: {
          select: { id: true, topic: true, date: true },
        },
      },
      orderBy: [
        { session: { date: 'desc' } },
        { student: { name: 'asc' } },
      ],
    });

    // Generate CSV
    const headers = ['Session Topic', 'Session Date', 'Student Name', 'Email', 'Pre Score', 'Pre %', 'Post Score', 'Post %', 'Improvement Score', 'Improvement %', 'Strengths', 'Weaknesses'];
    const rows = evaluations.map((e) => [
      e.session.topic || 'N/A',
      new Date(e.session.date).toLocaleDateString(),
      e.student.name,
      e.student.email,
      e.preScore.toFixed(2),
      e.prePercent.toFixed(2),
      e.postScore.toFixed(2),
      e.postPercent.toFixed(2),
      e.improvementScore.toFixed(2),
      e.improvementPercent.toFixed(2),
      Array.isArray(e.strengths) ? e.strengths.join(', ') : '',
      Array.isArray(e.weaknesses) ? e.weaknesses.join(', ') : '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="evaluations-course-${courseId}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Export evaluations error:', error);
    res.status(500).json({ error: 'Failed to export evaluations' });
  }
});

// ========== HELPER FUNCTIONS ==========

async function calculateMaxScore(quizId) {
  const questions = await prisma.quizQuestion.findMany({
    where: { quizId },
    select: { points: true },
  });

  return questions.reduce((sum, q) => sum + q.points, 0);
}

function evaluateAnswer(question, studentAnswer) {
  let isCorrect = false;
  let earnedPoints = 0;

  // Prisma Json fields return JS values directly, no parsing needed
  const correctAnswer = question.correctAnswer;

  switch (question.type) {
    case 'TRUE_FALSE':
      // Convert both to boolean for comparison
      const studentBool = studentAnswer === true || studentAnswer === 'true' || studentAnswer === 1;
      const correctBool = correctAnswer === true || correctAnswer === 'true' || correctAnswer === 1;
      isCorrect = studentBool === correctBool;
      break;
    case 'MCQ':
      // For MCQ, correctAnswer is stored as an integer index (0, 1, 2, etc.)
      // Convert both to numbers for accurate comparison
      let studentIndex = typeof studentAnswer === 'number' ? studentAnswer : parseInt(studentAnswer);
      let correctIndex = typeof correctAnswer === 'number' ? correctAnswer : parseInt(correctAnswer);
      
      // Handle array case (for multiple correct answers - future feature)
      if (Array.isArray(correctAnswer)) {
        const studentAnswers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        isCorrect = correctAnswer.every((ans) => studentAnswers.includes(ans)) &&
                    studentAnswers.every((ans) => correctAnswer.includes(ans));
      } else {
        // If student answer is a string (from old data), try to match with choice text
        // Otherwise compare as numbers
        if (isNaN(studentIndex) && typeof studentAnswer === 'string' && Array.isArray(question.choices)) {
          // Student answer is text, find its index
          const choiceIndex = question.choices.findIndex(choice => choice === studentAnswer);
          if (choiceIndex !== -1) {
            studentIndex = choiceIndex;
          }
        }
        
        // Compare as numbers
        isCorrect = !isNaN(studentIndex) && !isNaN(correctIndex) && studentIndex === correctIndex;
      }
      break;
    case 'SHORT_TEXT':
      // Simple string comparison (case-insensitive, trimmed)
      isCorrect = String(studentAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
      break;
  }

  earnedPoints = isCorrect ? question.points : 0;

  return { isCorrect, earnedPoints };
}

export default router;
