import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Users, Award, ArrowLeft } from 'lucide-react';

export default function Landing() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.setAttribute('dir', newLang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', newLang);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-center mb-12"
        >
          <h1 className="text-3xl font-bold text-white">{t('platformName')}</h1>
          <div className="flex gap-4">
            <button
              onClick={toggleLanguage}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition"
            >
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-2 bg-white text-primary-600 rounded-lg font-medium hover:bg-gray-100 transition"
            >
              {t('login')}
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center text-white mb-16"
        >
          <h2 className="text-5xl font-bold mb-4">{t('platformTitle')}</h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            {t('platformDescription')}
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            { icon: BookOpen, title: t('featureCourseManagement'), desc: t('featureCourseManagementDesc') },
            { icon: Users, title: t('featureAttendance'), desc: t('featureAttendanceDesc') },
            { icon: Award, title: t('featureAssignments'), desc: t('featureAssignmentsDesc') },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-white/10 backdrop-blur-lg rounded-xl p-6 text-white"
            >
              <feature.icon size={40} className="mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="opacity-80">{feature.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center"
        >
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-4 bg-white text-primary-600 rounded-lg font-semibold text-lg hover:bg-gray-100 transition shadow-lg"
          >
            {t('getStarted')}
          </button>
          <p className="mt-4 text-white/70 text-[10px] max-w-md mx-auto leading-relaxed">
            {t('helpGuide.landing')}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
