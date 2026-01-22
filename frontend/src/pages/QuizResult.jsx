import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { ArrowLeft, Trophy, TrendingUp, CheckCircle, XCircle } from 'lucide-react';

export default function QuizResult() {
  const { t } = useTranslation();
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => {
      // We need to get the attempt details - for now, we'll get it from quiz
      // In a real implementation, you'd have an endpoint for this
      return Promise.resolve({});
    },
  });

  // For now, we'll show a placeholder
  // In production, you'd fetch the attempt result and evaluation

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        {t('back')}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-8 shadow-sm border border-gray-200 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <Trophy size={40} className="text-primary-600" />
        </motion.div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('quizSubmitted')}</h1>
        <p className="text-gray-600 mb-6">{t('yourResultsWillBeAvailableSoon')}</p>

        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600">{t('checkYourEvaluationsForDetailedResults')}</p>
        </div>
      </motion.div>
    </div>
  );
}
