import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { CheckCircle, XCircle, Clock, Calendar, BookOpen, Users } from 'lucide-react';
import { getImageUrl } from '../utils/api';

// Helper to get initials from name
function getInitials(name) {
  if (!name) return 'U';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export default function Attendance() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.getCourses(),
  });

  const courses = coursesData?.courses || [];

  // Fetch attendance summary for all courses (for students)
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
    enabled: courses.length > 0 && !isAdmin,
  });

  // Fetch all students attendance summary (for admin)
  const { data: studentsAttendanceData, isLoading: studentsAttendanceLoading } = useQuery({
    queryKey: ['all-students-attendance'],
    queryFn: () => api.getAllStudentsAttendanceSummary(),
    enabled: isAdmin,
  });

  const studentsAttendance = studentsAttendanceData?.summaries || [];

  const isLoading = coursesLoading || (isAdmin ? studentsAttendanceLoading : attendanceLoading);

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

  if (!isAdmin && courses.length === 0) {
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
    <div className={isAdmin ? 'max-w-7xl mx-auto px-3 py-3' : 'max-w-4xl mx-auto px-4 py-6'}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3"
      >
        <h1 className={`${isAdmin ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 mb-1`}>
          {isAdmin ? t('studentsAttendance') || 'حضور الطلاب' : t('attendance')}
        </h1>
        {isAdmin && (
          <p className="text-xs text-gray-500">
            {studentsAttendance.length} {t('students') || 'طالب'}
          </p>
        )}
        {!isAdmin && (
          <p className="text-sm text-gray-500">
            {t('attendanceReport')}
          </p>
        )}
      </motion.div>

      <div className="space-y-4">
        {isAdmin ? (
          // Admin view: Show all students attendance in compact grid
          studentsAttendance.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
              {studentsAttendance.map((studentSummary, index) => {
                const student = studentSummary.student;
                const summary = studentSummary.summary || {
                  totalSessions: studentSummary.totalSessions || 0,
                  presentCount: studentSummary.presentCount || 0,
                  absentCount: studentSummary.absentCount || 0,
                  lateCount: studentSummary.lateCount || 0,
                  excusedCount: studentSummary.excusedCount || 0,
                };
                
                const attendanceRate = summary.totalSessions > 0 
                  ? Math.round((summary.presentCount / summary.totalSessions) * 100) 
                  : 0;

                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.01 }}
                    onClick={() => navigate(`/admin/students/${student.id}/report`)}
                    className="bg-white rounded-lg p-2 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 cursor-pointer transition-all duration-200 group"
                  >
                    <div className="flex flex-col items-center text-center">
                      {student?.profile?.avatar ? (
                        <div className="relative mb-1.5">
                          <img
                            src={getImageUrl(student.profile.avatar)}
                            alt={student.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-primary-200 group-hover:border-primary-400 transition-colors"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallback = e.target.nextElementSibling;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm hidden">
                            {getInitials(student.name)}
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm mb-1.5">
                          {getInitials(student.name)}
                        </div>
                      )}
                      
                      <h3 className="text-xs font-semibold text-gray-900 truncate w-full px-1 mb-1 group-hover:text-primary-600 transition-colors">
                        {student.name}
                      </h3>
                      
                      <div className={`text-sm font-bold ${
                        attendanceRate >= 80 ? 'text-green-600' :
                        attendanceRate >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {attendanceRate}%
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center"
            >
              <Users className="mx-auto text-gray-400 mb-4" size={48} />
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('noStudents')}</h2>
              <p className="text-gray-600">{t('noAttendanceData')}</p>
            </motion.div>
          )
        ) : (
          // Student view: Show their own attendance - beautiful display only
          attendanceSummariesData && attendanceSummariesData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attendanceSummariesData.map((item, index) => {
                const summary = item?.summary;
                const course = item?.course;
                
                if (!summary || !course) return null;

                const attendanceRate = summary.totalSessions > 0 
                  ? Math.round((summary.presentCount / summary.totalSessions) * 100) 
                  : 0;

                const getRateColor = () => {
                  if (attendanceRate >= 80) return 'from-green-500 to-emerald-600';
                  if (attendanceRate >= 60) return 'from-yellow-500 to-amber-600';
                  return 'from-red-500 to-rose-600';
                };

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden group"
                  >
                    {/* Decorative gradient overlay */}
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${getRateColor()} opacity-10 rounded-full blur-3xl`}></div>
                    
                    <div className="relative p-5">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h2 className="text-lg font-bold text-gray-900 mb-1">{course.title}</h2>
                          <p className="text-sm text-gray-500">
                            {summary.totalSessions} {t('sessions')}
                          </p>
                        </div>
                        <div className={`flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${getRateColor()} text-white shadow-lg`}>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{attendanceRate}</div>
                            <div className="text-xs opacity-90">%</div>
                          </div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-4 gap-2">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200 text-center">
                          <CheckCircle className="text-green-600 mx-auto mb-1" size={20} />
                          <div className="text-lg font-bold text-green-600">{summary.presentCount}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{t('present')}</div>
                        </div>

                        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-3 border border-red-200 text-center">
                          <XCircle className="text-red-600 mx-auto mb-1" size={20} />
                          <div className="text-lg font-bold text-red-600">{summary.absentCount}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{t('absent')}</div>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-3 border border-yellow-200 text-center">
                          <Clock className="text-yellow-600 mx-auto mb-1" size={20} />
                          <div className="text-lg font-bold text-yellow-600">{summary.lateCount || 0}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{t('late')}</div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-200 text-center">
                          <Calendar className="text-blue-600 mx-auto mb-1" size={20} />
                          <div className="text-lg font-bold text-blue-600">{summary.excusedCount || 0}</div>
                          <div className="text-[10px] text-gray-600 mt-0.5">{t('excused')}</div>
                        </div>
                      </div>

                      {/* Sessions List */}
                      {item.sessions && item.sessions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Calendar size={16} className="text-primary-600" />
                            {t('sessions')}
                          </h3>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {item.sessions.slice(0, 5).map((session) => {
                              const statusConfig = {
                                PRESENT: { 
                                  bg: 'bg-gradient-to-r from-green-50 to-emerald-50', 
                                  text: 'text-green-700', 
                                  border: 'border-green-200',
                                  icon: CheckCircle,
                                  iconColor: 'text-green-600'
                                },
                                ABSENT: { 
                                  bg: 'bg-gradient-to-r from-red-50 to-rose-50', 
                                  text: 'text-red-700', 
                                  border: 'border-red-200',
                                  icon: XCircle,
                                  iconColor: 'text-red-600'
                                },
                                LATE: { 
                                  bg: 'bg-gradient-to-r from-yellow-50 to-amber-50', 
                                  text: 'text-yellow-700', 
                                  border: 'border-yellow-200',
                                  icon: Clock,
                                  iconColor: 'text-yellow-600'
                                },
                                EXCUSED: { 
                                  bg: 'bg-gradient-to-r from-blue-50 to-cyan-50', 
                                  text: 'text-blue-700', 
                                  border: 'border-blue-200',
                                  icon: Calendar,
                                  iconColor: 'text-blue-600'
                                },
                              };
                              
                              const config = statusConfig[session.status] || {
                                bg: 'bg-gray-50',
                                text: 'text-gray-700',
                                border: 'border-gray-200',
                                icon: Calendar,
                                iconColor: 'text-gray-600'
                              };
                              const Icon = config.icon;
                              
                              return (
                                <div
                                  key={session.id}
                                  className={`flex items-center justify-between p-2.5 rounded-lg border ${config.bg} ${config.border} ${config.text}`}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <Icon className={config.iconColor} size={16} />
                                    <div>
                                      <span className="font-medium text-sm">{session.topic || t('session')}</span>
                                      <span className="text-xs ml-2 opacity-75">
                                        {new Date(session.date).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/50">
                                    {t(session.status.toLowerCase())}
                                  </span>
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
                    </div>
                  </motion.div>
                );
              })}
            </div>
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
          )
        )}
      </div>
    </div>
  );
}
