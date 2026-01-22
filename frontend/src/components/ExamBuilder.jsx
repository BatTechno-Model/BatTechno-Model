import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Save, Plus, Trash2, Edit2, X, LayoutGrid } from 'lucide-react';
import GoogleFormsQuestionBuilder from './GoogleFormsQuestionBuilder';

export default function ExamBuilder({ courseId, sessionId, examId, onClose }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [examData, setExamData] = useState({
    type: 'PRE',
    title: '',
    description: '',
    examQuestionCount: 10,
    timeLimitMinutes: '',
    attemptsAllowed: 1,
    showSolutionsAfterSubmit: false,
    availableFrom: '',
    availableTo: '',
  });

  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [showGoogleFormsBuilder, setShowGoogleFormsBuilder] = useState(false);

  // Load exam if editing
  const { data: examDataLoaded, isLoading } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => api.getExam(examId),
    enabled: !!examId,
  });

  useEffect(() => {
    if (examDataLoaded?.exam) {
      const exam = examDataLoaded.exam;
      setExamData({
        type: exam.type,
        title: exam.title,
        description: exam.description || '',
        examQuestionCount: exam.examQuestionCount || 10,
        timeLimitMinutes: exam.timeLimitMinutes || '',
        attemptsAllowed: exam.attemptsAllowed || 1,
        showSolutionsAfterSubmit: exam.showSolutionsAfterSubmit || false,
        availableFrom: exam.availableFrom ? new Date(exam.availableFrom).toISOString().slice(0, 16) : '',
        availableTo: exam.availableTo ? new Date(exam.availableTo).toISOString().slice(0, 16) : '',
      });
      setQuestions(exam.questions || []);
    }
  }, [examDataLoaded]);

  const { mutate: createExam, isPending: isCreating } = useMutation({
    mutationFn: (data) => api.createExam(sessionId, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['exams', sessionId]);
      addToast(t('success'), 'success');
      if (onClose) {
        onClose();
      } else {
        navigate(`/sessions/${sessionId}`);
      }
    },
    onError: (error) => {
      console.error('Create exam error:', error);
      let errorMessage = error.message || error.error || 'Failed to create exam';
      if (error.message?.includes('Database migration required') || error.status === 500) {
        errorMessage = 'Database migration required. Please run: cd backend && npx prisma migrate dev --name add_exams';
        setTimeout(() => {
          alert(`⚠️ Database Migration Required\n\nExam tables do not exist.\n\nPlease run:\n\ncd backend\nnpx prisma generate\nnpx prisma migrate dev --name add_exams`);
        }, 100);
      }
      addToast(errorMessage, 'error');
    },
  });

  const { mutate: updateExam, isPending: isUpdating } = useMutation({
    mutationFn: (data) => api.updateExam(examId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['exam', examId]);
      queryClient.invalidateQueries(['exams', sessionId]);
      addToast(t('success'), 'success');
      if (onClose) {
        onClose();
      }
    },
    onError: (error) => {
      addToast(error.message || error.error || t('error'), 'error');
    },
  });

  const { mutate: createQuestion } = useMutation({
    mutationFn: (data) => api.createExamQuestion(examId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['exam', examId]);
      setShowQuestionForm(false);
      setEditingQuestion(null);
      addToast(t('success'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const { mutate: updateQuestion } = useMutation({
    mutationFn: ({ questionId, data }) => api.updateExamQuestion(questionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['exam', examId]);
      setShowQuestionForm(false);
      setEditingQuestion(null);
      addToast(t('success'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const { mutate: deleteQuestion } = useMutation({
    mutationFn: (questionId) => api.deleteExamQuestion(questionId),
    onSuccess: () => {
      queryClient.invalidateQueries(['exam', examId]);
      addToast(t('examQuestionDeleted'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleSaveExam = () => {
    if (!examData.title) {
      addToast('Title is required', 'error');
      return;
    }

    if (!examData.examQuestionCount || examData.examQuestionCount < 1) {
      addToast('Exam question count must be at least 1', 'error');
      return;
    }

    const data = {
      ...examData,
      timeLimitMinutes: examData.timeLimitMinutes ? parseInt(examData.timeLimitMinutes) : null,
      attemptsAllowed: examData.attemptsAllowed || 1,
      availableFrom: examData.availableFrom && examData.availableFrom.trim() !== '' ? examData.availableFrom : null,
      availableTo: examData.availableTo && examData.availableTo.trim() !== '' ? examData.availableTo : null,
    };

    if (examId) {
      updateExam(data);
    } else {
      createExam(data);
    }
  };

  const handleSaveQuestion = (questionData) => {
    if (editingQuestion) {
      updateQuestion({ questionId: editingQuestion.id, data: questionData });
    } else {
      createQuestion(questionData);
    }
  };

  if (isLoading) {
    return <div className="p-6">{t('loading')}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => onClose ? onClose() : navigate(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">
            {examId ? t('editExam') : t('createExam')}
          </h1>
        </div>

        {/* Exam Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg shadow-md p-6 mb-6"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('examType')}</label>
              <select
                value={examData.type}
                onChange={(e) => setExamData({ ...examData, type: e.target.value })}
                className="w-full p-2 border rounded-lg"
                disabled={!!examId}
              >
                <option value="PRE">{t('preExam')}</option>
                <option value="POST">{t('postExam')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('examTitle')} *</label>
              <input
                type="text"
                value={examData.title}
                onChange={(e) => setExamData({ ...examData, title: e.target.value })}
                className="w-full p-2 border rounded-lg"
                placeholder={t('examTitle')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('description')}</label>
              <textarea
                value={examData.description}
                onChange={(e) => setExamData({ ...examData, description: e.target.value })}
                className="w-full p-2 border rounded-lg"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('examQuestionCount')} *</label>
              <input
                type="number"
                min="1"
                value={examData.examQuestionCount}
                onChange={(e) => setExamData({ ...examData, examQuestionCount: parseInt(e.target.value) || 1 })}
                className="w-full p-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">{t('examQuestionCountHint')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('timeLimitMinutes')}</label>
                <input
                  type="number"
                  min="1"
                  value={examData.timeLimitMinutes}
                  onChange={(e) => setExamData({ ...examData, timeLimitMinutes: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('attemptsAllowed')}</label>
                <input
                  type="number"
                  min="1"
                  value={examData.attemptsAllowed}
                  onChange={(e) => setExamData({ ...examData, attemptsAllowed: parseInt(e.target.value) || 1 })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showSolutions"
                checked={examData.showSolutionsAfterSubmit}
                onChange={(e) => setExamData({ ...examData, showSolutionsAfterSubmit: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="showSolutions" className="text-sm">{t('showSolutionsAfterSubmit')}</label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('availableFrom')}</label>
                <input
                  type="datetime-local"
                  value={examData.availableFrom}
                  onChange={(e) => setExamData({ ...examData, availableFrom: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">{t('availableTo')}</label>
                <input
                  type="datetime-local"
                  value={examData.availableTo}
                  onChange={(e) => setExamData({ ...examData, availableTo: e.target.value })}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={handleSaveExam}
              disabled={isCreating || isUpdating}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isCreating || isUpdating ? t('loading') : t('save')}
            </button>
          </div>
        </motion.div>

        {/* Question Bank */}
        {examId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-md p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{t('examQuestionBank')}</h2>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowGoogleFormsBuilder(true)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2 font-medium"
                >
                  <LayoutGrid className="w-4 h-4" />
                  {t('openQuestionBuilder') || 'فتح منشئ الأسئلة'}
                </motion.button>
                <button
                  onClick={() => {
                    setEditingQuestion(null);
                    setShowQuestionForm(true);
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('addExamQuestion')}
                </button>
              </div>
            </div>
            
            {/* Quick Access Hint */}
            {questions.length === 0 && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 text-center">
                  {t('quickAccessHint') || '💡 اضغط على "فتح منشئ الأسئلة" لإضافة أسئلة بسهولة'}
                </p>
              </div>
            )}

            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">{t('noExamQuestions')}</p>
            ) : (
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">{idx + 1}.</span>
                          <span className="text-xs bg-gray-200 px-2 py-1 rounded">{q.questionType}</span>
                        </div>
                        <p className="mb-2 font-medium">{q.prompt}</p>
                        {q.questionType === 'MCQ' && q.choices && (
                          <div className="space-y-2 mb-2">
                            {q.choices.map((choice, i) => {
                              const isCorrect = q.correctAnswer === i;
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
                        {q.questionType === 'TRUE_FALSE' && (
                          <div className={`p-2 rounded mb-2 ${
                            q.correctAnswer 
                              ? 'bg-green-100 border-2 border-green-500' 
                              : 'bg-gray-50 border border-gray-200'
                          }`}>
                            <span className={`font-semibold ${
                              q.correctAnswer ? 'text-green-800' : 'text-gray-700'
                            }`}>
                              {q.correctAnswer ? t('true') || 'True' : t('false') || 'False'} ✓
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{t('points')}: {q.points}</span>
                          {q.explanation && (
                            <span className="text-blue-600">{t('hasExplanation') || 'Has explanation'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingQuestion(q);
                            setShowQuestionForm(true);
                          }}
                          className="p-2 hover:bg-gray-100 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(t('confirmDeleteExamQuestion'))) {
                              deleteQuestion(q.id);
                            }
                          }}
                          className="p-2 hover:bg-red-100 rounded text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
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

        {/* Google Forms Builder Modal */}
        <AnimatePresence>
          {showGoogleFormsBuilder && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
            >
              <div className="min-h-screen">
                <GoogleFormsQuestionBuilder
                  examId={examId}
                  onClose={() => {
                    setShowGoogleFormsBuilder(false);
                    queryClient.invalidateQueries(['exam', examId]);
                    queryClient.invalidateQueries(['exam-questions', examId]);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function QuestionForm({ question, onSave, onClose }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    questionType: question?.questionType || 'MCQ',
    prompt: question?.prompt || '',
    choices: question?.choices || ['', '', '', ''],
    correctAnswer: question?.correctAnswer !== undefined 
      ? (question.questionType === 'MCQ' ? question.correctAnswer : question.correctAnswer)
      : (question?.questionType === 'MCQ' ? 0 : true),
    points: question?.points || 1,
    explanation: question?.explanation || '',
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.prompt.trim()) {
      newErrors.prompt = t('promptRequired') || 'Question prompt is required';
    }

    if (formData.questionType === 'MCQ') {
      const validChoices = formData.choices.filter(c => c.trim());
      if (validChoices.length < 2) {
        newErrors.choices = t('atLeastTwoChoices') || 'At least 2 choices are required';
      }
      
      if (formData.correctAnswer === undefined || formData.correctAnswer === null) {
        newErrors.correctAnswer = t('selectCorrectAnswer') || 'Please select the correct answer';
      } else if (formData.correctAnswer < 0 || formData.correctAnswer >= validChoices.length) {
        newErrors.correctAnswer = t('invalidCorrectAnswer') || 'Invalid correct answer selection';
      }
    }

    if (formData.points < 1) {
      newErrors.points = t('pointsMustBePositive') || 'Points must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (formData.questionType === 'MCQ') {
      const validChoices = formData.choices.filter(c => c.trim());
      const data = {
        questionType: 'MCQ',
        prompt: formData.prompt.trim(),
        choices: validChoices,
        correctAnswer: parseInt(formData.correctAnswer),
        points: formData.points,
        explanation: formData.explanation.trim() || null,
      };
      onSave(data);
    } else {
      const data = {
        questionType: 'TRUE_FALSE',
        prompt: formData.prompt.trim(),
        correctAnswer: formData.correctAnswer === true || formData.correctAnswer === 'true',
        points: formData.points,
        explanation: formData.explanation.trim() || null,
      };
      onSave(data);
    }
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
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{question ? t('editExamQuestion') : t('addExamQuestion')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('questionType')}</label>
            <select
              value={formData.questionType}
              onChange={(e) => setFormData({ ...formData, questionType: e.target.value })}
              className="w-full p-2 border rounded-lg"
              disabled={!!question}
            >
              <option value="MCQ">{t('mcq')}</option>
              <option value="TRUE_FALSE">{t('trueFalse')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              {t('questionPrompt')} *
              {errors.prompt && (
                <span className="text-red-600 text-xs ml-2">{errors.prompt}</span>
              )}
            </label>
            <textarea
              value={formData.prompt}
              onChange={(e) => {
                setFormData({ ...formData, prompt: e.target.value });
                if (errors.prompt) {
                  setErrors({ ...errors, prompt: null });
                }
              }}
              className={`w-full p-2 border rounded-lg ${
                errors.prompt ? 'border-red-500' : 'border-gray-300'
              }`}
              rows="3"
              required
              placeholder={t('enterQuestionPrompt') || 'Enter the question text...'}
            />
          </div>

          {formData.questionType === 'MCQ' && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('choices')} *
                  {errors.choices && (
                    <span className="text-red-600 text-xs ml-2">{errors.choices}</span>
                  )}
                </label>
                <div className="space-y-3">
                  {formData.choices.map((choice, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="radio"
                          name="correctAnswer"
                          checked={formData.correctAnswer === idx}
                          onChange={() => setFormData({ ...formData, correctAnswer: idx })}
                          className="w-5 h-5 text-blue-600 cursor-pointer"
                          disabled={!choice.trim()}
                        />
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => {
                            const newChoices = [...formData.choices];
                            newChoices[idx] = e.target.value;
                            setFormData({ ...formData, choices: newChoices });
                            // Clear error when user types
                            if (errors.choices) {
                              setErrors({ ...errors, choices: null });
                            }
                          }}
                          className={`flex-1 p-2 border rounded-lg ${
                            formData.correctAnswer === idx ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                          }`}
                          placeholder={`${t('choice')} ${idx + 1}`}
                        />
                      </div>
                      {formData.choices.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const newChoices = formData.choices.filter((_, i) => i !== idx);
                            let newCorrectAnswer = formData.correctAnswer;
                            // Adjust correct answer if deleted choice was selected or was before selected
                            if (formData.correctAnswer === idx) {
                              newCorrectAnswer = null;
                            } else if (formData.correctAnswer > idx) {
                              newCorrectAnswer = formData.correctAnswer - 1;
                            }
                            setFormData({ ...formData, choices: newChoices, correctAnswer: newCorrectAnswer });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {errors.correctAnswer && (
                  <p className="text-red-600 text-xs mt-1">{errors.correctAnswer}</p>
                )}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, choices: [...formData.choices, ''] })}
                  className="mt-2 text-blue-600 text-sm flex items-center gap-1 hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t('addChoice')}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  {t('selectCorrectAnswerHint') || 'Click the radio button next to the correct choice'}
                </p>
              </div>
            </>
          )}

          {formData.questionType === 'TRUE_FALSE' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('correctAnswer')} *
                {errors.correctAnswer && (
                  <span className="text-red-600 text-xs ml-2">{errors.correctAnswer}</span>
                )}
              </label>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  formData.correctAnswer === true ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="trueFalseAnswer"
                    checked={formData.correctAnswer === true}
                    onChange={() => setFormData({ ...formData, correctAnswer: true })}
                    className="w-5 h-5 text-green-600"
                  />
                  <span className="font-medium">{t('true') || 'True'}</span>
                </label>
                <label className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  formData.correctAnswer === false ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'
                }`}>
                  <input
                    type="radio"
                    name="trueFalseAnswer"
                    checked={formData.correctAnswer === false}
                    onChange={() => setFormData({ ...formData, correctAnswer: false })}
                    className="w-5 h-5 text-green-600"
                  />
                  <span className="font-medium">{t('false') || 'False'}</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              {t('points')} *
              {errors.points && (
                <span className="text-red-600 text-xs ml-2">{errors.points}</span>
              )}
            </label>
            <input
              type="number"
              min="1"
              value={formData.points}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setFormData({ ...formData, points: value });
                if (errors.points) {
                  setErrors({ ...errors, points: null });
                }
              }}
              className={`w-full p-2 border rounded-lg ${
                errors.points ? 'border-red-500' : 'border-gray-300'
              }`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('explanation') || 'Explanation (Optional)'}</label>
            <textarea
              value={formData.explanation}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded-lg"
              rows="2"
              placeholder={t('explanationPlaceholder') || 'Optional: Explain why this answer is correct...'}
            />
            <p className="text-xs text-gray-500 mt-1">{t('explanationHint') || 'This explanation can be shown to students after they submit'}</p>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              {t('save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
