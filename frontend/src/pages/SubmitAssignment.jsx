import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Upload, Link as LinkIcon, X, Save } from 'lucide-react';

export default function SubmitAssignment() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([{ type: 'LINK', url: '', name: '' }]);

  const { mutate: submitAssignment, isPending } = useMutation({
    mutationFn: (data) => {
      if (!id) {
        throw new Error('Assignment ID is required');
      }
      return api.createSubmission(id, data, files);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['assignment', id]);
      queryClient.invalidateQueries(['submissions', id]);
      addToast(t('success'), 'success');
      navigate(`/assignments/${id}`);
    },
    onError: (error) => {
      console.error('Submit assignment error:', error);
      addToast(error.message || t('error'), 'error');
    },
  });

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    console.log(`Selected ${selectedFiles.length} files:`, selectedFiles.map(f => `${f.name} (${f.type}, ${(f.size / 1024 / 1024).toFixed(2)}MB)`));
    setFiles(selectedFiles);
  };

  const addLink = () => {
    setLinks([...links, { type: 'LINK', url: '', name: '' }]);
  };

  const removeLink = (index) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const updateLink = (index, field, value) => {
    const updated = [...links];
    updated[index][field] = value;
    setLinks(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const assets = links
      .filter((l) => l.url && l.name)
      .map((l) => ({ type: 'LINK', url: l.url, name: l.name }));
    
    submitAssignment({ note, assets });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => navigate(-1)}
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('submitAssignment')}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('note')}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('addNote')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('uploadFiles')}
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto text-gray-400 mb-2" size={32} />
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-primary-600 hover:text-primary-700 font-semibold"
              >
                {t('selectFiles')}
              </label>
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="text-sm text-gray-600">{file.name}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('links')}
              </label>
              <button
                type="button"
                onClick={addLink}
                className="text-primary-600 hover:text-primary-700 text-sm font-semibold"
              >
                + {t('addLink')}
              </button>
            </div>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('linkName')}
                    value={link.name}
                    onChange={(e) => updateLink(index, 'name', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="url"
                    placeholder={t('linkUrl')}
                    value={link.url}
                    onChange={(e) => updateLink(index, 'url', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLink(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50"
          >
            <Save size={20} />
            {t('submit')}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
