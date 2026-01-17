import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useState, useMemo } from 'react';
import api from '../utils/api';
import Skeleton from '../components/Skeleton';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, CheckCircle, XCircle, Clock, FileDown } from 'lucide-react';

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
  };

  const markAllPresent = () => {
    if (enrolledStudents.length === 0) return;
    
    updateAttendance({
      sessionId,
      attendances: enrolledStudents.map((student) => ({
        studentId: student.id,
        status: 'PRESENT',
        note: '',
      })),
    });
  };

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

      {session && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6"
        >
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{session.topic || t('attendance')}</h1>
          <p className="text-gray-600">
            {new Date(session.date).toLocaleDateString()} • {session.startTime} - {session.endTime}
          </p>
        </motion.div>
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">{t('markAttendance')}</h2>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={markAllPresent}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
        >
          {t('markAllPresent')}
        </motion.button>
      </div>

      {sessionLoading || attendanceLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16" count={5} />
        </div>
      ) : allStudentsWithAttendance.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-600">{t('noStudents')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {allStudentsWithAttendance.map((attendance, i) => {
              const StatusIcon = statusOptions.find((s) => s.value === attendance.status)?.icon || CheckCircle;
              
              return (
                <motion.div
                  key={attendance.studentId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{attendance.student.name}</h3>
                    <p className="text-sm text-gray-600">{attendance.student.email}</p>
                  </div>
                  <div className="flex gap-2">
                    {statusOptions.map((option) => {
                      const Icon = option.icon;
                      const isActive = attendance.status === option.value;
                      
                      // Determine color classes based on status
                      const getColorClasses = () => {
                        if (!isActive) {
                          return 'border-gray-200 text-gray-400 hover:border-gray-300';
                        }
                        switch (option.value) {
                          case 'PRESENT':
                            return 'border-green-500 bg-green-50 text-green-600';
                          case 'ABSENT':
                            return 'border-red-500 bg-red-50 text-red-600';
                          case 'LATE':
                            return 'border-yellow-500 bg-yellow-50 text-yellow-600';
                          case 'EXCUSED':
                            return 'border-blue-500 bg-blue-50 text-blue-600';
                          default:
                            return 'border-gray-200 text-gray-400';
                        }
                      };
                      
                      return (
                        <motion.button
                          key={option.value}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleStatusChange(attendance.studentId, option.value)}
                          className={`p-2 rounded-lg border-2 transition ${getColorClasses()}`}
                          title={t(option.label)}
                        >
                          <Icon size={20} />
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
