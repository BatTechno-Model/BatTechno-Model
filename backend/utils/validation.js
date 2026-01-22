import { body, validationResult } from 'express-validator';
import { z } from 'zod';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({ 
      error: errors.array()[0]?.msg || 'Validation failed',
      errors: errors.array() 
    });
  }
  next();
};

// Auth validation
export const validateRegister = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['ADMIN', 'INSTRUCTOR', 'STUDENT']).withMessage('Invalid role'),
  handleValidationErrors,
];

export const validateLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

// Course validation
export const validateCourse = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
  handleValidationErrors,
];

// Session validation
export const validateSession = [
  body('courseId').notEmpty().withMessage('Course ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('startTime').trim().notEmpty().withMessage('Start time is required'),
  body('endTime').trim().notEmpty().withMessage('End time is required'),
  handleValidationErrors,
];

// Assignment validation
export const validateAssignment = [
  body('courseId').notEmpty().withMessage('Course ID is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('maxScore').optional().isInt({ min: 0 }).withMessage('Max score must be a positive integer'),
  handleValidationErrors,
];

// Zod schemas for complex validation
export const attendanceBulkSchema = z.object({
  sessionId: z.string(),
  attendances: z.array(
    z.object({
      studentId: z.string(),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      note: z.string().optional(),
    })
  ),
});

export const submissionSchema = z.object({
  assignmentId: z.string(),
  note: z.string().optional(),
  assets: z.array(
    z.object({
      type: z.enum(['FILE', 'LINK']),
      url: z.string(),
      name: z.string(),
    })
  ).optional(),
});

export const reviewSchema = z.object({
  score: z.number().int().min(0).max(100).optional(),
  rubricResult: z.record(z.any()).optional(),
  feedback: z.string().optional(),
});

// Quiz validation
export const validateQuiz = [
  body('courseId').notEmpty().withMessage('Course ID is required'),
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('type').isIn(['PRE', 'POST']).withMessage('Type must be PRE or POST'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('timeLimitMinutes').optional().isInt({ min: 1 }).withMessage('Time limit must be a positive integer'),
  body('attemptsAllowed').optional().isInt({ min: 1 }).withMessage('Attempts allowed must be a positive integer'),
  body('availableFrom').optional().isISO8601().withMessage('Valid available from date is required'),
  body('availableTo').optional().isISO8601().withMessage('Valid available to date is required'),
  handleValidationErrors,
];

export const validateQuestion = [
  body('type').isIn(['MCQ', 'TRUE_FALSE', 'SHORT_TEXT']).withMessage('Type must be MCQ, TRUE_FALSE, or SHORT_TEXT'),
  body('prompt').optional({ checkFalsy: true }).isString().withMessage('Prompt must be a string').custom((value) => {
    // Allow empty string for initial question creation (will be filled by user)
    if (value === undefined || value === null || value === '') {
      return true; // Allow empty for initial creation
    }
    // If provided, it must be non-empty after trimming
    if (typeof value === 'string' && value.trim() === '') {
      throw new Error('Prompt cannot be empty');
    }
    return true;
  }),
  body('correctAnswer').optional().custom((value, { req }) => {
    // For MCQ and TRUE_FALSE, correctAnswer should be provided but allow empty for initial creation
    const type = req.body.type;
    if (type === 'MCQ' || type === 'TRUE_FALSE') {
      // Allow empty/null for initial question creation (will be set when user selects answer)
      // But if provided, it must be valid
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
];

export const quizSchema = z.object({
  courseId: z.string(),
  sessionId: z.string(),
  type: z.enum(['PRE', 'POST']),
  title: z.string().min(1),
  description: z.string().optional(),
  timeLimitMinutes: z.number().int().positive().optional(),
  attemptsAllowed: z.number().int().positive().default(1),
  availableFrom: z.string().datetime().optional(),
  availableTo: z.string().datetime().optional(),
});

export const questionSchema = z.object({
  type: z.enum(['MCQ', 'TRUE_FALSE', 'SHORT_TEXT']),
  prompt: z.string().min(1),
  choices: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.array(z.string())]),
  points: z.number().int().positive().default(1),
  tags: z.array(z.string()).default([]),
  orderIndex: z.number().int().nonnegative().default(0),
});

export const answerSchema = z.object({
  questionId: z.string(),
  answer: z.union([z.string(), z.array(z.string())]),
});
