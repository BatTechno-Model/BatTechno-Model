import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/Skeleton';
import { ArrowLeft, Save, BookOpen, Calendar, User, X, Plus } from 'lucide-react';

export default function EditCourse() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const { data: courseData, isLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => api.getCourse(id),
  });

  const { data: instructorsData } = useQuery({
    queryKey: ['instructors'],
    queryFn: () => api.getInstructors(),
  });

  const course = courseData?.course;
  const instructors = instructorsData?.instructors || [];

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    createdBy: '',
    instructorIds: [],
  });

  useEffect(() => {
    if (course) {
      const startDate = new Date(course.startDate);
      const endDate = new Date(course.endDate);
      
      const formattedStartDate = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      
      const formattedEndDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10);
      
      const instructorIds = course.instructors?.map(ci => ci.instructor.id) || [];
      
      setFormData({
        title: course.title || '',
        description: course.description || '',
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        createdBy: course.createdBy || '',
        instructorIds,
      });
    }
  }, [course]);

  const { mutate: updateCourse, isPending } = useMutation({
    mutationFn: (data) => api.updateCourse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['course', id]);
      queryClient.invalidateQueries(['courses']);
      addToast(t('success'), 'success');
      navigate(`/courses/${id}`);
    },
    onError: (error) => {
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.startDate || !formData.endDate) {
      addToast(t('fillRequiredFields'), 'error');
      return;
    }
    updateCourse(formData);
  };

  const handleAddInstructor = (instructorId) => {
    if (!formData.instructorIds.includes(instructorId) && instructorId !== formData.createdBy) {
      setFormData({
        ...formData,
        instructorIds: [...formData.instructorIds, instructorId],
      });
    }
  };

  const handleRemoveInstructor = (instructorId) => {
    setFormData({
      ...formData,
      instructorIds: formData.instructorIds.filter(id => id !== instructorId),
    });
  };

  const availableInstructors = instructors.filter(
    inst => inst.id !== formData.createdBy && !formData.instructorIds.includes(inst.id)
  );

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!course) {
    return <div>{t('error')}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate(`/courses/${id}`)}
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('editCourse')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('courseTitle')} *
            </label>
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
                placeholder={t('courseTitlePlaceholder') || 'عنوان الدورة'}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('courseDescriptionPlaceholder') || 'وصف الدورة'}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('startDate')} *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('endDate')} *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Main Instructor (Creator) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('mainInstructor')} *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <select
                value={formData.createdBy}
                onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                required
              >
                <option value="">{t('selectInstructor')}</option>
                {instructors.map((instructor) => (
                  <option key={instructor.id} value={instructor.id}>
                    {instructor.name} ({instructor.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional Instructors */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('additionalInstructors')}
            </label>
            
            {/* Selected Instructors */}
            {formData.instructorIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.instructorIds.map((instructorId) => {
                  const instructor = instructors.find(inst => inst.id === instructorId);
                  if (!instructor) return null;
                  return (
                    <motion.div
                      key={instructorId}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg text-sm"
                    >
                      <User size={14} />
                      <span>{instructor.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveInstructor(instructorId)}
                        className="ml-1 hover:text-primary-900"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Add Instructor Dropdown */}
            {availableInstructors.length > 0 && (
              <div className="relative">
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddInstructor(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent appearance-none bg-white"
                >
                  <option value="">{t('addInstructor')}</option>
                  {availableInstructors.map((instructor) => (
                    <option key={instructor.id} value={instructor.id}>
                      {instructor.name} ({instructor.email})
                    </option>
                  ))}
                </select>
                <Plus className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
              </div>
            )}
            
            {availableInstructors.length === 0 && formData.instructorIds.length === 0 && (
              <p className="text-sm text-gray-500">{t('noMoreInstructorsAvailable')}</p>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(`/courses/${id}`)}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              {t('cancel')}
            </motion.button>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {isPending ? t('saving') : t('save')}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
