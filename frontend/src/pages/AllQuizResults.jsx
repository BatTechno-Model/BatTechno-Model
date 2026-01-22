import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { ArrowLeft, User, TrendingUp, Award, BarChart3, CheckCircle } from 'lucide-react';

export default function AllQuizResults() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['all-quiz-results'],
    queryFn: () => api.getAllQuizResults(),
  });

  const students = data?.students || [];
  const quizzes = data?.quizzes || [];

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-48" count={5} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-20">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 mb-4 text-sm"
      >
        <ArrowLeft size={16} />
        {t('back')}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 shadow-sm border border-blue-100 mb-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">{t('allQuizResults') || 'نتائج جميع الاختبارات'}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-full">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-gray-700 font-medium">{students.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-full">
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-gray-700 font-medium">{quizzes.length}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/70 px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-gray-700 font-medium">{students.reduce((sum, s) => sum + s.totalAttempts, 0)}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {students.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-lg p-8 text-center border border-gray-200"
        >
          <User className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600">{t('noStudents') || 'لا يوجد طلاب'}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {students.map((studentData, index) => {
            const { student, quizResults, totalQuizzes, averagePercentage, totalAttempts } = studentData;

            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-primary-300 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-sm">
                      <User size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-tight">{student.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{student.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${
                      averagePercentage >= 70 ? 'text-green-600' :
                      averagePercentage >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {averagePercentage.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t('average') || 'المتوسط'}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {totalQuizzes} {t('quizzes')} • {totalAttempts} {t('attempts')}
                    </div>
                  </div>
                </div>

                {quizResults.length === 0 ? (
                  <div className="text-center py-3 text-gray-500 text-sm">
                    {t('noQuizAttempts') || 'لم يقم بأي اختبارات بعد'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {quizResults.map((qr, qrIdx) => {
                      const quiz = qr.quiz;
                      const percentage = qr.bestPercentage;

                      return (
                        <div
                          key={quiz.id}
                          className={`p-3 rounded-lg border transition-all hover:shadow-sm ${
                            percentage >= 70 ? 'bg-green-50/50 border-green-200' :
                            percentage >= 50 ? 'bg-yellow-50/50 border-yellow-200' :
                            'bg-red-50/50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 pr-2">
                              <h4 className="font-semibold text-gray-900 text-xs truncate mb-1 leading-tight">
                                {quiz.title}
                              </h4>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  quiz.type === 'PRE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {quiz.type === 'PRE' ? t('preQuiz') : t('postQuiz')}
                                </span>
                                {quiz.course && (
                                  <span className="text-[10px] text-gray-500 truncate">
                                    {quiz.course.title}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className={`text-base font-bold ${
                                percentage >= 70 ? 'text-green-700' :
                                percentage >= 50 ? 'text-yellow-700' :
                                'text-red-700'
                              }`}>
                                {percentage.toFixed(0)}%
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-white/60 rounded-full h-1.5 overflow-hidden mb-2">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, delay: qrIdx * 0.05 }}
                              className={`h-full rounded-full ${
                                percentage >= 70 ? 'bg-green-500' :
                                percentage >= 50 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-gray-600">
                            <span className="font-medium">
                              {qr.bestScore || 0}/{qr.attempts[0]?.maxScore || 0}
                            </span>
                            <span>
                              {qr.attempts.length} {qr.attempts.length === 1 ? t('attempt') : t('attempts')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
