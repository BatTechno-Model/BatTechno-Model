import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Save, Edit2, Mail, Phone, MapPin, GraduationCap, Briefcase, Link as LinkIcon, ExternalLink, Camera, User as UserIcon, LogOut } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import AutocompleteInput from '../components/AutocompleteInput';
import ChipPicker from '../components/ChipPicker';
import ProfileView from '../components/ProfileView';
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

export default function Profile() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile().then((res) => res.data),
  });

  const { data: profileOptions } = useQuery({
    queryKey: ['profileOptions'],
    queryFn: () => api.getProfileOptions().then((res) => res.data),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => api.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['profile']);
      addToast(t('profileUpdated'), 'success');
      setIsEditMode(false); // Switch to view mode after save
    },
    onError: (error) => {
      addToast(error.message || t('updateFailed'), 'error');
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file) => {
      try {
        const response = await api.uploadAvatar(file);
        return response;
      } catch (error) {
        console.error('Avatar upload error:', error);
        throw error;
      }
    },
    onSuccess: (response) => {
      // Update the profile data immediately with the new avatar
      queryClient.setQueryData(['profile'], (oldData) => {
        if (oldData && response?.data) {
          return { ...oldData, avatar: response.data.avatar };
        }
        return oldData;
      });
      // Also invalidate to refetch fresh data
      queryClient.invalidateQueries(['profile']);
      addToast(t('avatarUploaded') || 'Avatar uploaded successfully', 'success');
      setAvatarPreview(null); // Clear preview after successful upload
    },
    onError: (error) => {
      console.error('Avatar upload mutation error:', error);
      const errorMessage = error?.message || error?.error || t('avatarUploadFailed') || 'Failed to upload avatar';
      addToast(errorMessage, 'error');
      setAvatarPreview(null); // Clear preview on error
    },
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      addToast(t('invalidImageType') || 'Invalid image type', 'error');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      addToast(t('imageTooLarge') || 'Image too large (max 5MB)', 'error');
      return;
    }

    // Create preview
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.onerror = () => {
        console.error('Error reading file for preview');
        addToast('Error reading image file', 'error');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error creating preview:', error);
      addToast('Error creating preview', 'error');
      return;
    }

    // Upload the file
    try {
      await uploadAvatarMutation.mutateAsync(file);
    } catch (error) {
      // Error is already handled in onError callback
      console.error('Upload failed:', error);
    }
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: profileData || {},
  });

  const isStudent = watch('isStudent');
  const country = watch('country');
  const fullName4 = watch('fullName4');
  const heardFrom = watch('heardFrom');
  const skills = watch('skills') || [];
  const interests = watch('interests') || [];

  useEffect(() => {
    if (profileData) {
      Object.keys(profileData).forEach((key) => {
        setValue(key, profileData[key]);
      });
      // If profile has data, show view mode by default
      if (profileData.fullName4 || profileData.phone || profileData.city) {
        setIsEditMode(false);
      }
      // Clear preview when profile data changes (after successful upload)
      if (profileData.avatar) {
        setAvatarPreview(null);
      }
    }
  }, [profileData, setValue]);

  const onSubmit = (data) => {
    if (data.fullName4) {
      const words = data.fullName4.trim().split(/\s+/);
      if (words.length < 4) {
        addToast(t('fullNameMustHave4Words'), 'error');
        return;
      }
    }

    if (data.isStudent) {
      if (!data.university || !data.major) {
        addToast(t('universityAndMajorRequired'), 'error');
        return;
      }
    }

    if (data.portfolioLinks) {
      const portfolioLinks = {};
      if (data.portfolioLinks.githubUrl) portfolioLinks.githubUrl = data.portfolioLinks.githubUrl;
      if (data.portfolioLinks.linkedinUrl) portfolioLinks.linkedinUrl = data.portfolioLinks.linkedinUrl;
      if (data.portfolioLinks.websiteUrl) portfolioLinks.websiteUrl = data.portfolioLinks.websiteUrl;
      data.portfolioLinks = Object.keys(portfolioLinks).length > 0 ? portfolioLinks : null;
    } else {
      data.portfolioLinks = null;
    }

    updateProfileMutation.mutate(data);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.setAttribute('dir', newLang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', newLang);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">{t('loading')}</div>
      </div>
    );
  }

  const options = profileOptions || {};
  const heardFromOptions = options.heardFrom || [];
  const educationLevels = options.educationLevels || [];
  const currentStatusOptions = options.currentStatus || [];
  const defaultSkills = options.skills || [];
  const defaultInterests = options.interests || [];
  const countries = options.countries || [];

  // Show view mode if profile has data and not in edit mode
  const hasProfileData = profileData && (profileData.fullName4 || profileData.phone || profileData.city);
  const showViewMode = hasProfileData && !isEditMode;

  if (showViewMode) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
        {/* App Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm"
        >
        <div className="max-w-2xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {profileData?.avatar ? (
              <img
                src={getImageUrl(profileData.avatar)}
                alt={profileData.fullName4 || user?.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-primary-200"
                crossOrigin="anonymous"
                onError={(e) => {
                  console.error('Failed to load avatar in view mode header:', profileData.avatar, 'URL:', getImageUrl(profileData.avatar));
                  e.target.style.display = 'none';
                  const fallback = e.target.nextElementSibling;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            {!profileData?.avatar && (
              <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                {getInitials(profileData.fullName4 || user?.name)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 text-sm truncate">
                {profileData.fullName4 || user?.name || t('profile')}
              </h1>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition flex-shrink-0"
              aria-label={t('language')}
            >
              <Globe size={18} className="text-gray-600" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(t('confirmLogout') || 'Are you sure you want to logout?')) {
                  logout();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 transition flex-shrink-0"
              aria-label={t('logout')}
            >
              <LogOut size={18} className="text-red-600" />
            </button>
          </div>
        </div>
        </motion.div>

        <div className="flex-1 overflow-y-auto">
          <ProfileView profile={profileData} user={user} t={t} onEdit={() => setIsEditMode(true)} logout={logout} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* App Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm"
      >
        <div className="max-w-2xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              {(avatarPreview || profileData?.avatar) ? (
                <img
                  src={avatarPreview || getImageUrl(profileData.avatar)}
                  alt={fullName4 || user?.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-primary-200"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    console.error('Failed to load avatar in header:', profileData.avatar, 'URL:', getImageUrl(profileData.avatar));
                    e.target.style.display = 'none';
                    const fallback = e.target.nextElementSibling;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
              ) : null}
              {!avatarPreview && !profileData?.avatar && (
                <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                  {getInitials(fullName4 || user?.name)}
                </div>
              )}
              {isEditMode && (
                <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 transition shadow-md z-10">
                  <Camera size={12} className="text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadAvatarMutation.isLoading}
                  />
                </label>
              )}
              {uploadAvatarMutation.isLoading && (
                <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm">
                {fullName4 || user?.name || t('profile')}
              </h1>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
              aria-label={t('language')}
            >
              <Globe size={18} className="text-gray-600" />
            </button>
            <button
              onClick={() => {
                if (window.confirm(t('confirmLogout') || 'Are you sure you want to logout?')) {
                  logout();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-red-50 transition"
              aria-label={t('logout')}
            >
              <LogOut size={18} className="text-red-600" />
            </button>
          </div>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto pb-20">
        <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto px-3 py-2 space-y-2">
          {/* Help Guide */}
          <div className="mb-1.5 px-1">
            <p className="text-gray-500 text-[10px] leading-relaxed">
              {t('helpGuide.profile')}
            </p>
          </div>
        {/* Personal Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100"
        >
          <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('personalInfo')}</h2>
          <div className="space-y-1.5">
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('fullName')} ({t('atLeast4Words')})
              </label>
              <input
                {...register('fullName4')}
                placeholder={t('fullNamePlaceholder')}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('isStudent')}
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setValue('isStudent', true)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    isStudent
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t('yes')}
                </button>
                <button
                  type="button"
                  onClick={() => setValue('isStudent', false)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition ${
                    !isStudent
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t('no')}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('phone')} ({t('optional')})
              </label>
              <input
                {...register('phone')}
                type="tel"
                placeholder={t('phonePlaceholder')}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('nationality')} ({t('optional')})
              </label>
              <input
                {...register('nationality')}
                placeholder={t('nationalityPlaceholder')}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('bio')} ({t('optional')})
              </label>
              <textarea
                {...register('bio')}
                rows={2}
                placeholder={t('bioPlaceholder')}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </motion.div>

        {/* Location Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100"
        >
          <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('location')}</h2>
          <div className="space-y-1.5">
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('country')}
              </label>
              <select
                {...register('country')}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              >
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('city')}
              </label>
              <AutocompleteInput
                name="city"
                value={watch('city')}
                onChange={(e) => setValue('city', e.target.value)}
                placeholder={t('selectCity')}
                suggestionKey="city"
                country={country}
                minChars={1}
                className="text-xs"
                t={t}
              />
            </div>
          </div>
        </motion.div>

        {/* Status Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100"
        >
          <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('status')}</h2>
          <div className="space-y-1.5">
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('experienceLevel')} ({t('optional')})
              </label>
              <select
                {...register('experienceLevel')}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t('selectExperienceLevel')}</option>
                <option value="Beginner">{t('beginner')}</option>
                <option value="Intermediate">{t('intermediate')}</option>
                <option value="Advanced">{t('advanced')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                {t('currentStatus')} ({t('optional')})
              </label>
              <select
                {...register('currentStatus')}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t('selectCurrentStatus')}</option>
                {currentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </motion.div>

        {/* Education Card (Conditional) */}
        <AnimatePresence>
          {isStudent && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100 overflow-hidden"
            >
              <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('education')}</h2>
              <div className="space-y-1.5">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    {t('university')} *
                  </label>
                  <AutocompleteInput
                    name="university"
                    value={watch('university')}
                    onChange={(e) => setValue('university', e.target.value)}
                    placeholder={t('selectUniversity')}
                    suggestionKey="university"
                    country={country}
                    minChars={1}
                    className="text-xs"
                    t={t}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    {t('major')} *
                  </label>
                  <AutocompleteInput
                    name="major"
                    value={watch('major')}
                    onChange={(e) => setValue('major', e.target.value)}
                    placeholder={t('selectMajor')}
                    suggestionKey="major"
                    minChars={1}
                    className="text-xs"
                    t={t}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    {t('educationLevel')} ({t('optional')})
                  </label>
                  <select
                    {...register('educationLevel')}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">{t('selectEducationLevel')}</option>
                    {educationLevels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                    {t('graduationYear')} ({t('optional')})
                  </label>
                  <input
                    {...register('graduationYear', { valueAsNumber: true })}
                    type="number"
                    min="2000"
                    max="2100"
                    placeholder="2024"
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Skills Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100"
        >
          <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('skills')}</h2>
          <ChipPicker
            values={skills}
            onChange={(newSkills) => setValue('skills', newSkills)}
            defaults={defaultSkills}
            placeholder={t('addSkill')}
            suggestionKey="skills"
            minChars={2}
            t={t}
          />
        </motion.div>

        {/* Interests Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100"
        >
          <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('interests')}</h2>
          <ChipPicker
            values={interests}
            onChange={(newInterests) => setValue('interests', newInterests)}
            defaults={defaultInterests}
            placeholder={t('addInterest')}
            suggestionKey="interests"
            minChars={2}
            t={t}
          />
        </motion.div>

        {/* Marketing Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100"
        >
          <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('marketing')}</h2>
          <div className="space-y-1.5">
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-1">
                {t('heardFrom')} ({t('optional')})
              </label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {heardFromOptions.map((option) => {
                  const isSelected = heardFrom === option;
                  const isOther = option === 'Other';
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        if (isOther) {
                          setValue('heardFrom', '');
                        } else {
                          setValue('heardFrom', option);
                        }
                      }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition ${
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {heardFrom === 'Other' || (!heardFromOptions.includes(heardFrom) && heardFrom) ? (
                <AutocompleteInput
                  name="heardFrom"
                  value={heardFrom === 'Other' ? '' : heardFrom}
                  onChange={(e) => setValue('heardFrom', e.target.value)}
                  placeholder={t('howDidYouHearAboutUs')}
                  suggestionKey="heardFrom"
                  minChars={1}
                  className="text-xs"
                  t={t}
                />
              ) : null}
            </div>

            {heardFrom && (
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                  {t('heardFromDetails')} ({t('optional')})
                </label>
                <input
                  {...register('heardFromDetails')}
                  placeholder={t('heardFromDetailsPlaceholder')}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* Links Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg p-2.5 shadow-sm border border-gray-100"
        >
          <h2 className="text-xs font-bold text-gray-900 mb-1.5">{t('links')}</h2>
          <div className="space-y-1.5">
            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                GitHub URL
              </label>
              <input
                value={watch('portfolioLinks')?.githubUrl || ''}
                onChange={(e) => {
                  const current = watch('portfolioLinks') || {};
                  setValue('portfolioLinks', { ...current, githubUrl: e.target.value });
                }}
                type="url"
                placeholder="https://github.com/username"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                LinkedIn URL
              </label>
              <input
                value={watch('portfolioLinks')?.linkedinUrl || ''}
                onChange={(e) => {
                  const current = watch('portfolioLinks') || {};
                  setValue('portfolioLinks', { ...current, linkedinUrl: e.target.value });
                }}
                type="url"
                placeholder="https://linkedin.com/in/username"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-gray-700 mb-0.5">
                Website URL
              </label>
              <input
                value={watch('portfolioLinks')?.websiteUrl || ''}
                onChange={(e) => {
                  const current = watch('portfolioLinks') || {};
                  setValue('portfolioLinks', { ...current, websiteUrl: e.target.value });
                }}
                type="url"
                placeholder="https://yourwebsite.com"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        </motion.div>

        {/* Sticky Save Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 safe-bottom"
        >
          <div className="max-w-2xl mx-auto px-3 py-2">
            <button
              type="submit"
              disabled={updateProfileMutation.isLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 font-semibold text-xs"
            >
              <Save size={16} />
              {updateProfileMutation.isLoading ? t('saving') : t('save')}
            </button>
          </div>
        </motion.div>
        </form>
      </div>
    </div>
  );
}
