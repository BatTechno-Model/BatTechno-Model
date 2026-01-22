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
  const isExtensionError = 
    error?.reqInfo?.pathPrefix === '/site_integration' ||
    error?.reqInfo?.pathPrefix === '/writing' ||
    error?.message?.includes('permission error') ||
    error?.originalError?.stack?.includes('background.js') ||
    (error?.code === 403 && error?.httpStatus === 200) || // Extension errors often have code 403
    (error?.name === 'n' && error?.httpError === false && error?.httpStatus === 200) || // Common extension error pattern
    error?.stack?.includes('content.js') || // Content script errors
    error?.stack?.includes('requests.js') || // Extension request errors
    error?.stack?.includes('traffic.js') || // Extension traffic errors
    (typeof error === 'object' && error?.name === 'n' && error?.httpError === false && error?.code === 403); // Specific pattern from error
  
  if (isExtensionError) {
    event.preventDefault();
    return;
  }
  
  // Log other unhandled rejections for debugging (only in development)
  if (process.env.NODE_ENV === 'development' && !isExtensionError) {
    console.error('Unhandled promise rejection:', error);
  }
});

// Also filter console errors from extensions
const originalConsoleError = console.error;
console.error = (...args) => {
  const errorString = args.join(' ');
  const isExtensionError = 
    errorString.includes('content.js') ||
    errorString.includes('requests.js') ||
    errorString.includes('traffic.js') ||
    errorString.includes('Extension context invalidated');
  
  if (!isExtensionError) {
    originalConsoleError.apply(console, args);
  }
};

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
