import prisma from '../config/database.js';

/**
 * Compute or update student evaluation for a session
 * Picks latest SUBMITTED pre and post attempts
 */
export async function computeStudentEvaluation(sessionId, studentId) {
  try {
    // Get session to get courseId
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { courseId: true },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    // Get latest SUBMITTED pre attempt
    const preQuiz = await prisma.quiz.findFirst({
      where: {
        sessionId,
        type: 'PRE',
        status: 'PUBLISHED',
      },
    });

    const postQuiz = await prisma.quiz.findFirst({
      where: {
        sessionId,
        type: 'POST',
        status: 'PUBLISHED',
      },
    });

    let preAttempt = null;
    let postAttempt = null;

    if (preQuiz) {
      preAttempt = await prisma.quizAttempt.findFirst({
        where: {
          quizId: preQuiz.id,
          studentId,
          status: 'SUBMITTED',
        },
        include: {
          answers: {
            include: {
              question: true,
            },
          },
        },
        orderBy: [
          { submittedAt: 'desc' },
          { attemptNumber: 'desc' },
        ],
      });
    }

    if (postQuiz) {
      postAttempt = await prisma.quizAttempt.findFirst({
        where: {
          quizId: postQuiz.id,
          studentId,
          status: 'SUBMITTED',
        },
        include: {
          answers: {
            include: {
              question: true,
            },
          },
        },
        orderBy: [
          { submittedAt: 'desc' },
          { attemptNumber: 'desc' },
        ],
      });
    }

    // Calculate scores
    const preScore = preAttempt?.totalScore || 0;
    const preMaxScore = preAttempt?.maxScore || 0;
    const prePercent = preMaxScore > 0 ? (preScore / preMaxScore) * 100 : 0;

    const postScore = postAttempt?.totalScore || 0;
    const postMaxScore = postAttempt?.maxScore || 0;
    const postPercent = postMaxScore > 0 ? (postScore / postMaxScore) * 100 : 0;

    const improvementScore = postScore - preScore;
    const improvementPercent = postPercent - prePercent;

    // Compute tag analytics from both attempts
    const tagPerformance = {};

    // Process pre attempt answers
    if (preAttempt?.answers) {
      for (const answer of preAttempt.answers) {
        const tags = answer.question.tags || [];
        const points = answer.earnedPoints;
        const maxPoints = answer.question.points;

        for (const tag of tags) {
          if (!tagPerformance[tag]) {
            tagPerformance[tag] = { earned: 0, max: 0, count: 0 };
          }
          tagPerformance[tag].earned += points;
          tagPerformance[tag].max += maxPoints;
          tagPerformance[tag].count += 1;
        }
      }
    }

    // Process post attempt answers
    if (postAttempt?.answers) {
      for (const answer of postAttempt.answers) {
        const tags = answer.question.tags || [];
        const points = answer.earnedPoints;
        const maxPoints = answer.question.points;

        for (const tag of tags) {
          if (!tagPerformance[tag]) {
            tagPerformance[tag] = { earned: 0, max: 0, count: 0 };
          }
          tagPerformance[tag].earned += points;
          tagPerformance[tag].max += maxPoints;
          tagPerformance[tag].count += 1;
        }
      }
    }

    // Calculate percentages and sort
    const tagPercentages = Object.entries(tagPerformance).map(([tag, data]) => ({
      tag,
      percent: data.max > 0 ? (data.earned / data.max) * 100 : 0,
      earned: data.earned,
      max: data.max,
    }));

    // Sort by percentage
    tagPercentages.sort((a, b) => b.percent - a.percent);

    // Top 3 strengths, bottom 3 weaknesses
    const strengths = tagPercentages.slice(0, 3).map((t) => t.tag);
    const weaknesses = tagPercentages.slice(-3).reverse().map((t) => t.tag);

    // Upsert evaluation
    const evaluation = await prisma.studentEvaluation.upsert({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId,
        },
      },
      update: {
        preAttemptId: preAttempt?.id || null,
        postAttemptId: postAttempt?.id || null,
        preScore,
        postScore,
        prePercent,
        postPercent,
        improvementScore,
        improvementPercent,
        strengths,
        weaknesses,
        computedAt: new Date(),
      },
      create: {
        courseId: session.courseId,
        sessionId,
        studentId,
        preAttemptId: preAttempt?.id || null,
        postAttemptId: postAttempt?.id || null,
        preScore,
        postScore,
        prePercent,
        postPercent,
        improvementScore,
        improvementPercent,
        strengths,
        weaknesses,
      },
    });

    return evaluation;
  } catch (error) {
    console.error('Error computing evaluation:', error);
    throw error;
  }
}

/**
 * Recompute evaluations for all students in a session
 */
export async function recomputeSessionEvaluations(sessionId) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        course: {
          include: {
            enrollments: {
              where: { status: 'ACTIVE' },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new Error('Session not found');
    }

    const studentIds = session.course.enrollments.map((e) => e.userId);

    const evaluations = await Promise.all(
      studentIds.map((studentId) => computeStudentEvaluation(sessionId, studentId))
    );

    return evaluations;
  } catch (error) {
    console.error('Error recomputing session evaluations:', error);
    throw error;
  }
}
