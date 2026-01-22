import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { ArrowLeft, Download, TrendingUp, TrendingDown, Award } from 'lucide-react';

export default function QuizAnalytics() {
  const { t } = useTranslation();
  const { sessionId, courseId } = useParams();
  const navigate = useNavigate();

  const { data: evaluationsData, isLoading } = useQuery({
    queryKey: ['evaluations', sessionId || courseId],
    queryFn: () => {
      if (sessionId) {
        return api.getSessionEvaluations(sessionId);
      } else if (courseId) {
        return api.getCourseEvaluations(courseId);
      }
      return Promise.resolve({ evaluations: [] });
    },
  });

  const evaluations = evaluationsData?.evaluations || [];

  const handleExport = () => {
    if (sessionId) {
      api.exportSessionEvaluations(sessionId);
    } else if (courseId) {
      api.exportCourseEvaluations(courseId);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
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
        className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('quizAnalytics')}</h1>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download size={20} />
            {t('exportEvaluations')}
          </button>
        </div>

        {evaluations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {t('noEvaluations')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('name')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('prePercent')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('postPercent')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('improvementPercent')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('strengths')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">{t('weaknesses')}</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((evaluation) => (
                  <motion.tr
                    key={evaluation.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <div>
                            <div className="font-medium text-gray-900">{evaluation.student.name}</div>
                            <div className="text-sm text-gray-500">{evaluation.student.email}</div>
                          </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-900">{evaluation.prePercent.toFixed(1)}%</span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-gray-900">{evaluation.postPercent.toFixed(1)}%</span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {evaluation.improvementPercent > 0 ? (
                          <TrendingUp className="text-green-600" size={20} />
                        ) : evaluation.improvementPercent < 0 ? (
                          <TrendingDown className="text-red-600" size={20} />
                        ) : null}
                        <span className={evaluation.improvementPercent > 0 ? 'text-green-600' : evaluation.improvementPercent < 0 ? 'text-red-600' : 'text-gray-600'}>
                          {evaluation.improvementPercent > 0 ? '+' : ''}{evaluation.improvementPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {Array.isArray(evaluation.strengths) && evaluation.strengths.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {evaluation.strengths.map((tag, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {Array.isArray(evaluation.weaknesses) && evaluation.weaknesses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {evaluation.weaknesses.map((tag, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
