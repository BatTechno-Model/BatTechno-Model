import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { ArrowLeft, Trophy, TrendingUp } from 'lucide-react';

export default function ExamResult() {
  const { t } = useTranslation();
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['examResult', attemptId],
    queryFn: () => api.getExamAttemptResult(attemptId),
  });

  const attempt = data?.attempt;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">{t('examResult')} {t('notFound')}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{t('examResult')}</h1>
        </div>

        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-8 mb-6 text-center"
        >
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-2">{attempt.exam.title}</h2>
          <div className="text-6xl font-bold text-blue-600 mb-2">
            {attempt.finalScore10.toFixed(1)}/10
          </div>
          <p className="text-gray-600">
            {t('percentage')}: {attempt.percentage.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {attempt.rawScore.toFixed(1)} / {attempt.maxRawScore.toFixed(1)} {t('points')}
          </p>
        </motion.div>

        {/* Improvement (if both pre and post exist) */}
        {attempt.exam.type === 'POST' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow-md p-6 mb-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <h3 className="text-lg font-bold">{t('examImprovement')}</h3>
            </div>
            <p className="text-gray-600">
              {t('yourResultsWillBeAvailableSoon')}
            </p>
          </motion.div>
        )}

        {/* Answers Review (if enabled) */}
        {attempt.exam.showSolutionsAfterSubmit && attempt.answers && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <h3 className="text-lg font-bold mb-4">{t('reviewAnswers') || 'Review Answers'}</h3>
            <div className="space-y-4">
              {attempt.answers.map((answer, idx) => {
                const question = attempt.exam.questions.find(q => q.id === answer.questionId);
                if (!question) return null;

                return (
                  <div key={answer.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold">{idx + 1}. {question.prompt}</span>
                      {answer.isCorrect ? (
                        <span className="text-green-600 font-bold">✓</span>
                      ) : (
                        <span className="text-red-600 font-bold">✗</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {t('yourAnswer')}: {typeof answer.answer === 'boolean' 
                        ? (answer.answer ? 'True' : 'False')
                        : question.choices?.[answer.answer] || answer.answer}
                    </p>
                    {!answer.isCorrect && (
                      <p className="text-sm text-green-600 mt-1">
                        {t('correctAnswer')}: {
                          question.questionType === 'MCQ'
                            ? question.choices?.[question.correctAnswer]
                            : (question.correctAnswer ? 'True' : 'False')
                        }
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {t('points')}: {answer.earnedPoints} / {question.points}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Back Button */}
        <div className="mt-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {t('backToHome') || 'Back to Home'}
          </button>
        </div>
      </div>
    </div>
  );
}
