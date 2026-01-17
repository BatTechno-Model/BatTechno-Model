import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { CheckCircle, XCircle, Clock, Calendar, BookOpen } from 'lucide-react';

export default function Attendance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.getCourses(),
  });

  const courses = coursesData?.courses || [];

  // Fetch attendance summary for all courses
  const { data: attendanceSummariesData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance-summaries', user?.id],
    queryFn: async () => {
      if (courses.length === 0) {
        return [];
      }
      const summariesPromises = courses.map((course) =>
        api.getAttendanceSummary(user.id, course.id).catch(() => null)
      );
      const results = await Promise.all(summariesPromises);
      return results.filter(r => r !== null).map((result, index) => ({
        ...result,
        course: courses[index],
      }));
    },
    enabled: courses.length > 0,
  });

  const isLoading = coursesLoading || attendanceLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" count={3} />
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center"
        >
          <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('noCourses')}</h2>
          <p className="text-gray-600">{t('notEnrolledInAnyCourse')}</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('attendance')}</h1>
        <p className="text-gray-600">{t('attendanceReport')}</p>
      </motion.div>

      <div className="space-y-4">
        {attendanceSummariesData && attendanceSummariesData.length > 0 ? (
          attendanceSummariesData.map((item, index) => {
            const summary = item?.summary;
            const course = item?.course;
            
            if (!summary || !course) return null;

            const attendanceRate = summary.totalSessions > 0 
              ? Math.round((summary.presentCount / summary.totalSessions) * 100) 
              : 0;

            return (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => navigate(`/courses/${course.id}`)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900 mb-1">{course.title}</h2>
                    <p className="text-sm text-gray-600">
                      {summary.totalSessions} {t('sessions')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary-600">{attendanceRate}%</div>
                    <div className="text-xs text-gray-500">{t('attendanceRate')}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="text-green-600" size={16} />
                      <span className="text-xs text-gray-600">{t('present')}</span>
                    </div>
                    <div className="text-xl font-bold text-green-600">{summary.presentCount}</div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className="text-red-600" size={16} />
                      <span className="text-xs text-gray-600">{t('absent')}</span>
                    </div>
                    <div className="text-xl font-bold text-red-600">{summary.absentCount}</div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="text-yellow-600" size={16} />
                      <span className="text-xs text-gray-600">{t('late')}</span>
                    </div>
                    <div className="text-xl font-bold text-yellow-600">{summary.lateCount || 0}</div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="text-blue-600" size={16} />
                      <span className="text-xs text-gray-600">{t('excused')}</span>
                    </div>
                    <div className="text-xl font-bold text-blue-600">{summary.excusedCount || 0}</div>
                  </div>
                </div>

                {item.sessions && item.sessions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('sessions')}</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {item.sessions.slice(0, 5).map((session) => {
                        const statusColors = {
                          PRESENT: 'bg-green-100 text-green-700 border-green-200',
                          ABSENT: 'bg-red-100 text-red-700 border-red-200',
                          LATE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
                          EXCUSED: 'bg-blue-100 text-blue-700 border-blue-200',
                        };
                        
                        return (
                          <div
                            key={session.id}
                            className={`flex items-center justify-between p-2 rounded-lg border text-sm ${statusColors[session.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                          >
                            <div className="flex-1">
                              <span className="font-medium">{session.topic || t('session')}</span>
                              <span className="text-xs ml-2 opacity-75">
                                {new Date(session.date).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="text-xs font-semibold">{t(session.status.toLowerCase())}</span>
                          </div>
                        );
                      })}
                      {item.sessions.length > 5 && (
                        <p className="text-xs text-gray-500 text-center pt-2">
                          +{item.sessions.length - 5} {t('more')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center"
          >
            <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('noSessions')}</h2>
            <p className="text-gray-600">{t('noAttendanceData')}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
