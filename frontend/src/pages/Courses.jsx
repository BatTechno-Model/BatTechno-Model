import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { Plus, BookOpen, Users, Calendar, FileText, Clock } from 'lucide-react';

export default function Courses() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['courses', user?.id],
    queryFn: () => api.getCourses(),
  });

  const courses = data?.courses || [];
  const canCreate = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';
  const isStudent = user?.role === 'STUDENT';
  
  // Debug logging for students
  if (isStudent && !isLoading) {
    console.log('Student courses:', {
      coursesCount: courses.length,
      courses: courses.map((c) => ({ id: c.id, title: c.title })),
      userId: user?.id,
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold text-gray-900"
        >
          {t('courses')}
        </motion.h1>
        {canCreate && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/courses/new')}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            <Plus size={20} />
            {t('createCourse')}
          </motion.button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" count={6} />
        </div>
      ) : courses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 bg-white rounded-xl border border-gray-200"
        >
          <BookOpen className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-600 text-lg mb-2">{t('noCourses')}</p>
          {isStudent ? (
            <p className="text-gray-500 text-sm">{t('notEnrolledInAnyCourse')}</p>
          ) : canCreate ? (
            <button
              onClick={() => navigate('/courses/new')}
              className="text-primary-600 font-semibold hover:underline"
            >
              {t('createCourse')}
            </button>
          ) : null}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/courses/${course.id}`)}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-primary-500 hover:shadow-md transition cursor-pointer"
            >
              <div className="mb-2">
                <h3 className="text-xl font-bold text-gray-900 mb-1">{course.title}</h3>
                {course.creator && (
                  <p className="text-xs text-gray-500">{t('instructor')}: {course.creator.name}</p>
                )}
              </div>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description || t('noDescription')}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                <div className="flex items-center gap-1">
                  <Users size={16} />
                  <span>{course._count?.enrollments || 0} {t('students')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <span>{course._count?.sessions || 0} {t('sessions')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText size={16} />
                  <span>{course._count?.assignments || 0} {t('assignments')}</span>
                </div>
              </div>
              {course.startDate && course.endDate && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                  <Clock size={12} />
                  <span>
                    {new Date(course.startDate).toLocaleDateString()} - {new Date(course.endDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
