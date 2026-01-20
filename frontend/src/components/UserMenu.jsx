import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserMenu.css';

function UserMenu({ onLoginClick }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isAuthenticated) {
    return (
      <button className="login-button" onClick={onLoginClick}>
        <img src="/icon-user.svg" alt="" className="login-icon" />
      </button>
    );
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button 
        className="user-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="user-avatar">
          {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
        </div>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-avatar">
              {(user?.display_name || user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="dropdown-user-info">
              <span className="dropdown-name">{user?.display_name || user?.username}</span>
              <span className="dropdown-username">@{user?.username}</span>
            </div>
          </div>
          
          <div className="dropdown-stats">
            <div className="stat-item">
              <span className="stat-value">{user?.arts_spotted || 0}</span>
              <span className="stat-label">Spotted</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{user?.verified_spots || 0}</span>
              <span className="stat-label">Verified</span>
            </div>
          </div>

          <div className="dropdown-divider"></div>

          <button className="dropdown-item logout" onClick={() => {
            logout();
            setIsOpen(false);
          }}>
            <span>🚪</span>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
