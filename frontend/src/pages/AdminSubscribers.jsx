import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Download, Mail, Phone, MapPin, User } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function AdminSubscribers() {
  const { t } = useTranslation();
  const { addToast } = useToast();

  const [filters, setFilters] = useState({
    search: '',
    city: '',
    country: '',
    isStudent: '',
    page: 1,
    limit: 100, // Increase limit to show more on one page
  });

  const { data, isLoading } = useQuery({
    queryKey: ['adminSubscribers', filters],
    queryFn: () => api.getAdminSubscribers(filters),
  });

  const subscribers = data?.data || [];
  const pagination = data?.pagination || { page: 1, limit: 100, total: 0, totalPages: 1 };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handleDownloadPDF = async () => {
    try {
      await api.downloadSubscribersPDF(filters);
      addToast(t('pdfDownloaded'), 'success');
    } catch (error) {
      addToast(t('pdfDownloadFailed'), 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Compact Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-between"
      >
        <h1 className="text-lg font-bold text-gray-900">{t('subscribers')}</h1>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm"
        >
          <Download size={16} />
          <span className="hidden sm:inline">{t('downloadPDF')}</span>
        </button>
      </motion.div>

      {/* Compact Filters */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-3 py-2"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2 sm:col-span-1">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder={t('search')}
                className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <input
              type="text"
              value={filters.country}
              onChange={(e) => handleFilterChange('country', e.target.value)}
              placeholder={t('country')}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <input
              type="text"
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              placeholder={t('city')}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <select
              value={filters.isStudent}
              onChange={(e) => handleFilterChange('isStudent', e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">{t('all')}</option>
              <option value="true">{t('yes')}</option>
              <option value="false">{t('no')}</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Scrollable Table Container */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white"
          >
            {subscribers.length === 0 ? (
              <div className="flex items-center justify-center h-full py-12">
                <p className="text-gray-500">{t('noSubscribersFound')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        {t('name')}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase hidden sm:table-cell">
                        {t('email')}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase hidden md:table-cell">
                        {t('phone')}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        {t('location')}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase">
                        {t('isStudent')}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase hidden lg:table-cell">
                        {t('heardFrom')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {subscribers.map((subscriber) => (
                      <tr key={subscriber.id} className="hover:bg-gray-50 transition">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-xs flex-shrink-0">
                              {subscriber.profile?.fullName4
                                ? subscriber.profile.fullName4
                                    .split(' ')
                                    .slice(0, 2)
                                    .map((n) => n[0])
                                    .join('')
                                    .toUpperCase()
                                : subscriber.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {subscriber.profile?.fullName4 || subscriber.name}
                              </div>
                              <div className="text-xs text-gray-500 sm:hidden truncate">
                                {subscriber.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Mail size={12} className="text-gray-400 flex-shrink-0" />
                            <span className="truncate">{subscriber.email}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 hidden md:table-cell">
                          {subscriber.profile?.phone ? (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Phone size={12} className="text-gray-400 flex-shrink-0" />
                              {subscriber.profile.phone}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {subscriber.profile?.city || subscriber.profile?.country ? (
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <MapPin size={12} className="text-gray-400 flex-shrink-0" />
                              <span className="truncate">
                                {[subscriber.profile.city, subscriber.profile.country]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                              subscriber.profile?.isStudent
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {subscriber.profile?.isStudent ? t('yes') : t('no')}
                          </span>
                        </td>
                        <td className="px-3 py-2 hidden lg:table-cell text-xs text-gray-600 truncate max-w-[150px]">
                          {subscriber.profile?.heardFrom || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Compact Footer with Count */}
      {subscribers.length > 0 && (
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-3 py-1.5 flex items-center justify-between text-xs text-gray-600">
          <span>
            {t('showing')} {subscribers.length} {t('of')} {pagination.total} {t('results')}
          </span>
          {pagination.totalPages > 1 && (
            <span>
              {t('page')} {pagination.page} / {pagination.totalPages}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
