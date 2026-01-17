import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './i18n';
import './index.css';

// Initialize i18n direction
const lang = localStorage.getItem('i18nextLng') || 'ar';
document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
document.documentElement.setAttribute('lang', lang);

// Filter out browser extension errors from console
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  // Ignore errors from browser extensions
  if (
    error?.reqInfo?.pathPrefix === '/site_integration' ||
    error?.reqInfo?.pathPrefix === '/writing' ||
    error?.message?.includes('permission error') ||
    error?.originalError?.stack?.includes('background.js')
  ) {
    event.preventDefault();
    return;
  }
  // Log other unhandled rejections for debugging
  if (process.env.NODE_ENV === 'development') {
    console.error('Unhandled promise rejection:', error);
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>
);
