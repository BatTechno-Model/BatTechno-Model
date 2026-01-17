import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, CheckCircle, XCircle, Download } from 'lucide-react';

export default function ReviewSubmission() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['submission', id],
    queryFn: () => api.getSubmission(id),
  });

  const submission = data?.submission;

  // Update score and feedback when submission loads
  useEffect(() => {
    if (submission) {
      const latestReview = submission.reviews?.[0];
      if (latestReview) {
        setScore(latestReview.score?.toString() || '');
        setFeedback(latestReview.feedback || '');
      } else if (submission.note) {
        // Load note from submission if no review exists
        setFeedback(submission.note);
      }
    }
  }, [submission]);

  // Mutation for updating submission status
  const { mutate: updateStatus, isPending: isUpdatingStatus } = useMutation({
    mutationFn: ({ status, note }) => api.updateSubmissionStatus(id, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries(['submission', id]);
      queryClient.invalidateQueries(['submissions']);
      addToast(t('statusUpdated'), 'success');
    },
    onError: (error) => {
      console.error('Update status error:', error);
      addToast(error.message || t('error'), 'error');
    },
  });

  // Mutation for creating/updating review
  const { mutate: createReview, isPending: isCreatingReview } = useMutation({
    mutationFn: (data) => api.createReview(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['submission', id]);
      queryClient.invalidateQueries(['submissions']);
      addToast(t('reviewSaved'), 'success');
    },
    onError: (error) => {
      console.error('Create review error:', error);
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleApprove = () => {
    if (!feedback.trim()) {
      addToast(t('pleaseAddFeedback'), 'warning');
      return;
    }
    updateStatus({ status: 'APPROVED', note: feedback });
  };

  const handleNeedsChanges = () => {
    if (!feedback.trim()) {
      addToast(t('pleaseAddFeedback'), 'warning');
      return;
    }
    updateStatus({ status: 'NEEDS_CHANGES', note: feedback });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!score && !feedback.trim()) {
      addToast(t('pleaseAddScoreOrFeedback'), 'warning');
      return;
    }
    createReview({
      submissionId: id,
      score: score ? parseInt(score) : null,
      feedback,
    });
  };

  const isPending = isUpdatingStatus || isCreatingReview;

  if (isLoading) {
    return <div>{t('loading')}</div>;
  }

  if (!submission) {
    return <div>{t('error')}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft size={20} />
        {t('back')}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 space-y-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('review')}</h1>
          <p className="text-gray-600">{submission.student.name} - {submission.assignment.title}</p>
        </div>

        {submission.note && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">{t('note')}</h3>
            <p className="text-gray-600">{submission.note}</p>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-gray-900 mb-2">{t('submission')}</h3>
          <div className="space-y-2">
            {submission.assets?.map((asset) => (
              <a
                key={asset.id}
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                {asset.type === 'FILE' ? <Download size={20} /> : <CheckCircle size={20} />}
                <span className="text-primary-600">{asset.name}</span>
              </a>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('score')} (0-{submission.assignment.maxScore})
            </label>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              min="0"
              max={submission.assignment.maxScore}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('feedback')}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-4">
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleNeedsChanges}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle size={20} />
              {t('needsChanges')}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleApprove}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle size={20} />
              {t('approved')}
            </motion.button>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isPending}
            className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
          >
            {t('save')}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
