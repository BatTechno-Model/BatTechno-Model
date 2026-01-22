import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Save, Plus, Trash2, Edit2, GripVertical, X } from 'lucide-react';

export default function QuizBuilder({ courseId, sessionId, quizId, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [quizData, setQuizData] = useState({
    type: 'PRE',
    title: '',
    description: '',
    timeLimitMinutes: '',
    attemptsAllowed: 1,
    availableFrom: '',
    availableTo: '',
  });

  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);

  // Load quiz if editing
  const { data: quizDataLoaded, isLoading } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => api.getQuiz(quizId),
    enabled: !!quizId,
  });

  useEffect(() => {
    if (quizDataLoaded?.quiz) {
      const quiz = quizDataLoaded.quiz;
      setQuizData({
        type: quiz.type,
        title: quiz.title,
        description: quiz.description || '',
        timeLimitMinutes: quiz.timeLimitMinutes || '',
        attemptsAllowed: quiz.attemptsAllowed || 1,
        availableFrom: quiz.availableFrom ? new Date(quiz.availableFrom).toISOString().slice(0, 16) : '',
        availableTo: quiz.availableTo ? new Date(quiz.availableTo).toISOString().slice(0, 16) : '',
      });
      setQuestions(quiz.questions || []);
    }
  }, [quizDataLoaded]);

  const { mutate: createQuiz, isPending: isCreating } = useMutation({
    mutationFn: (data) => api.createQuiz(courseId, sessionId, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['quizzes', sessionId]);
      addToast(t('success'), 'success');
      if (onClose) {
        onClose();
      } else {
        navigate(`/sessions/${sessionId}`);
      }
    },
    onError: (error) => {
      console.error('Create quiz error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        error: error.error,
      });
      
      // Extract error message
      let errorMessage = error.message || error.error || 'Failed to create quiz';
      
      // Check for migration error
      if (error.message?.includes('Database migration required') || 
          error.message?.includes('migration') ||
          error.status === 500) {
        errorMessage = 'Database migration required. Please run: cd backend && npx prisma migrate dev --name add_quizzes';
        setTimeout(() => {
          alert(`⚠️ Database Migration Required\n\nQuiz tables do not exist in the database.\n\nPlease run these commands:\n\ncd backend\nnpx prisma generate\nnpx prisma migrate dev --name add_quizzes\n\nThen restart your backend server.`);
        }, 100);
      }
      
      addToast(errorMessage, 'error');
    },
  });

  const { mutate: updateQuiz, isPending: isUpdating } = useMutation({
    mutationFn: (data) => api.updateQuiz(quizId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['quiz', quizId]);
      queryClient.invalidateQueries(['quizzes', sessionId]);
      addToast(t('success'), 'success');
      if (onClose) {
        onClose();
      }
    },
    onError: (error) => {
      console.error('Update quiz error:', error);
      const errorMessage = error.message || error.error || t('error');
      addToast(errorMessage, 'error');
    },
  });

  const { mutate: createQuestion } = useMutation({
    mutationFn: (data) => api.createQuestion(quizId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['quiz', quizId]);
      setShowQuestionForm(false);
      setEditingQuestion(null);
      addToast(t('success'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const { mutate: updateQuestion } = useMutation({
    mutationFn: ({ questionId, data }) => api.updateQuestion(questionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['quiz', quizId]);
      setShowQuestionForm(false);
      setEditingQuestion(null);
      addToast(t('success'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const { mutate: deleteQuestion } = useMutation({
    mutationFn: (questionId) => api.deleteQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['quiz', quizId]);
      addToast(t('questionDeleted'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleSaveQuiz = () => {
    if (!quizData.title) {
      addToast(t('fillRequiredFields'), 'error');
      return;
    }

    const data = {
      ...quizData,
      timeLimitMinutes: quizData.timeLimitMinutes ? parseInt(quizData.timeLimitMinutes) : null,
      attemptsAllowed: parseInt(quizData.attemptsAllowed) || 1,
      availableFrom: quizData.availableFrom && quizData.availableFrom.trim() !== '' ? quizData.availableFrom : null,
      availableTo: quizData.availableTo && quizData.availableTo.trim() !== '' ? quizData.availableTo : null,
    };

    if (quizId) {
      updateQuiz(data);
    } else {
      createQuiz(data);
    }
  };

  const handleSaveQuestion = (questionData) => {
    const data = {
      ...questionData,
      choices: questionData.type === 'SHORT_TEXT' ? null : questionData.choices,
      correctAnswer: typeof questionData.correctAnswer === 'string'
        ? questionData.correctAnswer
        : JSON.stringify(questionData.correctAnswer),
      tags: Array.isArray(questionData.tags)
        ? questionData.tags
        : questionData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      points: parseInt(questionData.points) || 1,
      orderIndex: questionData.orderIndex || questions.length,
    };

    if (editingQuestion) {
      updateQuestion({ questionId: editingQuestion.id, data });
    } else {
      createQuestion(data);
    }
  };

  if (isLoading) {
    return <div className="p-4">{t('loading')}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {quizId ? t('editQuiz') : t('createQuiz')}
          </h1>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Quiz Metadata */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('quizType')} *
            </label>
            <select
              value={quizData.type}
              onChange={(e) => setQuizData({ ...quizData, type: e.target.value })}
              disabled={!!quizId}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="PRE">{t('preQuiz')}</option>
              <option value="POST">{t('postQuiz')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('quizTitle')} *
            </label>
            <input
              type="text"
              value={quizData.title}
              onChange={(e) => setQuizData({ ...quizData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder={t('quizTitle')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('quizDescription')}
            </label>
            <textarea
              value={quizData.description}
              onChange={(e) => setQuizData({ ...quizData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('timeLimit')} ({t('optional')})
              </label>
              <input
                type="number"
                value={quizData.timeLimitMinutes}
                onChange={(e) => setQuizData({ ...quizData, timeLimitMinutes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('attemptsAllowed')}
              </label>
              <input
                type="number"
                value={quizData.attemptsAllowed}
                onChange={(e) => setQuizData({ ...quizData, attemptsAllowed: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('availableFrom')} ({t('optional')})
              </label>
              <input
                type="datetime-local"
                value={quizData.availableFrom}
                onChange={(e) => setQuizData({ ...quizData, availableFrom: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('availableTo')} ({t('optional')})
              </label>
              <input
                type="datetime-local"
                value={quizData.availableTo}
                onChange={(e) => setQuizData({ ...quizData, availableTo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Questions Section */}
        {quizId && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">{t('questions')}</h2>
              <button
                onClick={() => {
                  setEditingQuestion(null);
                  setShowQuestionForm(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus size={20} />
                {t('addQuestion')}
              </button>
            </div>

            <AnimatePresence>
              {questions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">{t('noQuestions')}</p>
              ) : (
                <div className="space-y-4">
                  {questions.map((question, index) => (
                    <motion.div
                      key={question.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-500">
                              {t('questionNumber')} {index + 1}
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {question.type === 'MCQ' ? t('mcq') : question.type === 'TRUE_FALSE' ? t('trueFalse') : t('shortText')}
                            </span>
                            <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded">
                              {question.points} {t('points')}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 mb-2">{question.prompt}</p>
                          {question.choices && Array.isArray(question.choices) && (
                            <div className="space-y-2 mb-2">
                              {question.choices.map((choice, i) => {
                                const isCorrect = question.correctAnswer === i || question.correctAnswer === choice;
                                return (
                                  <div
                                    key={i}
                                    className={`flex items-center gap-2 p-2 rounded ${
                                      isCorrect 
                                        ? 'bg-green-100 border-2 border-green-500' 
                                        : 'bg-gray-50 border border-gray-200'
                                    }`}
                                  >
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      isCorrect ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                                    }`}>
                                      {i + 1}
                                    </span>
                                    <span className={`flex-1 ${isCorrect ? 'font-semibold text-green-800' : 'text-gray-700'}`}>
                                      {choice}
                                    </span>
                                    {isCorrect && (
                                      <span className="text-green-600 font-bold">✓</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {question.type === 'TRUE_FALSE' && (
                            <div className={`p-2 rounded mb-2 ${
                              question.correctAnswer 
                                ? 'bg-green-100 border-2 border-green-500' 
                                : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <span className={`font-semibold ${
                                question.correctAnswer ? 'text-green-800' : 'text-gray-700'
                              }`}>
                                {question.correctAnswer ? t('true') || 'True' : t('false') || 'False'} ✓
                              </span>
                            </div>
                          )}
                          {question.tags && Array.isArray(question.tags) && question.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {question.tags.map((tag, i) => (
                                <span key={i} className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingQuestion(question);
                              setShowQuestionForm(true);
                            }}
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(t('confirmDeleteQuestion'))) {
                                deleteQuestion(question.id);
                              }
                            }}
                            className="p-2 hover:bg-red-100 rounded transition-colors text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Question Form Modal */}
        <AnimatePresence>
          {showQuestionForm && (
            <QuestionForm
              question={editingQuestion}
              onSave={handleSaveQuestion}
              onClose={() => {
                setShowQuestionForm(false);
                setEditingQuestion(null);
              }}
            />
          )}
        </AnimatePresence>

        {/* Save Button */}
        <div className="flex justify-end gap-4 mt-6">
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('cancel')}
            </button>
          )}
          <button
            onClick={handleSaveQuiz}
            disabled={isCreating || isUpdating}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Save size={20} />
            {t('save')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function QuestionForm({ question, onSave, onClose }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    type: question?.type || 'MCQ',
    prompt: question?.prompt || '',
    choices: question?.choices || ['', ''],
    correctAnswer: question?.correctAnswer || '',
    points: question?.points || 1,
    tags: Array.isArray(question?.tags) ? question.tags.join(', ') : question?.tags || '',
    orderIndex: question?.orderIndex || 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.prompt.trim()) {
      return;
    }

    if (formData.type === 'MCQ') {
      const validChoices = formData.choices.filter(c => c.trim());
      if (validChoices.length < 2) {
        return;
      }
      if (formData.correctAnswer === '' || formData.correctAnswer === null || formData.correctAnswer === undefined) {
        return;
      }
    }

    if (formData.type === 'TRUE_FALSE' && !formData.correctAnswer) {
      return;
    }

    let correctAnswer = formData.correctAnswer;
    
    // For MCQ, ensure correctAnswer is the index (number)
    if (formData.type === 'MCQ' && Array.isArray(formData.choices)) {
      if (typeof correctAnswer === 'string') {
        // Find index if it's a string value
        const index = formData.choices.findIndex(c => c === correctAnswer);
        correctAnswer = index >= 0 ? index : parseInt(correctAnswer);
      } else {
        correctAnswer = parseInt(correctAnswer);
      }
    }

    onSave({
      ...formData,
      correctAnswer,
      choices: formData.type === 'MCQ' ? formData.choices.filter(c => c.trim()) : formData.choices,
    });
  };

  const addChoice = () => {
    setFormData({
      ...formData,
      choices: [...formData.choices, ''],
    });
  };

  const updateChoice = (index, value) => {
    const newChoices = [...formData.choices];
    newChoices[index] = value;
    setFormData({ ...formData, choices: newChoices });
  };

  const removeChoice = (index) => {
    const newChoices = formData.choices.filter((_, i) => i !== index);
    setFormData({ ...formData, choices: newChoices });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold mb-4">
          {question ? t('editQuestion') : t('addQuestion')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('questionType')} *
            </label>
            <select
              value={formData.type}
              onChange={(e) => {
                const newType = e.target.value;
                setFormData({
                  ...formData,
                  type: newType,
                  choices: newType === 'SHORT_TEXT' ? [] : (formData.choices.length >= 2 ? formData.choices : ['', '']),
                });
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="MCQ">{t('mcq')}</option>
              <option value="TRUE_FALSE">{t('trueFalse')}</option>
              <option value="SHORT_TEXT">{t('shortText')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('questionPrompt')} *
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              rows={3}
              required
            />
          </div>

          {formData.type !== 'SHORT_TEXT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('choices')} * {t('selectCorrectAnswerHint') || '(Click radio button to select correct answer)'}
              </label>
              <div className="space-y-3">
                {formData.choices.map((choice, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={formData.correctAnswer === index || formData.correctAnswer === choice}
                        onChange={() => setFormData({ ...formData, correctAnswer: formData.type === 'MCQ' ? index : choice })}
                        className="w-5 h-5 text-primary-600 cursor-pointer"
                        disabled={!choice.trim()}
                      />
                      <input
                        type="text"
                        value={choice}
                        onChange={(e) => updateChoice(index, e.target.value)}
                        className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 ${
                          (formData.correctAnswer === index || formData.correctAnswer === choice) 
                            ? 'border-primary-500 bg-primary-50' 
                            : 'border-gray-300'
                        }`}
                        placeholder={`${t('choice')} ${index + 1}`}
                        required
                      />
                    </div>
                    {formData.choices.length > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          removeChoice(index);
                          // Adjust correct answer if needed
                          if (formData.type === 'MCQ' && formData.correctAnswer === index) {
                            setFormData({ ...formData, correctAnswer: '' });
                          }
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addChoice}
                  className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1 transition-colors"
                >
                  <Plus size={16} />
                  {t('addChoice')}
                </button>
              </div>
            </div>
          )}

          {formData.type === 'TRUE_FALSE' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('correctAnswer')} *
              </label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  formData.correctAnswer === 'true' || formData.correctAnswer === true
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="trueFalseAnswer"
                    checked={formData.correctAnswer === 'true' || formData.correctAnswer === true}
                    onChange={() => setFormData({ ...formData, correctAnswer: 'true' })}
                    className="w-5 h-5 text-green-600"
                  />
                  <span className="font-medium">{t('true') || 'True'}</span>
                </label>
                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  formData.correctAnswer === 'false' || formData.correctAnswer === false
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="trueFalseAnswer"
                    checked={formData.correctAnswer === 'false' || formData.correctAnswer === false}
                    onChange={() => setFormData({ ...formData, correctAnswer: 'false' })}
                    className="w-5 h-5 text-green-600"
                  />
                  <span className="font-medium">{t('false') || 'False'}</span>
                </label>
              </div>
            </div>
          )}

          {formData.type === 'MCQ' && formData.choices.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                {t('selectedCorrectAnswer') || 'Selected correct answer:'} {
                  formData.correctAnswer !== '' && formData.correctAnswer !== null
                    ? (typeof formData.correctAnswer === 'number' 
                        ? `${t('choice')} ${formData.correctAnswer + 1}: ${formData.choices[formData.correctAnswer]}`
                        : formData.choices.find((c, i) => c === formData.correctAnswer || i === formData.correctAnswer) || t('notSelected'))
                    : t('notSelected') || 'Not selected'
                }
              </p>
            </div>
          )}

          {formData.type === 'SHORT_TEXT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('correctAnswer')} *
              </label>
              <input
                type="text"
                value={formData.correctAnswer}
                onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('points')}
              </label>
              <input
                type="number"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tags')}
              </label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="React, API, SQL"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {t('save')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
