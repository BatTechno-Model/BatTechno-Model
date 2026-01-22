import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import { Calendar, Clock, Edit, Trash2, BookOpen, ChevronDown, ChevronUp, HelpCircle, Plus, X, Save } from 'lucide-react';
import { useState } from 'react';
import GoogleFormsQuestionBuilder from '../components/GoogleFormsQuestionBuilder';

export default function AllSessions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);
  const [showQuestionBuilder, setShowQuestionBuilder] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    courseId: '',
    date: '',
    startTime: '',
    endTime: '',
    topic: '',
    notes: '',
  });
  
  const canCreate = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  // Fetch courses for dropdown
  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.getCourses(),
  });

  const courses = coursesData?.courses || [];

  const { data, isLoading } = useQuery({
    queryKey: ['all-sessions'],
    queryFn: () => api.getAllSessions(),
  });

  const sessions = data?.sessions || [];

  const { mutate: deleteSession } = useMutation({
    mutationFn: (id) => api.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-sessions']);
      addToast(t('sessionDeleted'), 'success');
      setDeletingId(null);
    },
    onError: () => {
      addToast(t('error'), 'error');
      setDeletingId(null);
    },
  });

  const { mutate: createSession, isPending: isCreating } = useMutation({
    mutationFn: (data) => api.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['all-sessions']);
      addToast(t('success'), 'success');
      setShowCreateModal(false);
      setFormData({
        courseId: '',
        date: '',
        startTime: '',
        endTime: '',
        topic: '',
        notes: '',
      });
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleCreateSession = (e) => {
    e.preventDefault();
    if (!formData.courseId || !formData.date || !formData.startTime || !formData.endTime) {
      addToast(t('fillRequiredFields'), 'error');
      return;
    }
    createSession(formData);
  };

  const handleDelete = (e, sessionId) => {
    e.stopPropagation();
    if (window.confirm(t('confirmDeleteSession'))) {
      setDeletingId(sessionId);
      deleteSession(sessionId);
    }
  };

  const handleEdit = (e, session) => {
    e.stopPropagation();
    navigate(`/sessions/${session.courseId}/edit/${session.id}`);
  };

  const handleViewCourse = (e, courseId) => {
    e.stopPropagation();
    navigate(`/courses/${courseId}`);
  };

  // Get quizzes for expanded session
  const { data: quizzesData } = useQuery({
    queryKey: ['quizzes', expandedSession],
    queryFn: () => expandedSession ? api.getQuizzes(expandedSession) : Promise.resolve({ quizzes: [] }),
    enabled: !!expandedSession,
  });

  const quizzes = quizzesData?.quizzes || [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-20">
      <div className="flex justify-between items-center mb-4">
        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xl font-bold text-gray-900"
        >
          {t('sessions')}
        </motion.h1>
        {canCreate && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition text-sm font-semibold"
          >
            <Plus size={16} />
            {t('create')}
          </motion.button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20" count={5} />
        </div>
      ) : sessions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-white rounded-lg border border-gray-200"
        >
          <Calendar className="mx-auto text-gray-400 mb-3" size={48} />
          <p className="text-gray-600">{t('noSessions')}</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, i) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div
                  onClick={() => navigate(`/attendance/${session.id}`)}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-base font-semibold text-gray-900">{session.topic || t('session')}</h3>
                    {session.course && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewCourse(e, session.courseId);
                        }}
                        className="text-xs text-primary-600 hover:text-primary-700 hover:underline font-medium"
                      >
                        {session.course.title}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>{session.startTime} - {session.endTime}</span>
                    </div>
                  </div>
                  {session.notes && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{session.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedSession(expandedSession === session.id ? null : session.id);
                    }}
                    className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50 transition"
                  >
                    <BookOpen size={14} />
                    {t('quizzes')}
                    {expandedSession === session.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <span className="text-xs text-primary-600 font-semibold px-2 py-1 bg-primary-50 rounded">
                    {session._count?.attendances || 0}
                  </span>
                  {canCreate && (
                    <div className="flex items-center gap-1">
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleEdit(e, session)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                        title={t('edit')}
                      >
                        <Edit size={16} />
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleDelete(e, session.id)}
                        disabled={deletingId === session.id}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                        title={t('delete')}
                      >
                        {deletingId === session.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-red-600"></div>
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </motion.button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Quizzes Section */}
              {expandedSession === session.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-blue-200 bg-blue-50/30 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-gray-900 text-sm">{t('quizzes')}</h4>
                    </div>
                  </div>
                  
                  {expandedSession === session.id && (
                    <SessionQuizzes
                      sessionId={session.id}
                      quizzes={expandedSession === session.id ? quizzes : []}
                      canCreate={canCreate}
                      onEditQuiz={(quizId) => setShowQuestionBuilder({ id: quizId, sessionId: session.id })}
                    />
                  )}
                </motion.div>
              )}
              
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Google Forms Question Builder Modal */}
      {showQuestionBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <GoogleFormsQuestionBuilder
            quizId={showQuestionBuilder.id}
            onClose={() => {
              setShowQuestionBuilder(null);
              queryClient.invalidateQueries(['quizzes', showQuestionBuilder.sessionId]);
              queryClient.invalidateQueries(['quizzes']);
            }}
          />
        </div>
      )}

      {/* Create Session Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-2xl mx-auto bg-white rounded-xl p-6 shadow-lg mt-8 mb-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{t('createSession')}</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('course')} *
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <select
                      value={formData.courseId}
                      onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                      required
                    >
                      <option value="">{t('selectCourse')}</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('date')} *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('startTime')} *
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('endTime')} *
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('topic')}
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={t('sessionTopic')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('notes')}
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={t('sessionNotes')}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition"
                  >
                    {t('cancel')}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
                  >
                    <Save size={20} />
                    {isCreating ? t('loading') : t('create')}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SessionQuizzes({ sessionId, quizzes, canCreate, onEditQuiz }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ quizId, status }) => api.updateQuizStatus(quizId, status),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes', sessionId]);
      addToast(t('success'), 'success');
    },
  });

  const { mutate: deleteQuiz } = useMutation({
    mutationFn: (quizId) => api.deleteQuiz(quizId),
    onSuccess: () => {
      queryClient.invalidateQueries(['quizzes', sessionId]);
      addToast(t('quizDeleted'), 'success');
    },
  });

  if (quizzes.length === 0) {
    return <p className="text-gray-500 text-xs text-center py-2">{t('noQuizzes')}</p>;
  }

  return (
    <div className="space-y-2">
      {quizzes.map((quiz) => (
        <div 
          key={quiz.id} 
          className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-primary-300 hover:bg-primary-50/30 transition-all"
          onClick={() => navigate(`/quiz/${quiz.id}/results`)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-sm text-gray-900 truncate">{quiz.title}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                quiz.type === 'PRE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
                {quiz.type === 'PRE' ? t('preQuiz') : t('postQuiz')}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                quiz.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' :
                quiz.status === 'LOCKED' ? 'bg-red-100 text-red-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {quiz.status === 'PUBLISHED' ? t('published') :
                 quiz.status === 'LOCKED' ? t('locked') : t('draft')}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {quiz._count?.questions || 0} {t('questions')}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
            {canCreate && (
              <>
                <button
                  onClick={() => onEditQuiz(quiz.id)}
                  className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
                  title={t('openQuestionBuilder')}
                >
                  {t('edit')}
                </button>
                <button
                  onClick={() => {
                    const newStatus = quiz.status === 'PUBLISHED' ? 'LOCKED' : 'PUBLISHED';
                    updateStatus({ quizId: quiz.id, status: newStatus });
                  }}
                  className="text-[10px] px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition font-medium"
                >
                  {quiz.status === 'PUBLISHED' ? t('lockQuiz') : t('publishQuiz')}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(t('confirmDeleteQuiz'))) {
                      deleteQuiz(quiz.id);
                    }
                  }}
                  className="text-[10px] px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition font-medium"
                >
                  {t('delete')}
                </button>
              </>
            )}
            {user?.role === 'STUDENT' && quiz.status === 'PUBLISHED' && (
              <button
                onClick={() => navigate(`/quiz/${quiz.id}`)}
                className="text-[10px] px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition font-medium"
              >
                {t('takeQuiz')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
