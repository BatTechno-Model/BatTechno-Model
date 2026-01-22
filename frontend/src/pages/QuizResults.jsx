import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { ArrowLeft, User, CheckCircle, XCircle, Clock, Award } from 'lucide-react';

export default function QuizResults() {
  const { t } = useTranslation();
  const { quizId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['quiz-attempts', quizId],
    queryFn: () => api.getQuizAttempts(quizId),
  });

  const quiz = data?.quiz;
  const attempts = data?.attempts || [];

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-48" count={3} />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <p className="text-red-600">{t('error')}</p>
      </div>
    );
  }

  // Group attempts by student
  const attemptsByStudent = attempts.reduce((acc, attempt) => {
    const studentId = attempt.studentId;
    if (!acc[studentId]) {
      acc[studentId] = {
        student: attempt.student,
        attempts: [],
      };
    }
    acc[studentId].attempts.push(attempt);
    return acc;
  }, {});

  const students = Object.values(attemptsByStudent);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        {t('back')}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{quiz.title}</h1>
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
          <span>{quiz.course?.title}</span>
          <span>•</span>
          <span>{quiz.session?.topic}</span>
          <span>•</span>
          <span className={`px-2 py-1 rounded ${
            quiz.type === 'PRE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
          }`}>
            {quiz.type === 'PRE' ? t('preQuiz') : t('postQuiz')}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-gray-500" />
            <span className="text-gray-600">{attempts.length} {t('attempts') || 'محاولة'}</span>
          </div>
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-500" />
            <span className="text-gray-600">{students.length} {t('students') || 'طالب'}</span>
          </div>
        </div>
      </motion.div>

      {students.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-xl p-12 text-center border border-gray-200"
        >
          <User className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-600 text-lg">{t('noAttempts') || 'لا توجد محاولات بعد'}</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {students.map((studentData, index) => {
            const { student, attempts: studentAttempts } = studentData;
            const latestAttempt = studentAttempts[0]; // Most recent attempt
            const bestAttempt = studentAttempts.reduce((best, current) => {
              return (current.percentage || 0) > (best.percentage || 0) ? current : best;
            }, studentAttempts[0]);

            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{student.name}</h3>
                      <p className="text-sm text-gray-500">{student.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {bestAttempt.percentage?.toFixed(1) || 0}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {studentAttempts.length} {t('attempts') || 'محاولة'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {studentAttempts.map((attempt, attemptIndex) => (
                    <div
                      key={attempt.id}
                      className={`p-4 rounded-lg border ${
                        attempt.status === 'SUBMITTED'
                          ? attempt.percentage >= 70
                            ? 'bg-green-50 border-green-200'
                            : attempt.percentage >= 50
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-red-50 border-red-200'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">
                          {t('attempt')} {attempt.attemptNumber}
                        </span>
                        {attempt.status === 'SUBMITTED' ? (
                          <CheckCircle size={16} className="text-green-600" />
                        ) : (
                          <Clock size={16} className="text-gray-400" />
                        )}
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {attempt.percentage?.toFixed(1) || 0}%
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {attempt.totalScore || 0} / {attempt.maxScore || 0} {t('points')}
                      </div>
                      {attempt.submittedAt && (
                        <div className="text-xs text-gray-400 mt-2">
                          {new Date(attempt.submittedAt).toLocaleString('ar-SA')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
