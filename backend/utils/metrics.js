import prisma from '../config/database.js';

/**
 * Compute student course metrics: attendance, assignments, exams, overall score, alerts, recommendations
 */
export async function computeStudentCourseMetrics(studentId, courseId) {
  // Get all enrollments for this student-course pair
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: {
        userId: studentId,
        courseId,
      },
    },
  });

  if (!enrollment) {
    throw new Error('Student not enrolled in this course');
  }

  // 1. ATTENDANCE METRICS
  const sessions = await prisma.session.findMany({
    where: { courseId },
    include: {
      attendances: {
        where: { studentId },
      },
    },
  });

  let totalPoints = 0;
  let presentPoints = 0;

  sessions.forEach((session) => {
    const attendance = session.attendances[0];
    if (attendance) {
      totalPoints += 1;
      switch (attendance.status) {
        case 'PRESENT':
          presentPoints += 1;
          break;
        case 'LATE':
          presentPoints += 0.75;
          break;
        case 'EXCUSED':
          presentPoints += 0.6;
          break;
        case 'ABSENT':
          presentPoints += 0;
          break;
      }
    } else {
      totalPoints += 1; // Absent by default
    }
  });

  const attendanceRate = totalPoints > 0 ? presentPoints / totalPoints : 0;

  // 2. ASSIGNMENT METRICS
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

  const totalAssignments = assignments.length;
  const submittedAssignments = assignments.filter((a) => a.submissions.length > 0).length;
  const assignmentCompletionRate = totalAssignments > 0 ? submittedAssignments / totalAssignments : 0;
  
  // Track if there are actually missing assignments
  const hasMissingAssignments = totalAssignments > 0 && submittedAssignments < totalAssignments;

  // Calculate average assignment score
  let totalScore = 0;
  let scoredCount = 0;
  assignments.forEach((assignment) => {
    const submission = assignment.submissions[0];
    if (submission) {
      const review = submission.reviews[0];
      if (review && review.score !== null) {
        const scorePercent = assignment.maxScore > 0 ? review.score / assignment.maxScore : 0;
        totalScore += scorePercent;
        scoredCount += 1;
      }
    }
  });

  const assignmentQuality = scoredCount > 0 ? totalScore / scoredCount : assignmentCompletionRate;

  // 3. EXAMS/QUIZZES METRICS
  // Get quiz attempts
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

  // Get exam attempts
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

  // Calculate average exam score (normalized to 0..1, where 1 = 10/10)
  let totalExamScore = 0;
  let examCount = 0;

  quizAttempts.forEach((attempt) => {
    if (attempt.maxScore > 0) {
      // Quiz percentage is already 0..1
      totalExamScore += attempt.percentage;
      examCount += 1;
    }
  });

  examAttempts.forEach((attempt) => {
    // Exam finalScore10 is out of 10, normalize to 0..1
    totalExamScore += attempt.finalScore10 / 10;
    examCount += 1;
  });

  const examsAvg = examCount > 0 ? totalExamScore / examCount : 0;

  // 4. OVERALL SCORE CALCULATION
  // Default weights
  let wAttendance = 0.3;
  let wAssignments = 0.4;
  let wExams = 0.3;

  // Re-normalize if some modules are missing
  const hasAttendance = totalPoints > 0;
  const hasAssignments = totalAssignments > 0;
  const hasExams = examCount > 0;

  if (!hasAttendance && !hasAssignments && !hasExams) {
    // No data at all
    wAttendance = 0;
    wAssignments = 0;
    wExams = 0;
  } else {
    // Re-normalize weights
    let totalWeight = 0;
    if (hasAttendance) totalWeight += 0.3;
    if (hasAssignments) totalWeight += 0.4;
    if (hasExams) totalWeight += 0.3;

    if (totalWeight > 0) {
      wAttendance = hasAttendance ? (0.3 / totalWeight) : 0;
      wAssignments = hasAssignments ? (0.4 / totalWeight) : 0;
      wExams = hasExams ? (0.3 / totalWeight) : 0;
    }
  }

  const overallScore = 100 * (
    wAttendance * attendanceRate +
    wAssignments * (0.5 * assignmentCompletionRate + 0.5 * assignmentQuality) +
    wExams * examsAvg
  );

  // 5. ALERTS
  const alerts = [];

  if (attendanceRate < 0.75) {
    alerts.push('HIGH_ABSENCE');
  }

  // Only show MISSING_ASSIGNMENTS alert if:
  // 1. There are assignments (totalAssignments > 0)
  // 2. Not all assignments are submitted (hasMissingAssignments)
  // 3. Completion rate is below 70%
  if (hasMissingAssignments && assignmentCompletionRate < 0.7) {
    alerts.push('MISSING_ASSIGNMENTS');
  }

  if (examsAvg < 0.6) {
    alerts.push('LOW_EXAMS');
  }

  // Check for no activity in last 14 days
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const recentAttendance = await prisma.attendance.findFirst({
    where: {
      studentId,
      session: { courseId },
      createdAt: { gte: fourteenDaysAgo },
    },
  });

  const recentSubmission = await prisma.submission.findFirst({
    where: {
      studentId,
      assignment: { courseId },
      submittedAt: { gte: fourteenDaysAgo },
    },
  });

  const recentQuizAttempt = await prisma.quizAttempt.findFirst({
    where: {
      studentId,
      quiz: { courseId },
      createdAt: { gte: fourteenDaysAgo },
    },
  });

  const recentExamAttempt = await prisma.examAttempt.findFirst({
    where: {
      studentId,
      exam: { courseId },
      createdAt: { gte: fourteenDaysAgo },
    },
  });

  if (!recentAttendance && !recentSubmission && !recentQuizAttempt && !recentExamAttempt) {
    alerts.push('NO_ACTIVITY_14_DAYS');
  }

  // 6. RECOMMENDATIONS
  const recommendations = [];

  if (alerts.includes('HIGH_ABSENCE')) {
    recommendations.push('Schedule reminder and attend next sessions');
  }

  if (alerts.includes('MISSING_ASSIGNMENTS')) {
    recommendations.push('Focus on next assignment and create a checklist');
  }

  if (alerts.includes('LOW_EXAMS')) {
    // Try to get weakest quiz tags
    const weakQuizAnswers = await prisma.quizAnswer.findMany({
      where: {
        attempt: {
          studentId,
          quiz: { courseId },
          status: 'SUBMITTED',
        },
        isCorrect: false,
      },
      include: {
        question: {
          include: {
            quiz: true,
          },
        },
      },
    });

    const weakTags = new Set();
    weakQuizAnswers.forEach((answer) => {
      const tags = answer.question.tags;
      if (Array.isArray(tags)) {
        tags.forEach((tag) => weakTags.add(tag));
      }
    });

    if (weakTags.size > 0) {
      recommendations.push(`Review topics: ${Array.from(weakTags).slice(0, 3).join(', ')}`);
    } else {
      recommendations.push('Create a review plan for exam topics');
    }
  }

  // Check assignment tags for Frontend/Backend struggles
  const failedAssignments = assignments.filter((a) => {
    const submission = a.submissions[0];
    if (!submission) return false;
    const review = submission.reviews[0];
    if (!review || review.score === null) return false;
    const scorePercent = a.maxScore > 0 ? review.score / a.maxScore : 0;
    return scorePercent < 0.6;
  });

  const frontendTags = ['Frontend', 'React', 'Vue', 'Angular', 'UI', 'CSS'];
  const backendTags = ['Backend', 'API', 'Database', 'Server', 'Node', 'Express'];

  const hasFrontendStruggles = failedAssignments.some((a) => {
    const titleLower = a.title.toLowerCase();
    return frontendTags.some((tag) => titleLower.includes(tag.toLowerCase()));
  });

  const hasBackendStruggles = failedAssignments.some((a) => {
    const titleLower = a.title.toLowerCase();
    return backendTags.some((tag) => titleLower.includes(tag.toLowerCase()));
  });

  if (hasFrontendStruggles) {
    recommendations.push('Practice React fundamentals and hooks');
  }

  if (hasBackendStruggles) {
    recommendations.push('Practice API development and database queries');
  }

  // Limit to 6 recommendations
  const finalRecommendations = recommendations.slice(0, 6);

  // 7. SAVE METRICS
  const metrics = await prisma.studentCourseMetrics.upsert({
    where: {
      studentId_courseId: {
        studentId,
        courseId,
      },
    },
    update: {
      attendanceRate,
      assignmentCompletionRate,
      assignmentQuality,
      examsAvg,
      overallScore,
      alerts: JSON.stringify(alerts),
      recommendations: JSON.stringify(finalRecommendations),
      computedAt: new Date(),
    },
    create: {
      studentId,
      courseId,
      attendanceRate,
      assignmentCompletionRate,
      assignmentQuality,
      examsAvg,
      overallScore,
      alerts: JSON.stringify(alerts),
      recommendations: JSON.stringify(finalRecommendations),
      computedAt: new Date(),
    },
  });

  return {
    attendanceRate,
    assignmentCompletionRate,
    assignmentQuality,
    examsAvg,
    overallScore,
    alerts,
    recommendations: finalRecommendations,
    metrics,
  };
}
