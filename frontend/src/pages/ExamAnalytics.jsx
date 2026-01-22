import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';

export default function ExamAnalytics() {
  const { t } = useTranslation();
  const { sessionId, courseId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['examAnalytics', sessionId || courseId],
    queryFn: () => {
      if (sessionId) {
        return api.getSessionExamAnalytics(sessionId);
      } else if (courseId) {
        return api.getCourseExamAnalytics(courseId);
      }
    },
    enabled: !!(sessionId || courseId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  const analytics = data?.analytics || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">{t('examAnalytics')}</h1>
        </div>

        {analytics.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600">{t('noData') || 'No data available'}</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-md overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-right text-sm font-semibold">{t('name')}</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">{t('preExamScore')}</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">{t('postExamScore')}</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold">{t('examImprovement')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.map((item, idx) => (
                    <motion.tr
                      key={item.student.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium">{item.student.name}</div>
                          <div className="text-sm text-gray-500">{item.student.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.preScore !== null ? (
                          <span className="font-semibold">{item.preScore.toFixed(1)}/10</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.postScore !== null ? (
                          <span className="font-semibold">{item.postScore.toFixed(1)}/10</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {item.improvement !== null ? (
                          <div className="flex items-center justify-center gap-2">
                            {item.improvement > 0 ? (
                              <>
                                <TrendingUp className="w-4 h-4 text-green-600" />
                                <span className="font-semibold text-green-600">
                                  +{item.improvement.toFixed(1)}
                                </span>
                              </>
                            ) : item.improvement < 0 ? (
                              <>
                                <TrendingDown className="w-4 h-4 text-red-600" />
                                <span className="font-semibold text-red-600">
                                  {item.improvement.toFixed(1)}
                                </span>
                              </>
                            ) : (
                              <span className="font-semibold text-gray-600">0</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
