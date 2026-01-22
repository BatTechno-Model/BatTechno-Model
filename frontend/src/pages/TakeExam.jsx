import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Clock, CheckCircle } from 'lucide-react';

export default function TakeExam() {
  const { t } = useTranslation();
  const { examId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attempt, setAttempt] = useState(null);

  // Start attempt
  const { mutate: startAttempt, isPending: isStarting } = useMutation({
    mutationFn: () => api.startExamAttempt(examId),
    onSuccess: (response) => {
      setAttempt(response.attempt);
      if (response.attempt.exam.timeLimitMinutes) {
        setTimeRemaining(response.attempt.exam.timeLimitMinutes * 60);
      }
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
      navigate(-1);
    },
  });

  useEffect(() => {
    startAttempt();
  }, []);

  const questions = attempt?.exam?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Auto-save answers
  const { mutate: saveAnswer } = useMutation({
    mutationFn: ({ questionId, answer }) => api.submitExamAnswer(attempt.id, questionId, answer),
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

  const handleSubmit = useCallback(() => {
    if (isSubmitting || !attempt) return;
    setIsSubmitting(true);

    api.submitExamAttempt(attempt.id)
      .then((response) => {
        queryClient.invalidateQueries(['myExams']);
        navigate(`/exam-result/${response.attempt.id}`);
      })
      .catch((error) => {
        addToast(error.message || t('error'), 'error');
        setIsSubmitting(false);
      });
  }, [isSubmitting, attempt, queryClient, navigate, addToast, t]);

  // Timer effect
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0 || !attempt) return;

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
  }, [timeRemaining, attempt, handleSubmit]);

  if (isStarting || !attempt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                const message = t('confirmSubmit') || 'Are you sure you want to leave?';
                if (confirm(message)) {
                  navigate(-1);
                }
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">{attempt.exam.title}</h1>
            <div className="w-12" />
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>{t('questionNumber')} {currentQuestionIndex + 1} {t('of')} {questions.length}</span>
              {timeRemaining !== null && (
                <div className="flex items-center gap-2 text-red-600">
                  <Clock className="w-4 h-4" />
                  <span>{formatTime(timeRemaining)}</span>
                </div>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                className="bg-blue-600 h-2 rounded-full"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Question */}
      {currentQuestion && (
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="max-w-4xl mx-auto px-4 py-6"
        >
          <div className="bg-white rounded-lg shadow-md p-6 mb-4">
            <h2 className="text-xl font-bold mb-4">{currentQuestion.prompt}</h2>

            {currentQuestion.questionType === 'MCQ' && currentQuestion.choices && (
              <div className="space-y-3">
                {currentQuestion.choices.map((choice, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      answers[currentQuestion.id] === idx
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      checked={answers[currentQuestion.id] === idx}
                      onChange={() => handleAnswerChange(currentQuestion.id, idx)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <span className="flex-1">{choice}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.questionType === 'TRUE_FALSE' && (
              <div className="space-y-3">
                {[true, false].map((value) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      answers[currentQuestion.id] === value
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      checked={answers[currentQuestion.id] === value}
                      onChange={() => handleAnswerChange(currentQuestion.id, value)}
                      className="w-5 h-5 text-blue-600"
                    />
                    <span className="flex-1">{value ? 'True' : 'False'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('previous')}
            </button>

            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {isSubmitting ? t('loading') : t('submitExam')}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('next')}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
