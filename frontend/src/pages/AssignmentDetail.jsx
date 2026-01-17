import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import AssignmentResources from '../components/AssignmentResources';
import { ArrowLeft, Clock, FileText, Plus, Eye, EyeOff, Edit, Users, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';

export default function AssignmentDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => api.getAssignment(id),
  });

  const assignment = data?.assignment;

  // Fetch submissions for admin/instructor
  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ['submissions', id],
    queryFn: async () => {
      if (!id) {
        console.error('Cannot fetch submissions: assignment ID is missing');
        return { submissions: [] };
      }
      if (!user || (user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR')) {
        console.log('User not authorized to view submissions');
        return { submissions: [] };
      }
      try {
        return await api.getSubmissions(id);
      } catch (error) {
        console.error('Failed to fetch submissions:', error);
        return { submissions: [] };
      }
    },
    enabled: !!id && !!user && (user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR'),
  });

  const submissions = submissionsData?.submissions || [];

  const { mutate: togglePublish, isPending: isToggling } = useMutation({
    mutationFn: (isPublished) => api.publishAssignment(id, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment', id]);
      queryClient.invalidateQueries(['assignments']);
      addToast(t('success'), 'success');
    },
    onError: () => {
      addToast(t('error'), 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!assignment) {
    return <div>{t('error')}</div>;
  }

  const isStudent = user?.role === 'STUDENT';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';
  const hasSubmission = assignment.mySubmission;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate('/assignments')}
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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{assignment.title}</h1>
              {isAdmin && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => togglePublish(!assignment.isPublished)}
                  disabled={isToggling}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-semibold transition ${
                    assignment.isPublished
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {assignment.isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
                  {assignment.isPublished ? t('published') : t('unpublished')}
                </motion.button>
              )}
            </div>
            <p className="text-gray-600 mb-4">{assignment.description}</p>
          </div>
          {isAdmin && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/assignments/${id}/edit`)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Edit size={20} />
            </motion.button>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Clock size={16} />
            <span>{t('dueDate')}: {new Date(assignment.dueDate).toLocaleDateString()}</span>
          </div>
          <span>{t('maxScore')}: {assignment.maxScore}</span>
        </div>
      </motion.div>

      {/* Assignment Resources */}
      <AssignmentResources
        assignmentId={id}
        canManage={isAdmin}
      />

      {/* Submissions List for Admin/Instructor */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} />
              {t('submissions')} ({submissions.length})
            </h2>
          </div>

          {submissionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto mb-2 text-gray-400" size={48} />
              <p>{t('noSubmissions')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission) => (
                <motion.div
                  key={submission.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{submission.student?.name}</h3>
                        <span className="text-sm text-gray-500">{submission.student?.email}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          submission.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          submission.status === 'NEEDS_CHANGES' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {submission.status === 'APPROVED' ? t('approved') :
                           submission.status === 'NEEDS_CHANGES' ? t('needsChanges') :
                           t('submitted')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{submission.note || t('noNote')}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{t('submittedAt')}: {new Date(submission.submittedAt).toLocaleString()}</span>
                        {submission.reviews?.[0]?.score && (
                          <span className="font-semibold text-gray-700">
                            {t('score')}: {submission.reviews[0].score}/{assignment.maxScore}
                          </span>
                        )}
                      </div>
                      {submission.assets && submission.assets.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {submission.assets.map((asset) => (
                            <a
                              key={asset.id}
                              href={asset.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition"
                            >
                              <Download size={14} />
                              {asset.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate(`/submissions/${submission.id}/review`)}
                      className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-semibold"
                    >
                      {t('review')}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {isStudent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {hasSubmission ? (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{t('mySubmission')}</h2>
              <p className="text-gray-600 mb-4">{hasSubmission.note}</p>
              <div className="flex gap-2">
                {hasSubmission.assets?.map((asset) => (
                  <a
                    key={asset.id}
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition"
                  >
                    {asset.name}
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate(`/assignments/${id}/submit`)}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-4 rounded-lg font-semibold hover:bg-primary-700 transition"
            >
              <Plus size={20} />
              {t('submitAssignment')}
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );
}
