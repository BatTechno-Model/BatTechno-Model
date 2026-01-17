import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import { ArrowLeft, Calendar, Clock, Plus, Edit, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function Sessions() {
  const { t } = useTranslation();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);
  
  const canCreate = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', courseId],
    queryFn: () => api.getSessions(courseId),
  });

  const sessions = data?.sessions || [];

  const { mutate: deleteSession } = useMutation({
    mutationFn: (id) => api.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['sessions', courseId]);
      addToast(t('sessionDeleted'), 'success');
      setDeletingId(null);
    },
    onError: () => {
      addToast(t('error'), 'error');
      setDeletingId(null);
    },
  });

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteSession'))) {
      setDeletingId(sessionId);
      deleteSession(sessionId);
    }
  };

  const handleEdit = (e, sessionId) => {
    e.stopPropagation();
    navigate(`/sessions/${courseId}/edit/${sessionId}`);
  };

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

      <div className="flex justify-between items-center mb-6">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl font-bold text-gray-900"
        >
          {t('sessions')}
        </motion.h1>
        {canCreate && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(`/sessions/${courseId}/create`)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            <Plus size={20} />
            {t('create')}
          </motion.button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24" count={5} />
        </div>
      ) : sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16 bg-white rounded-xl border border-gray-200"
        >
          <Calendar className="mx-auto text-gray-400 mb-4" size={64} />
          <p className="text-gray-600 text-lg">{t('noSessions')}</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:border-primary-500 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div
                  onClick={() => navigate(`/attendance/${session.id}`)}
                  className="flex-1 cursor-pointer"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{session.topic || t('session')}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar size={16} />
                      <span>{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={16} />
                      <span>{session.startTime} - {session.endTime}</span>
                    </div>
                  </div>
                  {session.notes && (
                    <p className="text-sm text-gray-500 mt-2">{session.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-primary-600 font-semibold">
                    {session._count?.attendances || 0} {t('attendance')}
                  </span>
                  {canCreate && (
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleEdit(e, session.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title={t('edit')}
                      >
                        <Edit size={18} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDelete(e, session.id)}
                        disabled={deletingId === session.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title={t('delete')}
                      >
                        {deletingId === session.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 size={18} />
                        )}
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
