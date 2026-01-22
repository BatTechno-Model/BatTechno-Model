import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, GraduationCap, Briefcase, Link as LinkIcon, ExternalLink, User, Globe, Edit2, LogOut } from 'lucide-react';
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

export default function ProfileView({ profile, user, t, onEdit, logout }) {
  if (!profile) return null;

  const {
    fullName4,
    phone,
    nationality,
    bio,
    country,
    city,
    isStudent,
    university,
    major,
    educationLevel,
    graduationYear,
    experienceLevel,
    currentStatus,
    skills = [],
    interests = [],
    heardFrom,
    heardFromDetails,
    portfolioLinks,
    avatar,
  } = profile;

  return (
    <div className="max-w-2xl mx-auto px-3 py-2 space-y-2 pb-16">
      {/* Personal Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
      >
        {/* Avatar Display - Large Profile Picture */}
        <div className="flex flex-col items-center mb-4">
          {avatar ? (
            <div className="relative">
              <img
                src={getImageUrl(avatar)}
                alt={fullName4 || user?.name}
                className="w-28 h-28 rounded-full object-cover border-4 border-primary-300 shadow-xl"
                crossOrigin="anonymous"
                onError={(e) => {
                  console.error('Failed to load avatar image:', avatar, 'URL:', getImageUrl(avatar));
                  e.target.style.display = 'none';
                  const fallback = e.target.nextElementSibling;
                  if (fallback) fallback.style.display = 'flex';
                }}
                onLoad={() => {
                  console.log('Avatar image loaded successfully');
                }}
              />
              <div className="w-28 h-28 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xl shadow-xl hidden">
                {getInitials(fullName4 || user?.name)}
              </div>
            </div>
          ) : (
            <div className="w-28 h-28 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xl shadow-xl">
              {getInitials(fullName4 || user?.name)}
            </div>
          )}
          <div className="mt-3 text-center">
            <h1 className="text-lg font-bold text-gray-900">{fullName4 || user?.name || t('profile')}</h1>
            <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          {phone && (
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <Phone size={14} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{phone}</span>
            </div>
          )}
          {nationality && (
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <Globe size={14} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{nationality}</span>
            </div>
          )}
          {(country || city) && (
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <MapPin size={14} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{[city, country].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {bio && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-700 leading-relaxed line-clamp-3">{bio}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Status Card */}
      {(experienceLevel || currentStatus) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-2">{t('status')}</h2>
          <div className="space-y-1.5">
            {experienceLevel && (
              <div className="flex items-center gap-2">
                <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-700">{t(experienceLevel.toLowerCase())}</span>
              </div>
            )}
            {currentStatus && (
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-700">{currentStatus}</span>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Education Card */}
      {isStudent && (university || major) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
            <GraduationCap size={14} />
            {t('education')}
          </h2>
          <div className="space-y-1.5">
            {university && (
              <div>
                <span className="text-xs text-gray-500">{t('university')}:</span>
                <p className="text-xs text-gray-900 font-medium">{university}</p>
              </div>
            )}
            {major && (
              <div>
                <span className="text-xs text-gray-500">{t('major')}:</span>
                <p className="text-xs text-gray-900 font-medium">{major}</p>
              </div>
            )}
            {educationLevel && (
              <div>
                <span className="text-xs text-gray-500">{t('educationLevel')}:</span>
                <p className="text-xs text-gray-900">{educationLevel}</p>
              </div>
            )}
            {graduationYear && (
              <div>
                <span className="text-xs text-gray-500">{t('graduationYear')}:</span>
                <p className="text-xs text-gray-900">{graduationYear}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Skills Card */}
      {skills.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-2">{t('skills')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-medium"
              >
                {skill}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Interests Card */}
      {interests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-2">{t('interests')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((interest, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
              >
                {interest}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Marketing Card */}
      {heardFrom && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-2">{t('marketing')}</h2>
          <div className="space-y-1.5">
            <div>
              <span className="text-xs text-gray-500">{t('heardFrom')}:</span>
              <p className="text-xs text-gray-900 font-medium">{heardFrom}</p>
            </div>
            {heardFromDetails && (
              <div>
                <span className="text-xs text-gray-500">{t('heardFromDetails')}:</span>
                <p className="text-xs text-gray-700">{heardFromDetails}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Links Card */}
      {portfolioLinks && (portfolioLinks.githubUrl || portfolioLinks.linkedinUrl || portfolioLinks.websiteUrl) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg p-3 shadow-sm border border-gray-100"
        >
          <h2 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-1.5">
            <LinkIcon size={14} />
            {t('links')}
          </h2>
          <div className="space-y-1.5">
            {portfolioLinks.githubUrl && (
              <a
                href={portfolioLinks.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 transition"
              >
                <span>GitHub</span>
                <ExternalLink size={12} />
              </a>
            )}
            {portfolioLinks.linkedinUrl && (
              <a
                href={portfolioLinks.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 transition"
              >
                <span>LinkedIn</span>
                <ExternalLink size={12} />
              </a>
            )}
            {portfolioLinks.websiteUrl && (
              <a
                href={portfolioLinks.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 transition"
              >
                <span>{t('website')}</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </motion.div>
      )}

      {/* Edit and Logout Buttons */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-shrink-0 bg-white border-t border-gray-200 shadow-lg z-40"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-2xl mx-auto px-3 py-2 space-y-2">
          <button
            onClick={onEdit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold text-sm"
          >
            <Edit2 size={18} />
            {t('edit')}
          </button>
          {logout && (
            <button
              onClick={() => {
                if (window.confirm(t('confirmLogout') || 'Are you sure you want to logout?')) {
                  logout();
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm"
            >
              <LogOut size={18} />
              {t('logout')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
