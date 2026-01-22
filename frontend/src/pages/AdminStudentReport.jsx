import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, AlertTriangle, CheckCircle, Clock, FileText, BookOpen, User, Mail, Phone, MapPin, GraduationCap, Award } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function AdminStudentReport() {
  const { t } = useTranslation();
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['studentReport', studentId],
    queryFn: () => api.getStudentReport(studentId),
  });

  const report = data?.data || {};
  const { profile, enrollments = [], timeline = [], email, name, phone } = report;

  const handleDownloadPDF = async () => {
    try {
      await api.downloadStudentReportPDF(studentId);
      addToast(t('pdfDownloaded'), 'success');
    } catch (error) {
      addToast(t('pdfDownloadFailed'), 'error');
    }
  };

  const getAlertInfo = (alert) => {
    switch (alert) {
      case 'HIGH_ABSENCE':
        return {
          color: 'text-red-700 bg-red-50 border-red-200',
          icon: '⚠️',
          label: t('highAbsence') || 'غياب عالي',
          description: t('highAbsenceDesc') || 'نسبة الحضور منخفضة'
        };
      case 'MISSING_ASSIGNMENTS':
        return {
          color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
          icon: '📝',
          label: t('missingAssignments') || 'واجبات مفقودة',
          description: t('missingAssignmentsDesc') || 'واجبات غير مكتملة'
        };
      case 'LOW_EXAMS':
        return {
          color: 'text-orange-700 bg-orange-50 border-orange-200',
          icon: '📊',
          label: t('lowExams') || 'نتائج منخفضة',
          description: t('lowExamsDesc') || 'نتائج الاختبارات منخفضة'
        };
      case 'NO_ACTIVITY_14_DAYS':
        return {
          color: 'text-gray-700 bg-gray-50 border-gray-200',
          icon: '⏰',
          label: t('noActivity') || 'لا يوجد نشاط',
          description: t('noActivityDesc') || 'لا يوجد نشاط خلال 14 يوم'
        };
      default:
        return {
          color: 'text-gray-700 bg-gray-50 border-gray-200',
          icon: 'ℹ️',
          label: alert,
          description: ''
        };
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">{t('loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-600" size={32} />
          </div>
          <p className="text-red-800 font-bold text-lg mb-2">{t('error')}</p>
          <p className="text-red-600 mb-4">{error?.message || 'Failed to load student report'}</p>
          <button onClick={() => navigate('/admin/students')} className="btn-primary">
            {t('back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate('/admin/students')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">{t('back')}</span>
        </motion.button>

        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition shadow-sm"
        >
          <Download size={16} />
          {t('downloadPDF')}
        </button>
      </div>

      {/* Student Name */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-gray-900 mb-4"
      >
        {t('studentReport')}: {profile?.fullName4 || profile?.email || 'N/A'}
      </motion.h1>

      {/* Profile Overview - Beautiful Design */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-5 mb-4 bg-gradient-to-br from-white to-gray-50 border border-gray-200 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="p-2 bg-primary-100 rounded-lg">
            <User size={18} className="text-primary-600" />
          </div>
          {t('profileOverview')}
        </h2>
        
        <div className="space-y-4">
          {/* Contact Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {email && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Mail size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-blue-600 font-medium mb-0.5">{t('email')}</div>
                  <div className="text-sm font-semibold text-gray-900 truncate">{email}</div>
                </div>
              </div>
            )}
            
            {(phone || profile?.phone) && (
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Phone size={16} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-green-600 font-medium mb-0.5">{t('phone')}</div>
                  <div className="text-sm font-semibold text-gray-900">{phone || profile?.phone}</div>
                </div>
              </div>
            )}
          </div>

          {/* Location Row */}
          {(profile?.country || profile?.city) && (
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors">
              <div className="p-2 bg-purple-100 rounded-lg">
                <MapPin size={16} className="text-purple-600" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-purple-600 font-medium mb-0.5">{t('location') || 'Location'}</div>
                <div className="text-sm font-semibold text-gray-900">
                  {profile.city && profile.country ? `${profile.city}, ${profile.country}` : (profile.city || profile.country || '-')}
                </div>
              </div>
            </div>
          )}

          {/* Education Row */}
          {(profile?.isStudent && (profile?.university || profile?.major)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile?.university && (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <GraduationCap size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-indigo-600 font-medium mb-0.5">{t('university')}</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">{profile.university}</div>
                  </div>
                </div>
              )}
              
              {profile?.major && (
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Award size={16} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-orange-600 font-medium mb-0.5">{t('major')}</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">{profile.major}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Skills Row - Beautiful Tags */}
          {profile?.skills && Array.isArray(profile.skills) && profile.skills.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-primary-200 rounded-lg">
                  <Award size={14} className="text-primary-700" />
                </div>
                <div className="text-xs text-primary-700 font-semibold">{t('skills')}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 bg-white text-gray-800 text-xs font-medium rounded-full border border-primary-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Course Performance - Compact Cards */}
      {enrollments.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-gray-500">{t('noEnrollments') || 'No enrollments found'}</p>
        </div>
      ) : (
        enrollments.map((enrollment, idx) => {
          const { course, attendanceSummary, assignmentSummary, examsSummary, metrics } = enrollment;
          const attendanceRate = ((metrics?.attendanceRate || attendanceSummary?.rate || 0) * 100).toFixed(1);
          const assignmentRate = ((metrics?.assignmentCompletionRate || 0) * 100).toFixed(1);
          const avgScore = (examsSummary?.avgScore || 0).toFixed(1);
          // Ensure overallScore is between 0 and 100
          let overallScore = metrics?.overallScore || 0;
          // If score is greater than 100, it might be a percentage already multiplied, so divide by 100
          if (overallScore > 100) {
            overallScore = overallScore / 100;
          }
          // Ensure it's between 0 and 100
          overallScore = Math.max(0, Math.min(100, overallScore));
          overallScore = Math.round(overallScore);

          return (
            <motion.div
              key={course?.id || idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="card p-4 mb-4"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-3">{course?.title || 'Unknown Course'}</h2>

              {/* Compact Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {/* Attendance */}
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-xs text-blue-600 mb-1">{t('attendance')}</div>
                  <div className="text-xl font-bold text-blue-700">{attendanceSummary?.present || 0}/{attendanceSummary?.total || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">{attendanceRate}%</div>
                </div>

                {/* Assignments */}
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-xs text-green-600 mb-1">{t('assignments')}</div>
                  <div className="text-xl font-bold text-green-700">{assignmentSummary?.submitted || 0}/{assignmentSummary?.total || 0}</div>
                  <div className="text-xs text-gray-600 mt-1">{assignmentRate}%</div>
                </div>

                {/* Exams/Quizzes */}
                <div className="bg-purple-50 rounded-lg p-3">
                  <div className="text-xs text-purple-600 mb-1">{t('examsQuizzes')}</div>
                  <div className="text-xl font-bold text-purple-700">{(examsSummary?.quizAttempts || 0) + (examsSummary?.examAttempts || 0)}</div>
                  <div className="text-xs text-gray-600 mt-1">{avgScore}/10</div>
                </div>

                {/* Overall Score */}
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-3">
                  <div className="text-xs text-primary-700 mb-1">{t('overallScore')}</div>
                  <div className="text-2xl font-bold text-primary-700">{overallScore}</div>
                  <div className="text-xs text-gray-600 mt-1">/100</div>
                </div>
              </div>

              {/* Detailed Breakdown - Smaller */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('present')}:</span>
                  <span className="font-medium">{attendanceSummary?.present || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('absent')}:</span>
                  <span className="font-medium">{attendanceSummary?.absent || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('late')}:</span>
                  <span className="font-medium">{attendanceSummary?.late || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('approved')}:</span>
                  <span className="font-medium">{assignmentSummary?.approved || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('needsChanges')}:</span>
                  <span className="font-medium">{assignmentSummary?.needsChanges || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('quizAttempts')}:</span>
                  <span className="font-medium">{examsSummary?.quizAttempts || 0}</span>
                </div>
              </div>

              {/* Alerts & Recommendations - Beautiful Design */}
              {(metrics?.alerts?.length > 0 || metrics?.recommendations?.length > 0) && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  {metrics?.alerts && metrics.alerts.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-red-100 rounded-lg">
                          <AlertTriangle className="text-red-600" size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">{t('alerts')}</h3>
                      </div>
                      <div className="space-y-2">
                        {metrics.alerts.map((alert, idx) => {
                          const alertInfo = getAlertInfo(alert);
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={`flex items-start gap-3 p-3 rounded-lg border-2 ${alertInfo.color} hover:shadow-md transition-all`}
                            >
                              <div className="text-xl flex-shrink-0">{alertInfo.icon}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm mb-0.5">{alertInfo.label}</div>
                                {alertInfo.description && (
                                  <div className="text-xs opacity-75">{alertInfo.description}</div>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {metrics?.recommendations && metrics.recommendations.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-green-100 rounded-lg">
                          <CheckCircle className="text-green-600" size={16} />
                        </div>
                        <h3 className="text-sm font-bold text-gray-900">{t('recommendations')}</h3>
                      </div>
                      <div className="space-y-2">
                        {metrics.recommendations.map((rec, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: (metrics?.alerts?.length || 0) * 0.1 + idx * 0.1 }}
                            className="flex items-start gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 hover:shadow-md transition-all"
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                                <CheckCircle className="text-white" size={12} />
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-gray-800 leading-relaxed">{rec}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          );
        })
      )}

      {/* Timeline - Compact */}
      {timeline.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: enrollments.length * 0.05 }}
          className="card p-4"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('recentActivity')}</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {timeline.slice(0, 15).map((event, idx) => {
              let icon, color, title;
              if (event.type === 'attendance') {
                icon = Clock;
                color = 'text-blue-600';
                title = `${t('attendance')}: ${t(event.data?.status?.toLowerCase() || 'unknown')}`;
              } else if (event.type === 'submission') {
                icon = FileText;
                color = 'text-green-600';
                title = `${t('submission')}: ${event.data?.assignment?.title || 'N/A'}`;
              } else if (event.type === 'quiz') {
                icon = BookOpen;
                color = 'text-purple-600';
                title = `${t('quiz')}: ${event.data?.quiz?.title || 'N/A'}`;
              } else if (event.type === 'exam') {
                icon = BookOpen;
                color = 'text-indigo-600';
                title = `${t('exam')}: ${event.data?.exam?.title || 'N/A'}`;
              }
              const Icon = icon || Clock;
              
              return (
                <div key={idx} className="flex items-start gap-2 p-2 border border-gray-200 rounded text-sm hover:bg-gray-50 transition-colors">
                  <Icon className={`${color} flex-shrink-0 mt-0.5`} size={16} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{title}</div>
                    <div className="text-xs text-gray-500">{new Date(event.date).toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
