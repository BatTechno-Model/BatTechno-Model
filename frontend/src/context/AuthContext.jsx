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
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
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
      const errorMessage = error.message || 'Login failed. Please check your credentials.';
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
    // Navigate will be handled by the component calling logout
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
