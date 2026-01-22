import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.log('No access token found');
        setLoading(false);
        return;
      }

      console.log('Checking auth with token:', token.substring(0, 20) + '...');
      const { user } = await api.getMe();
      console.log('Auth check successful:', user.email);
      setUser(user);
    } catch (error) {
      console.error('Auth check failed:', error);
      
      // Don't clear tokens if it's a connection error - server might be temporarily down
      if (error.message && error.message.includes('Cannot connect to server')) {
        console.warn('Server connection failed, keeping tokens for retry');
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
      
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('Attempting login for:', email);
      const { user, accessToken, refreshToken } = await api.login(email, password);
      console.log('Login successful:', user.email);
      console.log('Access token received:', accessToken ? accessToken.substring(0, 20) + '...' : 'null');
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      // Verify token was saved
      const savedToken = localStorage.getItem('accessToken');
      console.log('Token saved to localStorage:', savedToken ? savedToken.substring(0, 20) + '...' : 'null');
      
      setUser(user);
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = error.message || 'Login failed. Please check your credentials.';
      
      // Provide more helpful error messages
      if (error.message && error.message.includes('Cannot connect to server')) {
        errorMessage = 'Cannot connect to server. Please make sure the backend server is running on port 5000.';
      } else if (error.message && error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your internet connection and ensure the backend server is running.';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const register = async (data) => {
    try {
      const { user, accessToken, refreshToken } = await api.register(data);
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    // Redirect to landing page after logout
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
