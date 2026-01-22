import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { Upload, Link as LinkIcon, Trash2, Download, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export default function AssignmentResources({ assignmentId, canManage = false }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [resourceType, setResourceType] = useState('LINK');
  const [resourceName, setResourceName] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceFile, setResourceFile] = useState(null);

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
    mutationFn: (data) => api.createAssignmentResource(data, resourceFile),
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment-resources', assignmentId]);
      queryClient.invalidateQueries(['assignment', assignmentId]);
      addToast(t('success'), 'success');
      setShowAddForm(false);
      setResourceName('');
      setResourceUrl('');
      setResourceFile(null);
    },
    onError: () => {
      addToast(t('error'), 'error');
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

  const handleDownload = async (resource) => {
    if (resource.type === 'FILE') {
      try {
        await api.downloadAssignmentResource(resource.id, resource.name);
        addToast(t('fileDownloaded') || 'تم تحميل الملف بنجاح', 'success');
      } catch (error) {
        console.error('Download error:', error);
        addToast(error.message || t('downloadFailed') || 'فشل تحميل الملف', 'error');
      }
    } else {
      // For links, open in new tab
      window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (resourceType === 'LINK' && !resourceUrl) {
      addToast(t('linkUrlRequired'), 'error');
      return;
    }
    if (resourceType === 'FILE' && !resourceFile) {
      addToast(t('fileRequired'), 'error');
      return;
    }
    createResource({
      assignmentId,
      type: resourceType,
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
            <Upload size={16} />
            {t('addResource')}
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
                {t('resourceType')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResourceType('LINK')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
                    resourceType === 'LINK'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <LinkIcon size={16} className="inline mr-2" />
                  {t('link')}
                </button>
                <button
                  type="button"
                  onClick={() => setResourceType('FILE')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition ${
                    resourceType === 'FILE'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <Upload size={16} className="inline mr-2" />
                  {t('file')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('resourceName')}
              </label>
              <input
                type="text"
                value={resourceName ?? ''}
                onChange={(e) => setResourceName(e.target.value ?? '')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            {resourceType === 'LINK' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('linkUrl')}
                </label>
                <input
                  type="url"
                  value={resourceUrl ?? ''}
                  onChange={(e) => setResourceUrl(e.target.value ?? '')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('selectFiles')}
                </label>
                <input
                  type="file"
                  onChange={(e) => setResourceFile(e.target.files[0])}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
            )}

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
                  setResourceName('');
                  setResourceUrl('');
                  setResourceFile(null);
                  setResourceType('LINK');
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
                {resource.type === 'FILE' ? (
                  <Download className="text-primary-600" size={20} />
                ) : (
                  <ExternalLink className="text-primary-600" size={20} />
                )}
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{resource.name}</p>
                  {resource.type === 'LINK' && (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 hover:underline"
                    >
                      {resource.url}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleDownload(resource)}
                  className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition"
                  title={resource.type === 'FILE' ? (t('download') || 'تحميل') : (t('openLink') || 'فتح الرابط')}
                >
                  {resource.type === 'FILE' ? (
                    <Download size={18} />
                  ) : (
                    <ExternalLink size={18} />
                  )}
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
