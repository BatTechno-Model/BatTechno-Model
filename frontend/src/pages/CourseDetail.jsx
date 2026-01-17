import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { ArrowLeft, Calendar, Users, BookOpen, Plus } from 'lucide-react';

export default function CourseDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api.getCourse(id),
  });

  const course = data?.course;

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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
        <p className="text-gray-600 mb-4">{course.description}</p>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>{new Date(course.startDate).toLocaleDateString()}</span>
          <span>-</span>
          <span>{new Date(course.endDate).toLocaleDateString()}</span>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    </div>
  );
}
