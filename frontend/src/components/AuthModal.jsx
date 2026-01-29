import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthModal.css';

function AuthModal({ isOpen, onClose, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  const { login, register, resendVerification } = useAuth();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setVerificationSent(false);
      setResendSuccess(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(username, password);
        onClose();
        resetForm();
      } else {
        const result = await register(username, email, password);
        if (result.requiresVerification) {
          setVerificationSent(true);
          setVerificationEmail(result.email);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setError('');
    setResendSuccess(false);
    
    try {
      await resendVerification(verificationEmail);
      setResendSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setVerificationSent(false);
    setVerificationEmail('');
    setResendSuccess(false);
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setVerificationSent(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Show verification sent message
  if (verificationSent) {
    return (
      <div className="auth-modal-overlay" onClick={handleClose}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <button className="auth-close" onClick={handleClose}>×</button>
          
          <div className="auth-header">
            <div className="auth-icon">📧</div>
            <h2 className="auth-title">Check Your Email</h2>
            <p className="auth-subtitle">
              We've sent a verification link to:
            </p>
            <p className="auth-email-highlight">{verificationEmail}</p>
          </div>

          <div className="auth-verification-info">
            <p>Click the link in the email to verify your account and start hunting for art!</p>
            <p className="auth-verification-note">
              Don't see it? Check your spam folder.
            </p>
          </div>

          {error && (
            <div className="auth-error">
              <span>⚠️</span>
              {error}
            </div>
          )}

          {resendSuccess && (
            <div className="auth-success">
              <span>✅</span>
              Verification email sent!
            </div>
          )}

          <div className="auth-verification-actions">
            <button 
              className="auth-resend"
              onClick={handleResendVerification}
              disabled={resendLoading}
            >
              {resendLoading ? 'Sending...' : 'Resend Email'}
            </button>
            <button 
              className="auth-submit"
              onClick={() => {
                setVerificationSent(false);
                setMode('login');
              }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={handleClose}>×</button>
        
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

          {mode === 'login' ? (
            <div className="auth-field">
              <label htmlFor="username">Username or Email</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username or email"
                required
                disabled={loading}
              />
            </div>
          ) : (
            <>
              <div className="auth-field">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  required
                  minLength={3}
                  maxLength={50}
                  pattern="^[a-zA-Z0-9_]+$"
                  title="Letters, numbers, and underscores only"
                  disabled={loading}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                />
              </div>
            </>
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

