import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { ArrowLeft, Calendar, Users, BookOpen, Plus, HelpCircle, Edit2 } from 'lucide-react';

export default function CourseDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const canCreate = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  const { data, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api.getCourse(id),
  });

  const course = data?.course;

  // Fetch quizzes for this course
  const { data: quizzesData } = useQuery({
    queryKey: ['course-quizzes', id],
    queryFn: async () => {
      if (!course?.sessions) return { quizzes: [] };
      const quizzesPromises = course.sessions.map(session => 
        api.getQuizzes(session.id).catch(() => ({ quizzes: [] }))
      );
      const results = await Promise.all(quizzesPromises);
      return { quizzes: results.flatMap(r => r.quizzes || []) };
    },
    enabled: !!course,
  });

  const quizzes = quizzesData?.quizzes || [];

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!course) {
    return <div>{t('error')}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate('/courses')}
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
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
            <p className="text-gray-600 mb-4">{course.description}</p>
            <div className="space-y-2">
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{new Date(course.startDate).toLocaleDateString()}</span>
                <span>-</span>
                <span>{new Date(course.endDate).toLocaleDateString()}</span>
              </div>
              {/* Instructors */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-sm font-medium text-gray-700">{t('instructor')}:</span>
                <span className="text-sm text-gray-600">{course.creator?.name}</span>
                {course.instructors && course.instructors.length > 0 && (
                  <>
                    {course.instructors.map((ci) => (
                      <span key={ci.instructor.id} className="text-sm text-gray-600">
                        , {ci.instructor.name}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
          {canCreate && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/courses/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              <Edit2 size={18} />
              {t('edit')}
            </motion.button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} />
              {t('students')}
            </h2>
            <span className="text-2xl font-bold text-primary-600">
              {course.enrollments?.length || 0}
            </span>
          </div>
          <button
            onClick={() => navigate(`/students?course=${id}`)}
            className="text-primary-600 hover:underline text-sm"
          >
            {t('viewAll')}
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar size={24} />
              {t('sessions')}
            </h2>
            <span className="text-2xl font-bold text-primary-600">
              {course.sessions?.length || 0}
            </span>
          </div>
          <button
            onClick={() => navigate(`/sessions/${id}`)}
            className="text-primary-600 hover:underline text-sm"
          >
            {t('viewAll')}
          </button>
        </motion.div>
      </div>

      {/* Quizzes Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle size={24} className="text-blue-600" />
            {t('quizzes')}
          </h2>
          <div className="flex items-center gap-3">
            {canCreate && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/sessions/${id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} />
                {t('addQuiz') || 'إضافة اختبار'}
              </motion.button>
            )}
            <button
              onClick={() => navigate('/quizzes-exams')}
              className="text-primary-600 hover:underline text-sm"
            >
              {t('viewAll')}
            </button>
          </div>
        </div>

        {quizzes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <HelpCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>{t('noQuizzes')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz, idx) => (
              <motion.div
                key={quiz.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  const sessionId = course.sessions?.find(s => s.id === quiz.sessionId)?.id;
                  if (sessionId) {
                    navigate(`/sessions/${id}?expand=${sessionId}`);
                  }
                }}
              >
                <div className="flex items-center gap-3 flex-1">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{quiz.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded ${
                        quiz.type === 'PRE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {quiz.type === 'PRE' ? t('preQuiz') : t('postQuiz')}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        quiz.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                        quiz.status === 'LOCKED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {quiz.status === 'PUBLISHED' ? t('published') :
                         quiz.status === 'LOCKED' ? t('locked') : t('draft')}
                      </span>
                      {quiz._count?.questions && (
                        <span className="text-xs text-gray-500">
                          {quiz._count.questions} {t('questions')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
