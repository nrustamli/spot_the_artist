import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import CameraCapture from './components/CameraCapture';
import FileUpload from './components/FileUpload';
import VerificationResult from './components/VerificationResult';
import LoadingSpinner from './components/LoadingSpinner';
import Gallery from './components/Gallery';
import AuthModal from './components/AuthModal';
import './App.css';

// API base URL - in production (same origin), use empty string
// In development with Vite proxy, also use empty string
const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const { isAuthenticated, token, refreshUser } = useAuth();
  
  const [mode, setMode] = useState('select'); // 'select', 'camera', 'upload'
  const [status, setStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [result, setResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState(null);
  
  // Gallery state
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryPage, setGalleryPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

  // Fetch gallery from API
  const fetchGallery = useCallback(async (page = 1, append = false) => {
    try {
      setGalleryLoading(true);
      const response = await fetch(`${API_URL}/api/gallery?page=${page}&per_page=20`, {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load gallery');
      }
      
      const data = await response.json();
      
      // Transform API response to match existing gallery item format
      const items = data.items.map(item => ({
        id: item.id.toString(),
        image: item.image_data,
        isVerified: item.is_verified,
        confidence: item.confidence,
        message: item.message,
        bestMatch: item.best_match,
        timestamp: item.created_at,
        username: item.username,
        displayName: item.display_name,
        userId: item.user_id,
      }));
      
      if (append) {
        setGalleryItems(prev => [...prev, ...items]);
      } else {
        setGalleryItems(items);
      }
      
      setHasMore(data.has_more);
      setGalleryPage(page);
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  // Load gallery on mount
  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  const loadMoreGallery = useCallback(() => {
    if (!galleryLoading && hasMore) {
      fetchGallery(galleryPage + 1, true);
    }
  }, [fetchGallery, galleryLoading, hasMore, galleryPage]);

  const verifyImage = useCallback(async (imageData) => {
    setImagePreview(imageData.preview);
    setImageFile(imageData.file);
    setStatus('loading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', imageData.file);

      const response = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        body: formData,
        headers: {
          // Required to bypass ngrok's browser warning page
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Verification failed');
      }

      const data = await response.json();
      setResult(data);
      setStatus('success');
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify image. Please try again.');
      setStatus('error');
    }
  }, []);

  const handleImageSelect = useCallback((imageData) => {
    verifyImage(imageData);
  }, [verifyImage]);

  const handleSaveToGallery = useCallback(async () => {
    if (!result || !imagePreview) return;

    // If not authenticated, show login modal
    if (!isAuthenticated) {
      setAuthModalMode('login');
      setShowAuthModal(true);
      return;
    }

    try {
      setStatus('loading');
      
      const response = await fetch(`${API_URL}/api/gallery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          image_data: imagePreview,
          is_verified: result.is_verified,
          confidence: result.confidence,
          message: result.message,
          best_match: result.best_match,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save to gallery');
      }

      // Refresh user stats and gallery
      await refreshUser();
      await fetchGallery();
      
      handleReset();
    } catch (err) {
      console.error('Save to gallery error:', err);
      setError(err.message || 'Failed to save to gallery. Please try again.');
      setStatus('error');
    }
  }, [result, imagePreview, isAuthenticated, token, refreshUser, fetchGallery]);

  const handleDeleteFromGallery = useCallback(async (id) => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`${API_URL}/api/gallery/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete');
      }

      // Remove from local state
      setGalleryItems(prev => prev.filter(item => item.id !== id));
      
      // Refresh user stats
      await refreshUser();
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.message || 'Failed to delete image');
    }
  }, [isAuthenticated, token, refreshUser]);

  const handleReset = useCallback(() => {
    setMode('select');
    setStatus('idle');
    setResult(null);
    setImagePreview(null);
    setImageFile(null);
    setError(null);
  }, []);

  const openAuthModal = useCallback((mode = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  }, []);

  const renderContent = () => {
    // Show result
    if (status === 'success' && result) {
      return (
        <div className="result-section">
          <VerificationResult
            result={result}
            imagePreview={imagePreview}
            onReset={handleReset}
          />
          <div className="save-actions">
            <button className="save-button" onClick={handleSaveToGallery}>
              <span>💾</span>
              <span>{isAuthenticated ? 'Save to Gallery' : 'Sign in to Save'}</span>
            </button>
            <button className="discard-button" onClick={handleReset}>
              <span>Skip</span>
            </button>
          </div>
        </div>
      );
    }

    // Show loading
    if (status === 'loading') {
      return <LoadingSpinner message="Analyzing artwork..." />;
    }

    // Show error
    if (status === 'error') {
      return (
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p className="error-text">{error}</p>
          <button className="retry-button" onClick={handleReset}>
            Try Again
          </button>
        </div>
      );
    }

    // Show input options
    return (
      <div className="input-section">
        {mode === 'select' && (
          <>
            <div className="mode-buttons">
              <button
                className="mode-button camera-mode"
                onClick={() => setMode('camera')}
              >
                <span className="mode-icon">
                  {/* Camera icon - replace with SVG */}
                  <img src="/icon-camera.svg" alt="" />
                </span>
                <span className="mode-label">Take photo</span>
              </button>
              
              <button
                className="mode-button upload-mode"
                onClick={() => setMode('upload')}
              >
                <span className="mode-icon">
                  {/* Upload icon - replace with SVG */}
                  <img src="/icon-upload.svg" alt="" />
                </span>
                <span className="mode-label">Upload</span>
              </button>
            </div>
            
            <div className="tagline-section">
              <p className="hint-text">
                Spot Anna Laurini's art on the streets of London, Paris, Rome and more!
              </p>
              <p className="hint-subtext">
                See it. Scan it. Save it.
              </p>
            </div>

            {/* Gallery Section */}
            <Gallery
              items={galleryItems}
              onItemDelete={handleDeleteFromGallery}
              loading={galleryLoading}
              hasMore={hasMore}
              onLoadMore={loadMoreGallery}
              isAuthenticated={isAuthenticated}
            />
          </>
        )}

        {mode === 'camera' && (
          <div className="capture-section">
            <button className="back-button" onClick={() => setMode('select')}>
              ← Back
            </button>
            <CameraCapture
              onImageCapture={handleImageSelect}
              disabled={status === 'loading'}
            />
          </div>
        )}

        {mode === 'upload' && (
          <div className="upload-section">
            <button className="back-button" onClick={() => setMode('select')}>
              ← Back
            </button>
            <FileUpload
              onImageSelect={handleImageSelect}
              disabled={status === 'loading'}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      <Header onLoginClick={() => openAuthModal('login')} />
      <main className="main-content">
        {renderContent()}
      </main>
      <footer className="footer">
        <p> Let's grow the street art community together • Made with ❤️ </p>
      </footer>
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}

export default App;
