import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Gallery.css';

// Array of border colors to cycle through
const BORDER_COLORS = [
  'var(--border-red)',
  'var(--border-orange)',
  'var(--border-pink)',
  'var(--border-blue)',
  'var(--border-yellow)',
  
];

function Gallery({
  items,
  onItemDelete,
  loading,
  hasMore,
  onLoadMore,
  isAuthenticated,
  emptyTitle = 'No artworks spotted yet',
  emptySubtitle = 'Be the first to discover and share!',
}) {
  const [selectedItem, setSelectedItem] = useState(null);
  const { user } = useAuth();

  if (loading && items.length === 0) {
    return (
      <div className="gallery-empty">
        <div className="gallery-loading">
          <div className="gallery-spinner"></div>
          <p>Loading gallery...</p>
        </div>
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="gallery-empty">
        <div className="empty-icon">🖼️</div>
        <p className="empty-text">{emptyTitle}</p>
        <p className="empty-subtext">{emptySubtitle}</p>
      </div>
    );
  }

  const handleItemClick = (item) => {
    setSelectedItem(item);
  };

  const closeModal = () => {
    setSelectedItem(null);
  };

  // Check if current user can delete an item
  const canDelete = (item) => {
    return isAuthenticated && user && user.id === item.userId;
  };

  // Format date to DD.MM.YYYY
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Get border color for item based on index
  const getBorderColor = (index) => {
    return BORDER_COLORS[index % BORDER_COLORS.length];
  };

  return (
    <>
      <div className="gallery">
        <div className="gallery-grid">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="gallery-card"
              style={{ '--card-border-color': getBorderColor(index) }}
              onClick={() => handleItemClick(item)}
            >
              <div className="gallery-card-image">
                <img src={item.image} alt="Street art" />
              </div>
              <div className="gallery-card-info">
                <span className="card-username">
                  {item.username || 'Anonymous'}
                </span>
                <div className="card-location">
                  <img src="/icon-location.svg" alt="" className="location-icon" />
                  <span>London</span>
                </div>
                <span className="card-date">{formatDate(item.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="gallery-load-more">
            <button 
              className="load-more-button" 
              onClick={onLoadMore}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="button-spinner"></span>
                  Loading...
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="gallery-modal" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>×</button>
            
            <img src={selectedItem.image} alt="Street art" className="modal-image" />
            
            <div className="modal-details">
              <div className="modal-user">
                <span className="user-avatar-small">
                  {(selectedItem.username || 'U')[0].toUpperCase()}
                </span>
                <span className="user-name-text">
                  {selectedItem.username}
                </span>
              </div>

              <div className={`modal-status ${selectedItem.isVerified ? 'verified' : 'rejected'}`}>
                {selectedItem.isVerified ? '✅ Verified Anna Laurini' : '❌ Not Recognized'}
              </div>
              
              <div className="modal-confidence">
                <span className="confidence-label">Confidence</span>
                <div className="confidence-bar-container">
                  <div 
                    className="confidence-bar" 
                    style={{ width: `${selectedItem.confidence}%` }}
                  ></div>
                </div>
                <span className="confidence-value">{selectedItem.confidence}%</span>
              </div>
              
              <div className="modal-date">
                📅 {new Date(selectedItem.timestamp).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              
              {canDelete(selectedItem) && (
                <button 
                  className="modal-delete"
                  onClick={() => {
                    onItemDelete(selectedItem.id);
                    closeModal();
                  }}
                >
                  🗑️ Remove from gallery
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Gallery;
