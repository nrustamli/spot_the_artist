import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password, displayName);
      }
      onClose();
      // Reset form
      setUsername('');
      setPassword('');
      setDisplayName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>×</button>
        
        <div className="auth-header">
          <div className="auth-icon">
            {mode === 'login' ? '🔐' : '✨'}
          </div>
          <h2 className="auth-title">
            {mode === 'login' ? 'Welcome Back' : 'Join the Hunt'}
          </h2>
          <p className="auth-subtitle">
            {mode === 'login' 
              ? 'Sign in to save your discoveries'
              : 'Create an account to track your art finds'
            }
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error">
              <span>⚠️</span>
              {error}
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              minLength={3}
              maxLength={50}
              pattern="^[a-zA-Z0-9_]+$"
              title="Letters, numbers, and underscores only"
              disabled={loading}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="displayName">Display Name (optional)</label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should we call you?"
                maxLength={100}
                disabled={loading}
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Create a password' : 'Enter password'}
              required
              minLength={6}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading">
                <span className="spinner"></span>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button onClick={switchMode} disabled={loading}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={switchMode} disabled={loading}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;

