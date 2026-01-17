import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, BookOpen, Calendar, FileText, User } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'home' },
  { path: '/courses', icon: BookOpen, label: 'courses' },
  { path: '/attendance', icon: Calendar, label: 'attendance' },
  { path: '/assignments', icon: FileText, label: 'assignments' },
  { path: '/profile', icon: User, label: 'profile' },
];

export default function Layout({ children }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 safe-bottom">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-bottom z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-400'
                }`}
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className="p-2"
                >
                  <Icon size={22} />
                </motion.div>
                <span className="text-xs mt-0.5">{t(item.label)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
