import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { FileText, Plus, CheckCircle, Clock, Edit, Trash2, Users, Upload, Eye } from 'lucide-react';

export default function Assignments() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  
  const canCreate = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';
  const canManage = canCreate;
  const isStudent = user?.role === 'STUDENT';

  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.getCourses(),
  });

  const courses = coursesData?.courses || [];

  // Fetch all assignments for all courses
  const { data: assignmentsData, isLoading: assignmentsLoading, error: assignmentsError } = useQuery({
    queryKey: ['all-assignments', user?.id],
    queryFn: async () => {
      if (courses.length === 0) {
        console.log('No courses found for user');
        return [];
      }
      
      console.log(`Fetching assignments for ${courses.length} courses`);
      
      const assignmentsPromises = courses.map(async (course) => {
        try {
          const result = await api.getAssignments(course.id);
          const assignments = result.assignments || [];
          console.log(`Found ${assignments.length} assignments for course ${course.title}`);
          return assignments.map((a) => ({ ...a, courseTitle: course.title }));
        } catch (error) {
          console.error(`Failed to fetch assignments for course ${course.id}:`, error);
          return [];
        }
      });
      const results = await Promise.all(assignmentsPromises);
      const allAssignments = results.flat();
      console.log(`Total assignments found: ${allAssignments.length}`);
      return allAssignments;
    },
    enabled: courses.length > 0,
    retry: 1,
  });

  const allAssignments = assignmentsData || [];
  
  // Debug logging
  if (!assignmentsLoading) {
    console.log('Assignments page state:', {
      coursesCount: courses.length,
      assignmentsCount: allAssignments.length,
      isStudent,
      userRole: user?.role,
    });
  }

  const { mutate: deleteAssignment } = useMutation({
    mutationFn: (id) => api.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-assignments']);
      addToast(t('assignmentDeleted'), 'success');
    },
    onError: () => {
      addToast(t('error'), 'error');
    },
  });

  const handleDelete = (e, assignmentId) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteAssignment'))) {
      deleteAssignment(assignmentId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-3xl font-bold text-gray-900"
          >
            {t('assignments')}
          </motion.h1>
          {canCreate && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/assignments/create')}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              <Plus size={20} />
              {t('createAssignment')}
            </motion.button>
          )}
        </div>
        {/* Help Guide - Only show for Admin/Instructor */}
        {!isStudent && (
          <p className="text-gray-500 text-[10px] leading-relaxed">
            {t('helpGuide.assignments')}
          </p>
        )}
      </div>

      {assignmentsLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 bg-white rounded-xl border border-gray-200"
        >
          <FileText className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-600 text-lg mb-2">{t('noCourses')}</p>
          <p className="text-gray-500 text-sm">{isStudent ? t('notEnrolledInAnyCourse') : t('noCoursesAvailable')}</p>
        </motion.div>
      ) : allAssignments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 bg-white rounded-xl border border-gray-200"
        >
          <FileText className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-600 text-lg mb-2">{t('noAssignments')}</p>
          {isStudent && (
            <p className="text-gray-500 text-sm">{t('noPublishedAssignments')}</p>
          )}
        </motion.div>
      ) : (
        <div className="space-y-4">
          {allAssignments.map((assignment, i) => (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-primary-500 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => navigate(`/assignments/${assignment.id}`)}
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{assignment.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">{assignment.courseTitle}</p>
                  <p className="text-sm text-gray-500 line-clamp-2">{assignment.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock size={16} />
                    <span>{new Date(assignment.dueDate).toLocaleDateString()}</span>
                  </div>
                  
                  {/* Student Actions */}
                  {isStudent && (
                    <div className="flex items-center gap-2">
                      {assignment.mySubmission ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="text-green-600" size={18} />
                          <span className="text-sm text-green-600 font-semibold">{t('submitted')}</span>
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/assignments/${assignment.id}`)}
                            className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-semibold flex items-center gap-1"
                          >
                            <Eye size={14} />
                            {t('view')}
                          </motion.button>
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => navigate(`/assignments/${assignment.id}/submit`)}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-semibold flex items-center gap-2"
                        >
                          <Upload size={16} />
                          {t('submitAssignment')}
                        </motion.button>
                      )}
                    </div>
                  )}
                  
                  {/* Admin/Instructor Actions */}
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/assignments/${assignment.id}/edit`);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title={t('edit')}
                      >
                        <Edit size={18} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => handleDelete(e, assignment.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title={t('delete')}
                      >
                        <Trash2 size={18} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate(`/assignments/${assignment.id}`)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title={t('viewSubmissions')}
                      >
                        <Users size={18} />
                      </motion.button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
