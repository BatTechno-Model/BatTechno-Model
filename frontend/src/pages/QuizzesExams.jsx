import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { HelpCircle, FileText, Calendar, Clock, TrendingUp, Eye, BarChart3, Users } from 'lucide-react';

export default function QuizzesExams() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  // Fetch courses for admin/instructor
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.getCourses(),
    enabled: isAdmin,
  });

  const courses = coursesData?.courses || [];

  // Fetch available quizzes for students
  const { data: quizzesData, isLoading: quizzesLoading } = useQuery({
    queryKey: ['my-quizzes'],
    queryFn: () => api.getMyQuizzes(),
    enabled: !isAdmin,
  });

  const availableQuizzes = quizzesData?.quizzes || [];

  // Fetch available exams for students
  const { data: examsData, isLoading: examsLoading } = useQuery({
    queryKey: ['my-exams'],
    queryFn: () => api.getMyExams(),
    enabled: !isAdmin,
  });

  const availableExams = examsData?.exams || [];

  if (isAdmin) {
    // Admin view: Show courses with quizzes/exams
    if (coursesLoading) {
      return (
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Skeleton />
        </div>
      );
    }

    return (
      <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-bold text-gray-900"
            >
              {t('quizzes')} & {t('exams')}
            </motion.h1>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/quiz-results/all')}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Users size={20} />
              {t('viewAllResults') || 'عرض النتائج'}
            </motion.button>
          </div>
          {/* Help Guide */}
          <p className="text-gray-500 text-[10px] leading-relaxed">
            {t('helpGuide.quizzes')}
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">{t('noCourses') || 'No courses available'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course, idx) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/courses/${course.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">{course.title}</h2>
                    <p className="text-gray-600 text-sm mb-4">{course.description || t('noDescription')}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {course._count?.sessions || 0} {t('sessions')}
                      </span>
                    </div>
                  </div>
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="ml-4"
                  >
                    <Eye className="w-5 h-5 text-gray-400" />
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Student view: Show available quizzes and exams
  if (quizzesLoading || examsLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Skeleton />
      </div>
    );
  }

  const allItems = [
    ...availableQuizzes.map(q => ({ ...q, itemType: 'quiz' })),
    ...availableExams.map(e => ({ ...e, itemType: 'exam' })),
  ].sort((a, b) => {
    const dateA = new Date(a.session?.date || 0);
    const dateB = new Date(b.session?.date || 0);
    return dateA - dateB;
  });

  // Filter submitted quizzes/exams for performance chart
  const submittedItems = allItems.filter(item => 
    item.lastAttempt && item.lastAttempt.status === 'SUBMITTED'
  ).sort((a, b) => {
    // Sort by date (most recent first)
    const dateA = new Date(a.lastAttempt.submittedAt || 0);
    const dateB = new Date(b.lastAttempt.submittedAt || 0);
    return dateB - dateA;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold text-gray-900 mb-6"
      >
        {t('quizzes')} & {t('exams')}
      </motion.h1>

      {/* Performance Chart */}
      {submittedItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">{t('performanceChart') || 'رسم بياني للأداء'}</h2>
          </div>
          <div className="space-y-3">
            {submittedItems.map((item, idx) => {
              const attempt = item.lastAttempt;
              const percentage = attempt.percentage || 0;
              const isQuiz = item.itemType === 'quiz';
              
              return (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </span>
                      <span className="text-sm font-bold text-gray-700 ml-2 whitespace-nowrap">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={`h-full rounded-full ${
                          percentage >= 70 ? 'bg-green-500' :
                          percentage >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                      <span>
                        {attempt.totalScore || 0} / {attempt.maxScore || 0} {t('points')}
                      </span>
                      <span>
                        {new Date(attempt.submittedAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {allItems.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">{t('noQuizzes')} & {t('noExams')}</p>
          <p className="text-gray-500 text-sm mt-2">{t('checkBackLater') || 'Check back later for new quizzes and exams'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allItems.map((item, idx) => {
            const isQuiz = item.itemType === 'quiz';
            const Icon = isQuiz ? HelpCircle : FileText;
            const typeLabel = isQuiz 
              ? (item.type === 'PRE' ? t('preQuiz') : t('postQuiz'))
              : (item.type === 'PRE' ? t('preExam') : t('postExam'));
            const bgColor = isQuiz ? 'from-blue-50 to-blue-100' : 'from-purple-50 to-purple-100';
            const borderColor = isQuiz ? 'border-blue-200' : 'border-purple-200';
            const textColor = isQuiz ? 'text-blue-700' : 'text-purple-700';
            const buttonColor = isQuiz ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700';

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-gradient-to-r ${bgColor} rounded-lg border-2 ${borderColor} p-4`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-5 h-5 ${textColor}`} />
                      <h3 className="font-bold text-gray-900">{item.title}</h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${textColor} bg-white/50`}>
                        {isQuiz ? (item.type === 'PRE' ? t('preQuiz') : t('postQuiz')) : (item.type === 'PRE' ? t('preExam') : t('postExam'))}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        item.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                        item.status === 'LOCKED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.status === 'PUBLISHED' ? t('published') :
                         item.status === 'LOCKED' ? t('locked') : t('draft')}
                      </span>
                    </div>
                    {item.session && (
                      <p className="text-sm text-gray-600 mb-2">
                        {item.session.topic || t('session')} - {new Date(item.session.date).toLocaleDateString()}
                      </p>
                    )}
                    {item.description && (
                      <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                    )}
                    {item.timeLimitMinutes && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{item.timeLimitMinutes} {t('minutes')}</span>
                      </div>
                    )}
                    {item.lastAttempt && item.lastAttempt.status === 'SUBMITTED' && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className={`text-sm font-semibold ${
                          (item.lastAttempt.percentage || 0) >= 70 ? 'text-green-600' :
                          (item.lastAttempt.percentage || 0) >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {t('yourScore') || 'درجتك'}: {(item.lastAttempt.percentage || 0).toFixed(1)}%
                        </div>
                        <span className="text-xs text-gray-500">
                          ({item.lastAttempt.totalScore || 0} / {item.lastAttempt.maxScore || 0})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex flex-col gap-2">
                    {item.status === 'PUBLISHED' && item.canTake && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(isQuiz ? `/quiz/${item.id}` : `/exam/${item.id}`)}
                        className={`px-4 py-2 ${buttonColor} text-white rounded-lg text-sm font-medium whitespace-nowrap`}
                      >
                        {isQuiz ? t('takeQuiz') : t('takeExam')}
                      </motion.button>
                    )}
                    {item.lastAttempt && item.lastAttempt.status === 'SUBMITTED' && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(isQuiz ? `/quiz-result/${item.lastAttempt.id}` : `/exam-result/${item.lastAttempt.id}`)}
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium whitespace-nowrap hover:bg-gray-700"
                      >
                        {t('viewResult') || 'عرض النتيجة'}
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
