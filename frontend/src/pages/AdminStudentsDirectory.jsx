import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Users } from 'lucide-react';
import api from '../utils/api';
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

export default function AdminStudentsDirectory() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    search: '',
    city: '',
    country: '',
    isStudent: '',
    courseId: '',
    alertType: '',
    lowPerformance: '',
    page: 1,
    limit: 50,
  });

  // Clean filters before sending to API (remove empty strings)
  const cleanFilters = (filters) => {
    const cleaned = { ...filters };
    Object.keys(cleaned).forEach(key => {
      if (cleaned[key] === '' || cleaned[key] === undefined) {
        delete cleaned[key];
      }
    });
    return cleaned;
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['adminStudents', filters],
    queryFn: async () => {
      try {
        const cleanedFilters = cleanFilters(filters);
        console.log('Fetching students with filters:', cleanedFilters);
        const result = await api.getAdminStudents(cleanedFilters);
        console.log('API Response:', result);
        console.log('Students data:', result?.data);
        console.log('Students count:', result?.data?.length || 0);
        return result;
      } catch (err) {
        console.error('Error fetching students:', err);
        throw err;
      }
    },
    retry: 1,
    onError: (error) => {
      console.error('Query error:', error);
    },
  });

  const students = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 };
  
  console.log('Current students:', students);
  console.log('Students length:', students.length);
  console.log('Pagination:', pagination);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset to first page when filter changes
    }));
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-red-800 font-bold text-lg mb-2">{t('error')}</p>
          <p className="text-red-600 mb-4">
            {error?.message || 'Failed to load students. Please try again.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            {t('retry') || 'إعادة المحاولة'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 py-4 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {t('studentsDirectory')}
        </h1>
      </motion.div>

      {/* Simple Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4"
      >
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            placeholder={t('searchByNameOrEmail') || 'البحث بالاسم أو البريد الإلكتروني'}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </motion.div>

      {/* Students Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {students.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users size={32} className="text-primary-600" />
            </div>
            <p className="text-gray-800 font-semibold text-lg mb-2">{t('noStudentsFound')}</p>
            <p className="text-gray-600 text-sm">
              {filters.search
                ? (t('tryAdjustingFilters') || 'جرب تعديل البحث')
                : (t('noStudentsInDatabase') || 'لا يوجد طلاب في قاعدة البيانات حالياً')}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {students.map((student, index) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => navigate(`/admin/students/${student.id}/report`)}
                  className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md hover:border-primary-200 cursor-pointer transition-all duration-200 group"
                >
                  <div className="flex flex-col items-center text-center">
                    {student.profile?.avatar ? (
                      <div className="relative mb-2">
                        <img
                          src={getImageUrl(student.profile.avatar)}
                          alt={student.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-primary-200 group-hover:border-primary-400 transition-colors"
                          crossOrigin="anonymous"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-lg hidden">
                          {getInitials(student.name)}
                        </div>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-semibold text-lg mb-2 shadow-md">
                        {getInitials(student.name)}
                      </div>
                    )}
                    <h3 className="text-sm font-semibold text-gray-900 truncate w-full px-1 group-hover:text-primary-600 transition-colors">
                      {student.name}
                    </h3>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  {t('previous')}
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  {t('next')}
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
