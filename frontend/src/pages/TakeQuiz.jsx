import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Clock, CheckCircle, XCircle, Trophy } from 'lucide-react';

export default function TakeQuiz() {
  const { t } = useTranslation();
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: quizData, isLoading } = useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => api.getQuiz(quizId),
  });

  const quiz = quizData?.quiz;
  const questions = quiz?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Start attempt
  const { mutate: startAttempt, data: attemptData } = useMutation({
    mutationFn: () => api.startQuizAttempt(quizId),
    onSuccess: (response) => {
      queryClient.setQueryData(['attempt', response.attempt.id], response.attempt);
      if (quiz?.timeLimitMinutes) {
        setTimeRemaining(quiz.timeLimitMinutes * 60);
      }
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
      navigate(-1);
    },
  });

  const attempt = attemptData?.attempt;

  // Timer effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Auto-save answers
  const { mutate: saveAnswer } = useMutation({
    mutationFn: ({ questionId, answer }) => api.submitAnswer(attempt.id, questionId, answer),
    onError: (error) => {
      console.error('Failed to save answer:', error);
    },
  });

  const handleAnswerChange = (questionId, answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    if (attempt) {
      saveAnswer({ questionId, answer });
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmit = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    api.submitAttempt(attempt.id)
      .then((response) => {
        queryClient.invalidateQueries(['quiz', quizId]);
        queryClient.invalidateQueries(['myQuizzes']);
        queryClient.invalidateQueries(['myEvaluations']);
        navigate(`/quiz-result/${attempt.id}`);
      })
      .catch((error) => {
        addToast(error.message || t('error'), 'error');
        setIsSubmitting(false);
      });
  };

  useEffect(() => {
    if (quiz && !attempt) {
      startAttempt();
    }
  }, [quiz]);

  if (isLoading || !quiz || !attempt) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="text-center">{t('loading')}</div>
      </div>
    );
  }

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            {quiz.description && (
              <p className="text-gray-600 mt-1">{quiz.description}</p>
            )}
          </div>
          {timeRemaining !== null && (
            <div className="flex items-center gap-2 text-lg font-semibold text-red-600">
              <Clock size={24} />
              <span>
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="bg-primary-600 h-2 rounded-full transition-all"
          />
        </div>
        <div className="text-sm text-gray-600 mt-2 text-center">
          {t('questionNumber')} {currentQuestionIndex + 1} {t('of')} {questions.length}
        </div>
      </motion.div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6"
        >
          <div className="mb-4">
            <span className="text-sm font-medium text-primary-600">
              {t('questionNumber')} {currentQuestionIndex + 1}
            </span>
            <span className="text-sm text-gray-500 mx-2">•</span>
            <span className="text-sm text-gray-500">
              {currentQuestion.points} {t('points')}
            </span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-6">{currentQuestion.prompt}</h2>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQuestion.type === 'TRUE_FALSE' ? (
              <>
                <button
                  onClick={() => handleAnswerChange(currentQuestion.id, 'true')}
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    answers[currentQuestion.id] === 'true'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      answers[currentQuestion.id] === 'true'
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-300'
                    }`}>
                      {answers[currentQuestion.id] === 'true' && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="font-medium">True</span>
                  </div>
                </button>
                <button
                  onClick={() => handleAnswerChange(currentQuestion.id, 'false')}
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    answers[currentQuestion.id] === 'false'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      answers[currentQuestion.id] === 'false'
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-300'
                    }`}>
                      {answers[currentQuestion.id] === 'false' && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="font-medium">False</span>
                  </div>
                </button>
              </>
            ) : currentQuestion.type === 'MCQ' ? (
              Array.isArray(currentQuestion.choices) && currentQuestion.choices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerChange(currentQuestion.id, index)}
                  className={`w-full p-4 text-left border-2 rounded-lg transition-all ${
                    answers[currentQuestion.id] === index || answers[currentQuestion.id] === String(index)
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      answers[currentQuestion.id] === index || answers[currentQuestion.id] === String(index)
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-300'
                    }`}>
                      {(answers[currentQuestion.id] === index || answers[currentQuestion.id] === String(index)) && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <span>{choice}</span>
                  </div>
                </button>
              ))
            ) : (
              <textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:ring-2 focus:ring-primary-500"
                rows={4}
                placeholder={t('enterYourAnswer')}
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {t('previous')}
        </button>

        <div className="flex gap-2">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentQuestionIndex(index)}
              className={`w-8 h-8 rounded-full text-sm transition-colors ${
                index === currentQuestionIndex
                  ? 'bg-primary-600 text-white'
                  : answers[questions[index].id]
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {currentQuestionIndex === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Trophy size={20} />
            {t('submitQuiz')}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {t('next')}
          </button>
        )}
      </div>
    </div>
  );
}
