import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import { ArrowLeft, Calendar, Clock, Plus, Edit, Trash2, BookOpen, Eye, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import QuizBuilder from '../components/QuizBuilder';
import GoogleFormsQuestionBuilder from '../components/GoogleFormsQuestionBuilder';

export default function Sessions() {
  const { t } = useTranslation();
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState(null);
  const [expandedSession, setExpandedSession] = useState(null);
  const [showQuizBuilder, setShowQuizBuilder] = useState(null);
  const [showQuestionBuilder, setShowQuestionBuilder] = useState(null); // { type: 'quiz', id: string }
  
  const canCreate = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  // Create quiz and open question builder
  const { mutate: createQuizAndOpenBuilder, isPending: isCreatingQuiz } = useMutation({
    mutationFn: ({ sessionId, type }) => {
      const defaultTitle = type === 'PRE' 
        ? (t('preQuiz') || 'Pre-Quiz')
        : (t('postQuiz') || 'Post-Quiz');
      return api.createQuiz(courseId, sessionId, {
        courseId,
        sessionId,
        type,
        title: defaultTitle,
        description: '',
        attemptsAllowed: 1,
      });
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries(['quizzes', variables.sessionId]);
      setShowQuestionBuilder({ id: response.quiz.id, sessionId: variables.sessionId });
      addToast(t('quizCreated'), 'success');
    },
    onError: (error) => {
      console.error('Create quiz error:', error);
      const errorMessage = error.message || error.error || t('error');
      // Check if quiz already exists
      if (errorMessage.includes('already exists')) {
        addToast(t('quizAlreadyExists') || 'هذا الاختبار موجود بالفعل', 'warning');
      } else {
        addToast(errorMessage, 'error');
      }
    },
  });


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

  // Get quizzes for expanded session
  const { data: quizzesData } = useQuery({
    queryKey: ['quizzes', expandedSession],
    queryFn: () => expandedSession ? api.getQuizzes(expandedSession) : Promise.resolve({ quizzes: [] }),
    enabled: !!expandedSession,
  });

  const quizzes = quizzesData?.quizzes || [];


  return (
    <div className="max-w-5xl mx-auto px-4 py-4 pb-20">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 mb-4 text-sm"
      >
        <ArrowLeft size={16} />
        {t('back')}
      </motion.button>

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
            onClick={() => navigate(`/sessions/${courseId}/create`)}
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
                  <h3 className="text-base font-semibold text-gray-900 mb-1.5">{session.topic || t('session')}</h3>
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
                        onClick={(e) => handleEdit(e, session.id)}
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
                    {canCreate && (
                      <div className="flex gap-1.5">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => createQuizAndOpenBuilder({ sessionId: session.id, type: 'PRE' })}
                          disabled={isCreatingQuiz}
                          className="text-[10px] px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Plus size={12} />
                          {isCreatingQuiz ? t('loading') : t('createPreQuiz')}
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => createQuizAndOpenBuilder({ sessionId: session.id, type: 'POST' })}
                          disabled={isCreatingQuiz}
                          className="text-[10px] px-2.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <Plus size={12} />
                          {isCreatingQuiz ? t('loading') : t('createPostQuiz')}
                        </motion.button>
                      </div>
                    )}
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
      
      {/* Quiz Builder Modal */}
      {showQuizBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto">
            <QuizBuilder
              courseId={courseId}
              sessionId={showQuizBuilder.sessionId}
              quizId={showQuizBuilder.quizId}
              onClose={() => {
                setShowQuizBuilder(null);
                queryClient.invalidateQueries(['quizzes', showQuizBuilder.sessionId]);
              }}
            />
          </div>
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

