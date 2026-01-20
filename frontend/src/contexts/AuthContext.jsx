import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'spot_the_artist_token';
const USER_KEY = 'spot_the_artist_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load saved auth state on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
      // Verify token is still valid
      verifyToken(savedToken);
    }
    setLoading(false);
  }, []);

  const verifyToken = async (tokenToVerify) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${tokenToVerify}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      
      if (!response.ok) {
        // Token invalid, clear auth state
        logout();
      } else {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      }
    } catch (err) {
      console.error('Token verification failed:', err);
    }
  };

  const login = useCallback(async (username, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    
    return data.user;
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
      body: JSON.stringify({ 
        username, 
        password, 
        display_name: displayName || username 
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Registration failed');
    }

    const data = await response.json();
    setToken(data.access_token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [token]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token,
    login,
    register,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

