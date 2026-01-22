import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import {
  Plus,
  Trash2,
  Copy,
  GripVertical,
  Eye,
  EyeOff,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  Send,
} from 'lucide-react';

export default function GoogleFormsQuestionBuilder({ examId, quizId, onClose }) {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [saveStatuses, setSaveStatuses] = useState({}); // { questionId: 'saved' | 'saving' | 'error' }
  const autosaveTimers = useRef({});
  const [lastSavedTimes, setLastSavedTimes] = useState({});

  const isExam = !!examId;
  const entityId = examId || quizId;

  // Load quiz data to get status (only for quizzes)
  const { data: quizData } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => api.getQuiz(quizId),
    enabled: !!quizId && !isExam,
  });

  const quizStatus = quizData?.quiz?.status || 'DRAFT';

  // Load questions
  const { data, isLoading } = useQuery({
    queryKey: isExam ? ['exam-questions', examId] : ['quiz-questions', quizId],
    queryFn: () => {
      if (isExam) {
        return api.getExamQuestions(examId);
      } else {
        // For quiz, get questions directly
        return api.getQuizQuestions(quizId);
      }
    },
    enabled: !!entityId,
    staleTime: 30000, // Cache for 30 seconds to reduce requests
    retry: (failureCount, error) => {
      // Don't retry on 429 errors (handled by api.js with backoff)
      if (error?.status === 429) {
        return false;
      }
      // Retry other errors up to 1 time
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  useEffect(() => {
    if (data?.questions) {
      setQuestions(data.questions);
      // Initialize save statuses
      const initialStatuses = {};
      data.questions.forEach(q => {
        initialStatuses[q.id] = 'saved';
      });
      setSaveStatuses(initialStatuses);
    }
  }, [data]);

  // Autosave mutation
  const { mutate: autosaveQuestion } = useMutation({
    mutationFn: async ({ questionId, questionData }) => {
      setSaveStatuses(prev => ({ ...prev, [questionId]: 'saving' }));
      try {
        if (isExam) {
          await api.updateExamQuestion(questionId, questionData);
        } else {
          await api.updateQuestion(questionId, questionData);
        }
        setSaveStatuses(prev => ({ ...prev, [questionId]: 'saved' }));
        setLastSavedTimes(prev => ({ ...prev, [questionId]: new Date() }));
        return true;
      } catch (error) {
        setSaveStatuses(prev => ({ ...prev, [questionId]: 'error' }));
        throw error;
      }
    },
    onError: (error, variables) => {
      addToast(error.message || t('autosaveFailed'), 'error');
    },
  });

  // Debounced autosave
  const debouncedAutosave = useCallback((questionId, questionData) => {
    // Clear existing timer
    if (autosaveTimers.current[questionId]) {
      clearTimeout(autosaveTimers.current[questionId]);
    }

    // Set new timer
    autosaveTimers.current[questionId] = setTimeout(() => {
      // Convert questionData format if needed for quiz
      const dataToSave = isExam ? questionData : {
        prompt: questionData.prompt,
        choices: questionData.choices,
        correctAnswer: questionData.correctAnswer,
        points: questionData.points,
        tags: questionData.tags || [],
      };
      autosaveQuestion({ questionId, questionData: dataToSave });
      delete autosaveTimers.current[questionId];
    }, 600);
  }, [autosaveQuestion, isExam]);

  // Update question locally and trigger autosave
  const updateQuestion = useCallback((questionId, updates) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        const updated = { ...q, ...updates };
        // Trigger autosave
        debouncedAutosave(questionId, updated);
        return updated;
      }
      return q;
    }));
  }, [debouncedAutosave]);

  // Add new question
  const { mutate: createQuestion } = useMutation({
    mutationFn: (data) => {
      if (isExam) {
        return api.createExamQuestion(examId, data);
      } else {
        return api.createQuestion(quizId, data);
      }
    },
    onSuccess: (response) => {
      if (isExam) {
        queryClient.invalidateQueries(['exam-questions', examId]);
        queryClient.invalidateQueries(['exam', examId]);
      } else {
        queryClient.invalidateQueries(['quiz-questions', quizId]);
        queryClient.invalidateQueries(['quiz', quizId]);
      }
      // Scroll to new question
      setTimeout(() => {
        const questionId = response.question?.id || response.id;
        const element = document.getElementById(`question-${questionId}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleAddQuestion = (type = 'MCQ') => {
    // Set default correctAnswer (required by Prisma schema)
    const defaultData = isExam ? {
      questionType: type,
      prompt: '',
      choices: type === 'MCQ' ? ['', ''] : null,
      correctAnswer: type === 'MCQ' ? 0 : true,
      points: 1,
    } : {
      type: type,
      prompt: '',
      choices: type === 'MCQ' ? ['', ''] : [],
      correctAnswer: type === 'MCQ' ? 0 : (type === 'TRUE_FALSE' ? true : ''),
      points: 1,
      tags: [],
      orderIndex: questions.length,
    };
    createQuestion(defaultData);
  };

  // Delete question
  const { mutate: deleteQuestion } = useMutation({
    mutationFn: (questionId) => {
      if (isExam) {
        return api.deleteExamQuestion(questionId);
      } else {
        return api.deleteQuestion(questionId);
      }
    },
    onSuccess: () => {
      if (isExam) {
        queryClient.invalidateQueries(['exam-questions', examId]);
        queryClient.invalidateQueries(['exam', examId]);
      } else {
        queryClient.invalidateQueries(['quiz-questions', quizId]);
        queryClient.invalidateQueries(['quiz', quizId]);
      }
      addToast(t('questionDeleted'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  // Duplicate question
  const { mutate: duplicateQuestion } = useMutation({
    mutationFn: async (questionId) => {
      if (isExam) {
        return api.duplicateExamQuestion(questionId);
      } else {
        // For quiz, duplicate manually by creating a copy
        const question = questions.find(q => q.id === questionId);
        if (!question) throw new Error('Question not found');
        const duplicateData = {
          type: question.type || question.questionType,
          prompt: `${question.prompt} (Copy)`,
          choices: question.choices || [],
          correctAnswer: question.correctAnswer,
          points: question.points,
          tags: question.tags || [],
        };
        return api.createQuestion(quizId, duplicateData);
      }
    },
    onSuccess: () => {
      if (isExam) {
        queryClient.invalidateQueries(['exam-questions', examId]);
        queryClient.invalidateQueries(['exam', examId]);
      } else {
        queryClient.invalidateQueries(['quiz-questions', quizId]);
        queryClient.invalidateQueries(['quiz', quizId]);
      }
      addToast(t('questionDuplicated'), 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  // Reorder questions
  const { mutate: reorderQuestions } = useMutation({
    mutationFn: (orderedIds) => {
      if (isExam) {
        return api.reorderExamQuestions(examId, orderedIds);
      } else {
        return api.reorderQuestions(quizId, orderedIds);
      }
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
      // Reload questions on error
      if (isExam) {
        queryClient.invalidateQueries(['exam-questions', examId]);
      } else {
        queryClient.invalidateQueries(['quiz-questions', quizId]);
      }
    },
  });

  const handleReorder = (newOrder) => {
    setQuestions(newOrder);
    const orderedIds = newOrder.map(q => q.id);
    reorderQuestions(orderedIds);
  };

  // Publish quiz mutation
  const { mutate: publishQuiz, isPending: isPublishing } = useMutation({
    mutationFn: () => {
      if (isExam) {
        return api.updateExamStatus(examId, 'PUBLISHED');
      } else {
        return api.updateQuizStatus(quizId, 'PUBLISHED');
      }
    },
    onSuccess: () => {
      if (isExam) {
        queryClient.invalidateQueries(['exam', examId]);
      } else {
        queryClient.invalidateQueries(['quiz', quizId]);
        queryClient.invalidateQueries(['quizzes']);
      }
      addToast(t('quizPublished') || 'تم نشر الاختبار بنجاح', 'success');
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">{t('questionBuilder') || 'Question Builder'}</h1>
            <div className="flex items-center gap-3">
              {!isExam && quizStatus !== 'PUBLISHED' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => publishQuiz()}
                  disabled={isPublishing || questions.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Send size={18} />
                  {isPublishing ? t('loading') : (t('publishQuiz') || 'نشر الاختبار')}
                </motion.button>
              )}
              {!isExam && quizStatus === 'PUBLISHED' && (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">
                  <CheckCircle size={18} />
                  {t('published') || 'منشور'}
                </div>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  isPreviewMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {isPreviewMode ? <EyeOff size={18} /> : <Eye size={18} />}
                {isPreviewMode ? t('editMode') || 'Edit Mode' : t('previewMode') || 'Preview Mode'}
              </motion.button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  {t('close')}
                </button>
              )}
            </div>
          </div>
          
          {/* Quick Add Buttons in Header */}
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleAddQuestion('MCQ')}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
            >
              <Plus size={18} />
              {t('addMcqQuestion') || 'إضافة اختيار من متعدد'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleAddQuestion('TRUE_FALSE')}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
            >
              <Plus size={18} />
              {t('addTrueFalseQuestion') || 'إضافة صح/خطأ'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Reorder.Group
          axis="y"
          values={questions}
          onReorder={handleReorder}
          className="space-y-4"
        >
          <AnimatePresence>
            {questions.map((question, index) => (
              <QuestionCard
                key={question.id}
                question={question}
                index={index}
                isPreviewMode={isPreviewMode}
                saveStatus={saveStatuses[question.id]}
                lastSaved={lastSavedTimes[question.id]}
                onUpdate={(updates) => updateQuestion(question.id, updates)}
                onDelete={() => {
                  if (confirm(t('confirmDeleteExamQuestion'))) {
                    deleteQuestion(question.id);
                  }
                }}
                onDuplicate={() => handleDuplicate(question.id)}
                isExam={isExam}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {/* Add Question Button (Floating at bottom) */}
        {questions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 sticky bottom-4 bg-white p-4 rounded-lg shadow-lg border-2 border-gray-200"
          >
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAddQuestion('MCQ')}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium"
              >
                <Plus size={20} />
                {t('addMcqQuestion') || 'إضافة اختيار من متعدد'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAddQuestion('TRUE_FALSE')}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-medium"
              >
                <Plus size={20} />
                {t('addTrueFalseQuestion') || 'إضافة صح/خطأ'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  isPreviewMode,
  saveStatus,
  lastSaved,
  onUpdate,
  onDelete,
  onDuplicate,
  isExam = true,
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [localQuestion, setLocalQuestion] = useState(question);
  
  // Normalize question type field (exam uses questionType, quiz uses type)
  const questionType = question.questionType || question.type;

  useEffect(() => {
    setLocalQuestion(question);
  }, [question]);

  const handleChange = (field, value) => {
    const updated = { ...localQuestion, [field]: value };
    setLocalQuestion(updated);
    onUpdate(updated);
  };

  const handleChoiceChange = (choiceIndex, value) => {
    const newChoices = [...(localQuestion.choices || [])];
    newChoices[choiceIndex] = value;
    handleChange('choices', newChoices);
  };

  const handleAddChoice = () => {
    const newChoices = [...(localQuestion.choices || []), ''];
    handleChange('choices', newChoices);
  };

  const handleRemoveChoice = (index) => {
    const newChoices = localQuestion.choices.filter((_, i) => i !== index);
    handleChange('choices', newChoices);
    // Adjust correct answer if needed
    if (localQuestion.correctAnswer >= index) {
      handleChange('correctAnswer', Math.max(0, localQuestion.correctAnswer - 1));
    }
  };

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'saved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return t('saving') || 'Saving...';
      case 'error':
        return t('saveError') || 'Error';
      case 'saved':
        return lastSaved
          ? `${t('saved') || 'Saved'} ${new Date(lastSaved).toLocaleTimeString()}`
          : t('saved') || 'Saved';
      default:
        return '';
    }
  };

  if (isPreviewMode) {
    return (
      <motion.div
        id={`question-${question.id}`}
        className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200"
      >
        <PreviewQuestionView question={question} index={index} />
      </motion.div>
    );
  }

  return (
    <Reorder.Item
      value={question}
      id={`question-${question.id}`}
      className="bg-white rounded-lg shadow-md border-2 border-gray-200"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
              <span className="font-semibold text-gray-700">{index + 1}.</span>
              <select
                value={localQuestion.questionType || localQuestion.type}
                onChange={(e) => {
                  if (isExam) {
                    handleChange('questionType', e.target.value);
                  } else {
                    handleChange('type', e.target.value);
                  }
                }}
                className="px-3 py-1 border rounded-lg text-sm"
              >
                <option value="MCQ">{t('mcq')}</option>
                <option value="TRUE_FALSE">{t('trueFalse')}</option>
              </select>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {getSaveStatusIcon()}
                <span>{getSaveStatusText()}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDuplicate}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={t('duplicate') || 'Duplicate'}
              >
                <Copy className="w-4 h-4 text-gray-600" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDelete}
                className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                title={t('delete') || 'Delete'}
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </motion.button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronDown
                  className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {isExpanded && (
          <div className="p-6 space-y-4">
            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('questionPrompt')} *
              </label>
              <textarea
                value={localQuestion.prompt}
                onChange={(e) => handleChange('prompt', e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                rows="2"
                placeholder={t('enterQuestionPrompt') || 'Enter question text...'}
              />
            </div>

            {/* MCQ Options */}
            {(localQuestion.questionType === 'MCQ' || localQuestion.type === 'MCQ') && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('choices')} * {t('selectCorrectAnswerHint')}
                </label>
                <div className="space-y-3">
                  {(localQuestion.choices || []).map((choice, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name={`correct-${question.id}`}
                        checked={localQuestion.correctAnswer === idx}
                        onChange={() => handleChange('correctAnswer', idx)}
                        className="w-5 h-5 text-blue-600 cursor-pointer"
                        disabled={!choice.trim()}
                      />
                      <input
                        type="text"
                        value={choice}
                        onChange={(e) => handleChoiceChange(idx, e.target.value)}
                        className={`flex-1 p-2 border rounded-lg ${
                          localQuestion.correctAnswer === idx
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300'
                        }`}
                        placeholder={`${t('choice')} ${idx + 1}`}
                      />
                      {(localQuestion.choices || []).length > 2 && (
                        <button
                          onClick={() => handleRemoveChoice(idx)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddChoice}
                  className="mt-2 text-blue-600 text-sm flex items-center gap-1 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  {t('addChoice')}
                </button>
              </div>
            )}

            {/* True/False */}
            {(localQuestion.questionType === 'TRUE_FALSE' || localQuestion.type === 'TRUE_FALSE') && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('correctAnswer')} *
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      localQuestion.correctAnswer === true
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`tf-${question.id}`}
                      checked={localQuestion.correctAnswer === true}
                      onChange={() => handleChange('correctAnswer', true)}
                      className="w-5 h-5 text-green-600"
                    />
                    <span className="font-medium">{t('true') || 'True'}</span>
                  </label>
                  <label
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      localQuestion.correctAnswer === false
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`tf-${question.id}`}
                      checked={localQuestion.correctAnswer === false}
                      onChange={() => handleChange('correctAnswer', false)}
                      className="w-5 h-5 text-green-600"
                    />
                    <span className="font-medium">{t('false') || 'False'}</span>
                  </label>
                </div>
              </div>
            )}

            {/* Points */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">
                  {t('points')} *
                </label>
                <input
                  type="number"
                  min="1"
                  value={localQuestion.points}
                  onChange={(e) => handleChange('points', parseInt(e.target.value) || 1)}
                  className="w-full p-2 border rounded-lg"
                />
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </Reorder.Item>
  );
}

function PreviewQuestionView({ question, index }) {
  const { t } = useTranslation();
  const questionType = question.questionType || question.type;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="font-semibold text-gray-700">{index + 1}.</span>
        <span className="text-xs bg-gray-200 px-2 py-1 rounded">{questionType}</span>
      </div>
      <p className="mb-4 font-medium text-gray-900">{question.prompt}</p>

      {questionType === 'MCQ' && question.choices && (
        <div className="space-y-2">
          {question.choices.map((choice, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg"
            >
              <input type="radio" name={`preview-${question.id}`} disabled className="w-5 h-5" />
              <span>{choice}</span>
            </div>
          ))}
        </div>
      )}

      {questionType === 'TRUE_FALSE' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg">
            <input type="radio" name={`preview-tf-${question.id}`} disabled className="w-5 h-5" />
            <span>{t('true') || 'True'}</span>
          </div>
          <div className="flex items-center gap-3 p-3 border-2 border-gray-200 rounded-lg">
            <input type="radio" name={`preview-tf-${question.id}`} disabled className="w-5 h-5" />
            <span>{t('false') || 'False'}</span>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-500">
        {t('points')}: {question.points}
      </div>
    </div>
  );
}
