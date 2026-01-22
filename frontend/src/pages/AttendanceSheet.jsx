import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, CheckCircle, XCircle, Clock, FileDown } from 'lucide-react';
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

const statusOptions = [
  { value: 'PRESENT', label: 'present', icon: CheckCircle, color: 'text-green-600' },
  { value: 'ABSENT', label: 'absent', icon: XCircle, color: 'text-red-600' },
  { value: 'LATE', label: 'late', icon: Clock, color: 'text-yellow-600' },
  { value: 'EXCUSED', label: 'excused', icon: CheckCircle, color: 'text-blue-600' },
];

export default function AttendanceSheet() {
  const { t } = useTranslation();
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatuses, setSelectedStatuses] = useState({});
  const [hiddenStudents, setHiddenStudents] = useState(new Set());

  const { data: sessionData, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.getSession(sessionId),
  });

  const { data, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance', sessionId],
    queryFn: () => api.getAttendance(sessionId),
  });

  const session = sessionData?.session;
  const existingAttendances = data?.attendances || [];
  
  // Get all enrolled students from the course
  const enrolledStudents = session?.course?.enrollments?.map(e => e.user) || [];
  
  // Merge enrolled students with existing attendances
  const allStudentsWithAttendance = useMemo(() => {
    // Create a map of existing attendances by studentId
    const attendanceMap = new Map();
    existingAttendances.forEach(att => {
      attendanceMap.set(att.studentId, att);
    });
    
    // Create list with all enrolled students, using existing attendance if available
    return enrolledStudents.map(student => {
      const existingAttendance = attendanceMap.get(student.id);
      if (existingAttendance) {
        return existingAttendance;
      }
      // Create a placeholder attendance for students without attendance record
      return {
        id: null,
        studentId: student.id,
        student: student,
        status: 'ABSENT', // Default to absent
        note: '',
      };
    });
  }, [enrolledStudents, existingAttendances]);

  const { mutate: updateAttendance } = useMutation({
    mutationFn: (data) => api.bulkUpdateAttendance(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance', sessionId]);
      addToast(t('success'), 'success');
    },
    onError: () => {
      addToast(t('error'), 'error');
    },
  });

  const handleStatusChange = (studentId, status) => {
    // Mark this student's status as selected
    setSelectedStatuses(prev => ({ ...prev, [studentId]: status }));
    
    // Update the attendance status for the student
    const updatedAttendances = allStudentsWithAttendance.map((att) =>
      att.studentId === studentId
        ? { ...att, status, note: att.note || '' }
        : att
    );

    updateAttendance({
      sessionId,
      attendances: updatedAttendances.map((a) => ({
        studentId: a.studentId,
        status: a.status,
        note: a.note || '',
      })),
    });

    // Hide the student after a short delay to allow animation (for any status)
    setTimeout(() => {
      setHiddenStudents(prev => new Set(prev).add(studentId));
    }, 500); // 500ms delay for animation
  };
  
  // Initialize selectedStatuses from existing attendances
  useEffect(() => {
    const initialStatuses = {};
    existingAttendances.forEach(att => {
      if (att.status && att.status !== 'ABSENT') {
        initialStatuses[att.studentId] = att.status;
      }
    });
    setSelectedStatuses(prev => ({ ...prev, ...initialStatuses }));
  }, [existingAttendances]);

  const markAllPresent = () => {
    if (enrolledStudents.length === 0) return;
    
    // Mark all students as present
    enrolledStudents.forEach((student) => {
      setSelectedStatuses(prev => ({ ...prev, [student.id]: 'PRESENT' }));
    });
    
    updateAttendance({
      sessionId,
      attendances: enrolledStudents.map((student) => ({
        studentId: student.id,
        status: 'PRESENT',
        note: '',
      })),
    });

    // Hide all students after a short delay to allow animation
    setTimeout(() => {
      const allStudentIds = new Set(enrolledStudents.map(s => s.id));
      setHiddenStudents(allStudentIds);
    }, 500); // 500ms delay for animation
  };

  return (
    <div className="max-w-4xl mx-auto px-3 py-4">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">{t('back')}</span>
      </motion.button>

      {session && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl p-4 border border-primary-200 mb-4"
        >
          <h1 className="text-lg font-bold text-gray-900 mb-1">{session.topic || t('attendance')}</h1>
          <p className="text-sm text-gray-600">
            {new Date(session.date).toLocaleDateString()} • {session.startTime} - {session.endTime}
          </p>
        </motion.div>
      )}

      <div className="flex justify-between items-center mb-3">
        <h2 className="text-base font-bold text-gray-900">{t('markAttendance')}</h2>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={markAllPresent}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs font-semibold flex items-center gap-1.5"
        >
          <CheckCircle size={14} />
          {t('markAllPresent')}
        </motion.button>
      </div>

      {sessionLoading || attendanceLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14" count={5} />
        </div>
      ) : allStudentsWithAttendance.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-600">{t('noStudents')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <AnimatePresence>
            {allStudentsWithAttendance
              .filter(attendance => !hiddenStudents.has(attendance.studentId))
              .map((attendance, i) => {
                const StatusIcon = statusOptions.find((s) => s.value === attendance.status)?.icon || CheckCircle;
                const student = attendance.student;
                
                return (
                  <motion.div
                    key={attendance.studentId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 100, scale: 0.8 }}
                    transition={{ 
                      duration: 0.3,
                      delay: i * 0.03,
                      exit: { duration: 0.4 }
                    }}
                    className="p-3 flex items-center justify-between hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {student?.profile?.avatar ? (
                        <div className="relative flex-shrink-0">
                          <img
                            src={getImageUrl(student.profile.avatar)}
                            alt={student.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-primary-200"
                            crossOrigin="anonymous"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallback = e.target.nextElementSibling;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm hidden">
                            {getInitials(student.name)}
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {getInitials(student.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{student.name}</h3>
                        <p className="text-xs text-gray-500 truncate">{student.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {/* Show all status options */}
                      {statusOptions.map((option) => {
                        const Icon = option.icon;
                        const isActive = attendance.status === option.value;
                        
                        // Determine color classes based on status
                        const getColorClasses = () => {
                          if (!isActive) {
                            return 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 bg-white';
                          }
                          switch (option.value) {
                            case 'PRESENT':
                              return 'border-green-500 bg-green-50 text-green-600 shadow-sm';
                            case 'ABSENT':
                              return 'border-red-500 bg-red-50 text-red-600 shadow-sm';
                            case 'LATE':
                              return 'border-yellow-500 bg-yellow-50 text-yellow-600 shadow-sm';
                            case 'EXCUSED':
                              return 'border-blue-500 bg-blue-50 text-blue-600 shadow-sm';
                            default:
                              return 'border-gray-200 text-gray-400 bg-white';
                          }
                        };
                        
                        return (
                          <motion.button
                            key={option.value}
                            whileTap={{ scale: 0.9 }}
                            whileHover={{ scale: 1.05 }}
                            onClick={() => handleStatusChange(attendance.studentId, option.value)}
                            className={`p-1.5 rounded-lg border-2 transition-all ${getColorClasses()}`}
                            title={t(option.label)}
                          >
                            <Icon size={16} />
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
