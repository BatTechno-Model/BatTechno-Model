import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Save } from 'lucide-react';

export default function SubmitAssignment() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');

  const { mutate: submitAssignment, isPending } = useMutation({
    mutationFn: (data) => {
      if (!id) {
        throw new Error('Assignment ID is required');
      }
      return api.createSubmission(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment', id]);
      queryClient.invalidateQueries(['submissions', id]);
      addToast(t('success'), 'success');
      navigate(`/assignments/${id}`);
    },
    onError: (error) => {
      console.error('Submit assignment error:', error);
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!note || note.trim().length === 0) {
      addToast(t('submissionTextRequired') || 'Submission text is required', 'error');
      return;
    }
    submitAssignment({ note: note.trim() });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
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
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('submitAssignment')}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('submissionText') || 'Submission Text'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('enterSubmissionText') || 'Enter your assignment submission here...'}
              required
            />
            <p className="mt-2 text-sm text-gray-500">
              {t('textOnlySubmission') || 'Please write your assignment submission in the text area above.'}
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
          >
            <Save size={20} />
            {t('submit')}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
