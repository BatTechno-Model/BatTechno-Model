import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import { Search, UserPlus, Users, Edit, Trash2, CheckCircle, UserCheck } from 'lucide-react';

export default function Students() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('course');
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  
  const canManage = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  const { data, isLoading } = useQuery({
    queryKey: ['users', { role: 'STUDENT', search }],
    queryFn: () => api.getUsers({ role: 'STUDENT', search }),
  });

  const students = data?.users || [];

  // Get enrolled students for this course
  const { data: enrolledData } = useQuery({
    queryKey: ['course-students', courseId],
    queryFn: () => api.getCourseStudents(courseId),
    enabled: !!courseId && canManage,
  });

  const enrolledStudentIds = enrolledData?.students?.map((s) => s.id) || [];

  const { mutate: enrollStudent } = useMutation({
    mutationFn: (studentId) => api.enrollStudents(courseId, [studentId]),
    onSuccess: () => {
      queryClient.invalidateQueries(['course-students', courseId]);
      queryClient.invalidateQueries(['courses', courseId]);
      queryClient.invalidateQueries(['courses']); // Invalidate all courses to refresh student view
      addToast(t('studentEnrolled'), 'success');
    },
    onError: () => {
      addToast(t('error'), 'error');
    },
  });

  const handleEnroll = (e, studentId) => {
    e.stopPropagation();
    if (courseId) {
      enrollStudent(studentId);
    }
  };

  const { mutate: deleteStudent } = useMutation({
    mutationFn: (id) => api.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      if (courseId) {
        queryClient.invalidateQueries(['courses', courseId]);
      }
      addToast(t('studentDeleted'), 'success');
      setDeletingId(null);
    },
    onError: () => {
      addToast(t('error'), 'error');
      setDeletingId(null);
    },
  });

  const handleDelete = (e, studentId) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteStudent'))) {
      setDeletingId(studentId);
      deleteStudent(studentId);
    }
  };

  const handleEdit = (e, studentId) => {
    e.stopPropagation();
    navigate(`/students/edit/${studentId}`);
  };

  const handleAdd = () => {
    const url = courseId ? `/students/create?course=${courseId}` : '/students/create';
    navigate(url);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-20">
      <div className="flex justify-between items-center mb-4">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-bold text-gray-900"
        >
          {t('students')}
        </motion.h1>
        {canManage && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleAdd}
            className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition text-sm font-semibold"
          >
            <UserPlus size={16} />
            {t('addStudent')}
          </motion.button>
        )}
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14" count={5} />
        </div>
      ) : students.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-white rounded-lg border border-gray-200"
        >
          <Users className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600">{t('noStudents')}</p>
        </motion.div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {students.map((student, i) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{student.name}</h3>
                      {courseId && enrolledStudentIds.includes(student.id) && (
                        <CheckCircle className="text-green-600 flex-shrink-0" size={14} title={t('enrolled')} />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{student.email}</p>
                    {student.phone && <p className="text-xs text-gray-500 mt-0.5">{student.phone}</p>}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      {courseId && !enrolledStudentIds.includes(student.id) && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => handleEnroll(e, student.id)}
                          className="px-2 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition font-medium flex items-center gap-1"
                          title={t('enrollStudent')}
                        >
                          <UserCheck size={14} />
                          {t('enroll')}
                        </motion.button>
                      )}
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleEdit(e, student.id)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title={t('edit')}
                      >
                        <Edit size={16} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDelete(e, student.id)}
                        disabled={deletingId === student.id}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                        title={t('delete')}
                      >
                        {deletingId === student.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
