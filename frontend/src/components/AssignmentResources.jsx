import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { Link as LinkIcon, Trash2, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function AssignmentResources({ assignmentId, canManage = false }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [resourceName, setResourceName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  
  // Reset form when closing
  const resetForm = () => {
    setResourceName('');
    setResourceUrl('');
  };
  
  // Ensure values are always strings to prevent controlled/uncontrolled warnings
  const safeResourceName = resourceName ?? '';
  const safeResourceUrl = resourceUrl ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-resources', assignmentId],
    queryFn: async () => {
      if (!assignmentId) {
        return { resources: [] };
      }
      try {
        return await api.getAssignmentResources(assignmentId);
      } catch (error) {
        console.error('Failed to fetch assignment resources:', error);
        return { resources: [] };
      }
    },
    enabled: !!assignmentId && !!user,
  });

  const resources = data?.resources || [];

  const { mutate: createResource, isPending: isCreating } = useMutation({
    mutationFn: (data) => api.createAssignmentResource(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment-resources', assignmentId]);
      queryClient.invalidateQueries(['assignment', assignmentId]);
      addToast(t('success'), 'success');
      setShowAddForm(false);
      resetForm();
    },
    onError: (error) => {
      console.error('Create resource error:', error);
      // Extract error message from ApiError or plain error object
      let errorMessage = t('error');
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = error.message || error.error || error.toString();
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      addToast(errorMessage, 'error');
    },
  });

  const { mutate: deleteResource } = useMutation({
    mutationFn: (id) => api.deleteAssignmentResource(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment-resources', assignmentId]);
      queryClient.invalidateQueries(['assignment', assignmentId]);
      addToast(t('success'), 'success');
    },
    onError: () => {
      addToast(t('error'), 'error');
    },
  });

  const handleDownload = (resource) => {
    // Open link in new tab
    window.open(resource.url, '_blank', 'noopener,noreferrer');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!resourceUrl || !resourceName) {
      addToast(t('linkUrlRequired') || 'Link name and URL are required', 'error');
      return;
    }
    createResource({
      assignmentId,
      name: resourceName,
      url: resourceUrl,
    });
  };

  if (!canManage && resources.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">{t('resources')}</h3>
        {canManage && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-semibold"
          >
            <LinkIcon size={16} />
            {t('addLink') || 'Add Link'}
          </motion.button>
        )}
      </div>

      {showAddForm && canManage && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200"
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('linkName') || 'Link Name'}
              </label>
              <input
                type="text"
                value={safeResourceName}
                onChange={(e) => setResourceName(e.target.value || '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder={t('linkNamePlaceholder') || 'Enter link name'}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('linkUrl') || 'Link URL'}
              </label>
              <input
                type="url"
                value={safeResourceUrl}
                onChange={(e) => setResourceUrl(e.target.value || '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder={t('linkUrlPlaceholder') || 'https://example.com'}
                required
              />
            </div>

            <div className="flex gap-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isCreating}
                className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
              >
                {t('add')}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                {t('cancel')}
              </motion.button>
            </div>
          </form>
        </motion.div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-16 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      ) : resources.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <LinkIcon className="mx-auto mb-2" size={32} />
          <p className="text-sm">{t('noResources')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {resources.map((resource, i) => (
            <motion.div
              key={resource.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 flex-1">
                <ExternalLink className="text-primary-600" size={20} />
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{resource.name}</p>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline"
                  >
                    {resource.url}
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDownload(resource)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition"
                  title={t('openLink') || 'Open Link'}
                >
                  <ExternalLink size={18} />
                </motion.button>
                {canManage && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => deleteResource(resource.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title={t('delete') || 'حذف'}
                  >
                    <Trash2 size={18} />
                  </motion.button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
