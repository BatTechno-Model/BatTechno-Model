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
