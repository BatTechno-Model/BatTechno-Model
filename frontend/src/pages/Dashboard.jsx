import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { BookOpen, Calendar, FileText, TrendingUp, ChevronRight, Clock, Users, CheckCircle, XCircle, User, Mail, Phone, X, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: () => api.getCourses(),
  });

  const courses = coursesData?.courses || [];

  // Fetch sessions for all courses
  const { data: sessionsData } = useQuery({
    queryKey: ['all-sessions'],
    queryFn: async () => {
      const sessionsPromises = courses.map((course) => api.getSessions(course.id));
      const results = await Promise.all(sessionsPromises);
      return results.flatMap((r) => r.sessions || []);
    },
    enabled: courses.length > 0,
  });

  const allSessions = sessionsData || [];

  // Get today's sessions
  const todaySessions = allSessions.filter((s) => {
    const sessionDate = new Date(s.date);
    const today = new Date();
    return sessionDate.toDateString() === today.toDateString();
  });

  // Fetch assignments for all courses
  const { data: assignmentsData } = useQuery({
    queryKey: ['all-assignments'],
    queryFn: async () => {
      const assignmentsPromises = courses.map((course) => api.getAssignments(course.id));
      const results = await Promise.all(assignmentsPromises);
      return results.flatMap((r) => r.assignments || []);
    },
    enabled: courses.length > 0,
  });

  const allAssignments = assignmentsData || [];

  // Get pending assignments
  const pendingAssignments = allAssignments.filter((a) => {
    if (user?.role === 'STUDENT') {
      return a.isPublished && !a.mySubmission;
    }
    return !a.isPublished;
  });

  // Fetch attendance summary for all courses (for students only)
  const { data: attendanceSummariesData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance-summaries', user?.id],
    queryFn: async () => {
      if (user?.role !== 'STUDENT' || courses.length === 0) {
        return [];
      }
      const summariesPromises = courses.map((course) =>
        api.getAttendanceSummary(user.id, course.id).catch(() => null)
      );
      const results = await Promise.all(summariesPromises);
      return results.filter(r => r !== null);
    },
    enabled: user?.role === 'STUDENT' && courses.length > 0,
  });

  // Calculate total attendance stats for students
  const attendanceStats = useMemo(() => {
    if (user?.role !== 'STUDENT' || !attendanceSummariesData) {
      return { presentCount: 0, absentCount: 0, totalSessions: 0, attendanceRate: 0 };
    }
    
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalSessions = 0;
    
    attendanceSummariesData.forEach((summaryData) => {
      const summary = summaryData?.summary;
      if (summary) {
        totalPresent += summary.presentCount || 0;
        totalAbsent += summary.absentCount || 0;
        totalSessions += summary.totalSessions || 0;
      }
    });
    
    const attendanceRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;
    
    return {
      presentCount: totalPresent,
      absentCount: totalAbsent,
      totalSessions,
      attendanceRate,
    };
  }, [attendanceSummariesData, user?.role]);

  // Fetch all students attendance summary (for admin only)
  const { data: studentsAttendanceData, isLoading: studentsAttendanceLoading } = useQuery({
    queryKey: ['all-students-attendance'],
    queryFn: () => api.getAllStudentsAttendanceSummary(),
    enabled: user?.role === 'ADMIN',
  });

  const studentsAttendance = studentsAttendanceData?.summaries || [];

  // Fetch students count (for admin/instructor only)
  const { data: studentsData } = useQuery({
    queryKey: ['students-count'],
    queryFn: () => api.getUsers({ role: 'STUDENT' }),
    enabled: user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR',
  });

  const studentsCount = studentsData?.users?.length || 0;

  // Fetch available quizzes for students
  const { data: quizzesData } = useQuery({
    queryKey: ['my-quizzes'],
    queryFn: () => api.getMyQuizzes(),
    enabled: user?.role === 'STUDENT',
  });

  const availableQuizzes = quizzesData?.quizzes || [];

  // Fetch available exams for students
  const { data: examsData } = useQuery({
    queryKey: ['my-exams'],
    queryFn: () => api.getMyExams(),
    enabled: user?.role === 'STUDENT',
  });

  const availableExams = examsData?.exams || [];

  // Calculate overall attendance rate for admin/instructor
  const overallAttendanceRate = useMemo(() => {
    if (user?.role !== 'ADMIN' && user?.role !== 'INSTRUCTOR') {
      return 0;
    }
    
    if (studentsAttendance.length === 0) {
      return 0;
    }
    
    // Calculate average attendance rate across all students
    const totalRate = studentsAttendance.reduce((sum, item) => sum + (item.summary?.attendanceRate || 0), 0);
    const averageRate = Math.round(totalRate / studentsAttendance.length);
    
    return averageRate;
  }, [studentsAttendance, user?.role]);

  // Fetch detailed attendance and assignments for selected student
  const { data: studentDetailsData, isLoading: studentDetailsLoading } = useQuery({
    queryKey: ['student-details', selectedStudent?.id],
    queryFn: async () => {
      if (!selectedStudent) return null;
      
      // Get all courses
      const coursesData = await api.getCourses();
      const courses = coursesData?.courses || [];
      
      // Get attendance summary for each course
      const attendancePromises = courses.map((course) =>
        api.getAttendanceSummary(selectedStudent.id, course.id).catch(() => null)
      );
      const attendanceResults = await Promise.all(attendancePromises);
      
      // Get all assignments for all courses
      const assignmentsPromises = courses.map((course) =>
        api.getAssignments(course.id).catch(() => null)
      );
      const assignmentsResults = await Promise.all(assignmentsPromises);
      
      // Get all assignments (flatten)
      const allAssignments = assignmentsResults
        .filter(r => r !== null)
        .flatMap(r => r.assignments || [])
        .filter(a => a.isPublished); // Only published assignments
      
      // Get submissions for each assignment
      const submissionsPromises = allAssignments.map((assignment) =>
        api.getSubmissions(assignment.id).catch(() => null)
      );
      const submissionsResults = await Promise.all(submissionsPromises);
      
      // Find student's submissions
      const studentSubmissions = submissionsResults
        .filter(r => r !== null)
        .flatMap(r => r.submissions || [])
        .filter(s => s.studentId === selectedStudent.id);
      
      // Calculate assignment stats
      const submittedAssignmentIds = new Set(studentSubmissions.map(s => s.assignmentId));
      const submittedCount = submittedAssignmentIds.size;
      const notSubmittedCount = allAssignments.length - submittedCount;
      
      return {
        student: selectedStudent,
        courses: courses.map((course, index) => ({
          ...course,
          attendance: attendanceResults[index],
        })).filter(c => c.attendance),
        assignments: {
          total: allAssignments.length,
          submitted: submittedCount,
          notSubmitted: notSubmittedCount,
          submissions: studentSubmissions,
        },
      };
    },
    enabled: !!selectedStudent && user?.role === 'ADMIN',
  });

  // Calculate total assignments for admin/instructor
  const totalAssignments = useMemo(() => {
    if (user?.role === 'STUDENT') {
      return pendingAssignments.length;
    }
    // For admin/instructor, show total published assignments
    return allAssignments.filter(a => a.isPublished).length;
  }, [allAssignments, pendingAssignments.length, user?.role]);

  const stats = useMemo(() => {
    const baseStats = [
      { icon: BookOpen, label: t('courses'), value: courses.length, color: 'from-blue-500 to-blue-600', path: '/courses' },
      { icon: FileText, label: t('assignments'), value: user?.role === 'STUDENT' ? pendingAssignments.length : totalAssignments, color: 'from-purple-500 to-purple-600', path: '/assignments' },
    ];

    if (user?.role === 'STUDENT') {
      // For students, show attendance stats
      baseStats.push(
        { icon: CheckCircle, label: t('presentDays'), value: attendanceStats.presentCount, color: 'from-green-500 to-green-600', path: '/attendance' },
        { icon: XCircle, label: t('absentDays'), value: attendanceStats.absentCount, color: 'from-red-500 to-red-600', path: '/attendance' }
      );
    } else {
      // For admin/instructor, show overall attendance rate and students count
      baseStats.push(
        { icon: Users, label: t('numberOfSubscribers'), value: studentsCount, color: 'from-green-500 to-green-600', path: '/students' },
        { icon: TrendingUp, label: t('attendance'), value: `${overallAttendanceRate}%`, color: 'from-orange-500 to-orange-600', path: '/attendance' }
      );
    }

    return baseStats;
  }, [courses.length, todaySessions.length, pendingAssignments.length, totalAssignments, user?.role, attendanceStats, overallAttendanceRate, studentsCount, t]);

  return (
    <div className="h-[100dvh] h-[100vh] flex flex-col overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Animated Header with Gradient */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 p-4 safe-top"
      >
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 100, 0],
              y: [0, -50, 0],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -top-20 -right-20 w-48 h-48 bg-white/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              x: [0, -80, 0],
              y: [0, 60, 0],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: 25,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute -bottom-20 -left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl"
          />
        </div>

        <div className="relative z-10">
          {/* Help Guide */}
          <p className="text-white/80 text-[9px] mb-1 max-w-2xl">
            {t('helpGuide.dashboard')}
          </p>
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl font-bold text-white mb-0.5"
          >
            {t('welcome')}، {user?.name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="text-primary-100 text-xs"
          >
            {t('dashboard')}
          </motion.p>
        </div>
      </motion.div>

      {/* Stats Cards - Horizontal Scroll on Mobile */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3">
          <div className={`grid ${user?.role === 'STUDENT' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'} gap-2 mb-3`}>
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate(stat.path)}
                  className="bg-white rounded-xl p-3 shadow-md border border-gray-100 cursor-pointer relative overflow-hidden group"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-2 shadow-sm`}>
                    <Icon className="text-white" size={18} />
                  </div>
                  <p className="text-gray-600 text-[10px] mb-0.5 font-medium">{stat.label}</p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="text-lg font-bold text-gray-900"
                  >
                    {stat.value}
                  </motion.p>
                </motion.div>
              );
            })}
          </div>

          {/* Today's Sessions */}
          {todaySessions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-3 mb-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Clock size={16} className="text-primary-600" />
                  {t('todaySessions')}
                </h2>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div className="space-y-1.5">
                {todaySessions.slice(0, 2).map((session, i) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/attendance/${session.id}`)}
                    className="p-2 bg-gradient-to-r from-primary-50 to-primary-100 rounded-lg border border-primary-200 cursor-pointer hover:shadow-sm transition"
                  >
                    <p className="font-semibold text-gray-900 text-xs">{session.topic}</p>
                    <p className="text-[10px] text-gray-600">{session.startTime} - {session.endTime}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Pending Assignments */}
          {pendingAssignments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-3 mb-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <FileText size={16} className="text-purple-600" />
                  {user?.role === 'STUDENT' ? t('pendingAssignments') : t('unpublishedAssignments')}
                </h2>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div className="space-y-1.5">
                {pendingAssignments.slice(0, 2).map((assignment, i) => (
                  <motion.div
                    key={assignment.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.0 + i * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/assignments/${assignment.id}`)}
                    className="p-2 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200 cursor-pointer hover:shadow-sm transition"
                  >
                    <p className="font-semibold text-gray-900 text-xs">{assignment.title}</p>
                    <p className="text-[10px] text-gray-600">{new Date(assignment.dueDate).toLocaleDateString()}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Available Quizzes (Students Only) */}
          {user?.role === 'STUDENT' && availableQuizzes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-3 mb-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <HelpCircle size={16} className="text-green-600" />
                  {t('availableQuizzes')}
                </h2>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div className="space-y-1.5">
                {availableQuizzes.slice(0, 3).map((quiz, i) => (
                  <motion.div
                    key={quiz.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.1 + i * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/quiz/${quiz.id}`)}
                    className="p-2 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200 cursor-pointer hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-xs">{quiz.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            quiz.type === 'PRE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {quiz.type === 'PRE' ? t('preQuiz') : t('postQuiz')}
                          </span>
                          {quiz.session?.topic && (
                            <span className="text-[10px] text-gray-600">{quiz.session.topic}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Available Exams (Students Only) */}
          {user?.role === 'STUDENT' && availableExams.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-3 mb-3"
            >
              <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={() => navigate('/courses')}>
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <HelpCircle size={16} className="text-purple-600" />
                  {t('availableExams')}
                </h2>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
              <div className="space-y-1.5">
                {availableExams.slice(0, 3).map((exam, i) => (
                  <motion.div
                    key={exam.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.3 + i * 0.1 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/exam/${exam.id}`)}
                    className="p-2 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200 cursor-pointer hover:shadow-sm transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-xs">{exam.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            exam.type === 'PRE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {exam.type === 'PRE' ? t('preExam') : t('postExam')}
                          </span>
                          {exam.session?.topic && (
                            <span className="text-[10px] text-gray-600">{exam.session.topic}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Students Attendance Summary (Admin Only) */}
          {user?.role === 'ADMIN' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1 }}
              className="bg-white rounded-xl shadow-md border border-gray-100 p-3 mb-3"
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Users size={16} className="text-primary-600" />
                  {t('studentsAttendance')}
                </h2>
                <button
                  onClick={() => navigate('/students')}
                  className="text-primary-600 text-xs font-semibold"
                >
                  {t('viewAll')}
                </button>
              </div>

              {studentsAttendanceLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12" count={5} />
                </div>
              ) : studentsAttendance.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="mx-auto text-gray-400 mb-2" size={24} />
                  <p className="text-gray-600 text-xs">{t('noStudents')}</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {studentsAttendance.map((item, i) => {
                    const { student, summary } = item;
                    const attendanceRate = summary?.attendanceRate || 0;
                    
                    return (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.2 + i * 0.05 }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelectedStudent(student)}
                        className="p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 cursor-pointer hover:shadow-sm transition flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="text-primary-600" size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 text-xs truncate">{student.name}</h3>
                            <p className="text-[10px] text-gray-600 truncate">{student.email}</p>
                          </div>
                        </div>
                        <div className="text-right ml-2">
                          <div className={`text-sm font-bold ${attendanceRate >= 80 ? 'text-green-600' : attendanceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {attendanceRate}%
                          </div>
                          <div className="text-[10px] text-gray-500">{t('attendanceRate')}</div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* My Courses */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: user?.role === 'ADMIN' ? 1.3 : 1.1 }}
            className="bg-white rounded-xl shadow-md border border-gray-100 p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <BookOpen size={16} className="text-blue-600" />
                {t('myCourses')}
              </h2>
              <button
                onClick={() => navigate('/courses')}
                className="text-primary-600 text-xs font-semibold"
              >
                {t('viewAll')}
              </button>
            </div>

            {coursesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16" count={2} />
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-6">
                <BookOpen className="mx-auto text-gray-400 mb-2" size={24} />
                <p className="text-gray-600 text-xs">{t('noCourses')}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {courses.slice(0, 3).map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1.2 + i * 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/courses/${course.id}`)}
                    className="p-2 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 cursor-pointer hover:shadow-sm transition flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-xs mb-0.5 truncate">{course.title}</p>
                      <div className="flex gap-2 text-[10px] text-gray-600">
                        <span className="flex items-center gap-0.5">
                          <Users size={10} />
                          {course._count?.enrollments || 0}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Calendar size={10} />
                          {course._count?.sessions || 0}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-gray-400 ml-2 flex-shrink-0" />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Student Details Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
              >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedStudent.name}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Mail size={16} />
                        {selectedStudent.email}
                      </span>
                      {selectedStudent.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={16} />
                          {selectedStudent.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                  >
                    <X size={24} className="text-gray-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {studentDetailsLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-32" count={3} />
                    </div>
                  ) : studentDetailsData ? (
                    <div className="space-y-6">
                      {/* Overall Stats */}
                      {studentsAttendance.find(s => s.student.id === selectedStudent.id) && (() => {
                        const overall = studentsAttendance.find(s => s.student.id === selectedStudent.id);
                        const summary = overall?.summary || {};
                        return (
                          <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-4 border border-primary-200">
                            <h3 className="font-semibold text-gray-900 mb-3">{t('overallStatistics')}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <CheckCircle className="text-green-600" size={16} />
                                  <span className="text-xs text-gray-600">{t('present')}</span>
                                </div>
                                <div className="text-xl font-bold text-green-600">{summary.presentCount || 0}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-red-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <XCircle className="text-red-600" size={16} />
                                  <span className="text-xs text-gray-600">{t('absent')}</span>
                                </div>
                                <div className="text-xl font-bold text-red-600">{summary.absentCount || 0}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-yellow-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <Clock className="text-yellow-600" size={16} />
                                  <span className="text-xs text-gray-600">{t('late')}</span>
                                </div>
                                <div className="text-xl font-bold text-yellow-600">{summary.lateCount || 0}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <Calendar className="text-blue-600" size={16} />
                                  <span className="text-xs text-gray-600">{t('excused')}</span>
                                </div>
                                <div className="text-xl font-bold text-blue-600">{summary.excusedCount || 0}</div>
                              </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-primary-200">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">{t('totalSessions')}:</span>
                                <span className="font-bold text-gray-900">{summary.totalSessions || 0}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-sm text-gray-600">{t('attendanceRate')}:</span>
                                <span className={`font-bold text-lg ${(summary.attendanceRate || 0) >= 80 ? 'text-green-600' : (summary.attendanceRate || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                  {summary.attendanceRate || 0}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Course Details */}
                      {studentDetailsData.courses && studentDetailsData.courses.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-3">{t('courseDetails')}</h3>
                          <div className="space-y-3">
                            {studentDetailsData.courses.map((course, i) => {
                              const attendance = course.attendance?.summary;
                              if (!attendance) return null;
                              
                              const courseRate = attendance.totalSessions > 0 
                                ? Math.round((attendance.presentCount / attendance.totalSessions) * 100)
                                : 0;

                              return (
                                <motion.div
                                  key={course.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.1 }}
                                  onClick={() => navigate(`/courses/${course.id}`)}
                                  className="p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:shadow-md transition"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-900">{course.title}</h4>
                                      <p className="text-xs text-gray-600 mt-1">
                                        {attendance.totalSessions} {t('sessions')}
                                      </p>
                                    </div>
                                    <div className={`text-lg font-bold ${courseRate >= 80 ? 'text-green-600' : courseRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                      {courseRate}%
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center">
                                      <div className="text-sm font-bold text-green-600">{attendance.presentCount}</div>
                                      <div className="text-xs text-gray-600">{t('present')}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-sm font-bold text-red-600">{attendance.absentCount}</div>
                                      <div className="text-xs text-gray-600">{t('absent')}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-sm font-bold text-yellow-600">{attendance.lateCount || 0}</div>
                                      <div className="text-xs text-gray-600">{t('late')}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-sm font-bold text-blue-600">{attendance.excusedCount || 0}</div>
                                      <div className="text-xs text-gray-600">{t('excused')}</div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Assignments Statistics */}
                      {studentDetailsData.assignments && (
                        <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                          <h3 className="font-semibold text-gray-900 mb-3">{t('assignmentsStatistics')}</h3>
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-center gap-2 mb-1">
                                <FileText className="text-purple-600" size={16} />
                                <span className="text-xs text-gray-600">{t('totalAssignments')}</span>
                              </div>
                              <div className="text-xl font-bold text-gray-900">{studentDetailsData.assignments.total}</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                              <div className="flex items-center gap-2 mb-1">
                                <CheckCircle2 className="text-green-600" size={16} />
                                <span className="text-xs text-gray-600">{t('submitted')}</span>
                              </div>
                              <div className="text-xl font-bold text-green-600">{studentDetailsData.assignments.submitted}</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-red-200">
                              <div className="flex items-center gap-2 mb-1">
                                <AlertCircle className="text-red-600" size={16} />
                                <span className="text-xs text-gray-600">{t('notSubmitted')}</span>
                              </div>
                              <div className="text-xl font-bold text-red-600">{studentDetailsData.assignments.notSubmitted}</div>
                            </div>
                          </div>
                          {studentDetailsData.assignments.total > 0 && (
                            <div className="mt-4 pt-4 border-t border-purple-200">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">{t('submissionRate')}:</span>
                                <span className={`font-bold text-lg ${
                                  (studentDetailsData.assignments.submitted / studentDetailsData.assignments.total * 100) >= 80 
                                    ? 'text-green-600' 
                                    : (studentDetailsData.assignments.submitted / studentDetailsData.assignments.total * 100) >= 60 
                                    ? 'text-yellow-600' 
                                    : 'text-red-600'
                                }`}>
                                  {Math.round((studentDetailsData.assignments.submitted / studentDetailsData.assignments.total) * 100)}%
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600">{t('loading')}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
