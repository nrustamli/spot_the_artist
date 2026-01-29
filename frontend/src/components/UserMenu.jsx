import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './UserMenu.css';

function UserMenu({ onLoginClick, onMyGalleryClick, onExploreClick }) {
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
        Sign In
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
          {(user?.username || 'U')[0].toUpperCase()}
        </div>
        <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <div className="dropdown-avatar">
              {(user?.username || 'U')[0].toUpperCase()}
            </div>
            <div className="dropdown-user-info">
              <span className="dropdown-name">{user?.username}</span>
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

          <button
            className="dropdown-item"
            onClick={() => {
              onExploreClick?.();
              setIsOpen(false);
            }}
          >
            <span>🌍</span>
            Explore Gallery
          </button>

          <button
            className="dropdown-item"
            onClick={() => {
              onMyGalleryClick?.();
              setIsOpen(false);
            }}
          >
            <span>🖼️</span>
            My Gallery
          </button>

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
