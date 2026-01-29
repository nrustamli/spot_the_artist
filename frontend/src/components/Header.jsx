import UserMenu from './UserMenu';
import './Header.css';

function Header({ onLoginClick, onMyGalleryClick, onExploreClick }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-right">
          <UserMenu
            onLoginClick={onLoginClick}
            onMyGalleryClick={onMyGalleryClick}
            onExploreClick={onExploreClick}
          />
        </div>
      </div>
      
      <div className="logo-section">
        <div className="logo-container">
          {/* Logo image - replace src with your SVG path */}
          <img 
            src="/logo-lips.svg" 
            alt="Anna Laurini" 
            className="logo-lips"
          />
          <img 
            src="/logo-text.svg" 
            alt="Anna Laurini" 
            className="logo-text-image"
          />
        </div>
      </div>
    </header>
  );
}

export default Header;
