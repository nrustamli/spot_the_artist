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
  const { user, isAuthenticated, token, refreshUser, verifyEmail } = useAuth();
  
  // Email verification state
  const [emailVerificationStatus, setEmailVerificationStatus] = useState(null); // null, 'verifying', 'success', 'error'
  const [emailVerificationMessage, setEmailVerificationMessage] = useState('');
  
  const [mode, setMode] = useState('select'); // 'select', 'camera', 'upload'
  const [status, setStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'
  const [result, setResult] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState(null);
  const [pendingAutoSave, setPendingAutoSave] = useState(false);
  
  // Page state
  const [activePage, setActivePage] = useState('home'); // 'home', 'my-gallery'
  const [pendingPage, setPendingPage] = useState(null);

  // Gallery state (public)
  const [galleryItems, setGalleryItems] = useState([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryPage, setGalleryPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Gallery state (user-specific)
  const [userGalleryItems, setUserGalleryItems] = useState([]);
  const [userGalleryLoading, setUserGalleryLoading] = useState(true);
  const [userGalleryPage, setUserGalleryPage] = useState(1);
  const [userHasMore, setUserHasMore] = useState(false);
  
  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

  const buildGalleryUrl = (page, userId) => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: '20',
    });
    if (userId) {
      params.set('user_id', userId.toString());
    }
    return `${API_URL}/api/gallery?${params.toString()}`;
  };

  // Fetch public gallery from API
  const fetchGallery = useCallback(async (page = 1, append = false) => {
    try {
      setGalleryLoading(true);
      const response = await fetch(buildGalleryUrl(page), {
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

  // Fetch user-specific gallery from API
  const fetchUserGallery = useCallback(async (page = 1, append = false, userId = null) => {
    if (!userId) {
      setUserGalleryItems([]);
      setUserHasMore(false);
      setUserGalleryPage(1);
      setUserGalleryLoading(false);
      return;
    }

    try {
      setUserGalleryLoading(true);
      const response = await fetch(buildGalleryUrl(page, userId), {
        headers: {
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load gallery');
      }

      const data = await response.json();

      const items = data.items.map(item => ({
        id: item.id.toString(),
        image: item.image_data,
        isVerified: item.is_verified,
        confidence: item.confidence,
        message: item.message,
        bestMatch: item.best_match,
        timestamp: item.created_at,
        username: item.username,
        userId: item.user_id,
      }));

      if (append) {
        setUserGalleryItems(prev => [...prev, ...items]);
      } else {
        setUserGalleryItems(items);
      }

      setUserHasMore(data.has_more);
      setUserGalleryPage(page);
    } catch (err) {
      console.error('Failed to fetch user gallery:', err);
    } finally {
      setUserGalleryLoading(false);
    }
  }, []);

  // Load public gallery on mount
  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  // Load user gallery when needed
  useEffect(() => {
    if (activePage === 'my-gallery' && user?.id) {
      fetchUserGallery(1, false, user.id);
    }
  }, [activePage, user?.id, fetchUserGallery]);

  // Navigate to pending page after login
  useEffect(() => {
    if (pendingPage && isAuthenticated) {
      setActivePage(pendingPage);
      setPendingPage(null);
    }
  }, [pendingPage, isAuthenticated]);

  // Return to home if user logs out while on personal page
  useEffect(() => {
    if (!isAuthenticated && activePage === 'my-gallery') {
      setActivePage('home');
    }
  }, [isAuthenticated, activePage]);

  // Handle email verification from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verificationToken = params.get('token');
    const isVerifyPage = window.location.pathname === '/verify-email';
    
    if (isVerifyPage && verificationToken) {
      setEmailVerificationStatus('verifying');
      
      verifyEmail(verificationToken)
        .then(() => {
          setEmailVerificationStatus('success');
          setEmailVerificationMessage('Your email has been verified! You are now logged in.');
          // Clean up URL
          window.history.replaceState({}, '', '/');
        })
        .catch((err) => {
          setEmailVerificationStatus('error');
          setEmailVerificationMessage(err.message || 'Verification failed. Please try again.');
        });
    }
  }, [verifyEmail]);

  const loadMoreGallery = useCallback(() => {
    if (!galleryLoading && hasMore) {
      fetchGallery(galleryPage + 1, true);
    }
  }, [fetchGallery, galleryLoading, hasMore, galleryPage]);

  const loadMoreUserGallery = useCallback(() => {
    if (!userGalleryLoading && userHasMore && user?.id) {
      fetchUserGallery(userGalleryPage + 1, true, user.id);
    }
  }, [fetchUserGallery, userGalleryLoading, userHasMore, userGalleryPage, user?.id]);

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

      if (data.is_verified) {
        setPendingAutoSave(true);
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err.message || 'Failed to verify image. Please try again.');
      setStatus('error');
    }
  }, []);

  const handleImageSelect = useCallback((imageData) => {
    verifyImage(imageData);
  }, [verifyImage]);

  const handleSaveToGallery = useCallback(async ({ resultOverride, previewOverride, auto = false } = {}) => {
    const resultToSave = resultOverride || result;
    const previewToSave = previewOverride || imagePreview;

    if (!resultToSave || !previewToSave) return;
    if (!resultToSave.is_verified) return;

    // If not authenticated, show login modal
    if (!isAuthenticated) {
      setAuthModalMode('login');
      setShowAuthModal(true);
      if (auto) {
        setPendingAutoSave(true);
      }
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
          image_data: previewToSave,
          is_verified: resultToSave.is_verified,
          confidence: resultToSave.confidence,
          message: resultToSave.message,
          best_match: resultToSave.best_match,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to save to gallery');
      }

      // Refresh user stats and galleries
      await refreshUser();
      await fetchGallery();
      await fetchUserGallery(1, false, user?.id);
      
      setPendingAutoSave(false);
      handleReset();
    } catch (err) {
      console.error('Save to gallery error:', err);
      setError(err.message || 'Failed to save to gallery. Please try again.');
      setStatus('error');
    }
  }, [result, imagePreview, isAuthenticated, token, refreshUser, fetchGallery, fetchUserGallery, user?.id]);

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
      setUserGalleryItems(prev => prev.filter(item => item.id !== id));
      
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
    setPendingAutoSave(false);
  }, []);

  useEffect(() => {
    if (!pendingAutoSave || !isAuthenticated) return;
    if (!result || !imagePreview) return;
    if (!result.is_verified) {
      setPendingAutoSave(false);
      return;
    }

    handleSaveToGallery({
      resultOverride: result,
      previewOverride: imagePreview,
      auto: true,
    });
  }, [pendingAutoSave, result, imagePreview, isAuthenticated, handleSaveToGallery]);

  const openAuthModal = useCallback((mode = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  }, []);

  const openMyGallery = useCallback(() => {
    if (!isAuthenticated) {
      setAuthModalMode('login');
      setShowAuthModal(true);
      setPendingPage('my-gallery');
      return;
    }
    setActivePage('my-gallery');
  }, [isAuthenticated]);

  const openExploreGallery = useCallback(() => {
    setActivePage('home');
  }, []);

  const renderContent = () => {
    if (activePage === 'my-gallery') {
      return (
        <div className="page-section">
          <div className="page-header">
            <button className="back-button" onClick={() => setActivePage('home')}>
              ← Back to Explore
            </button>
            <div className="page-title">My Gallery</div>
            <p className="page-subtitle">Only the artworks you spotted</p>
          </div>

          <Gallery
            items={userGalleryItems}
            onItemDelete={handleDeleteFromGallery}
            loading={userGalleryLoading}
            hasMore={userHasMore}
            onLoadMore={loadMoreUserGallery}
            isAuthenticated={isAuthenticated}
            emptyTitle="No artworks in your gallery yet"
            emptySubtitle="Save your verified spots to see them here."
          />
        </div>
      );
    }

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
            {result.is_verified && (
              <button className="save-button" onClick={handleSaveToGallery}>
                <span>💾</span>
                <span>{isAuthenticated ? 'Save to Gallery' : 'Sign in to Save'}</span>
              </button>
            )}
            <button className="discard-button" onClick={handleReset}>
              <span>{result.is_verified ? 'Skip' : 'Back'}</span>
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
              autoStart
              onClose={() => setMode('select')}
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

  // Render email verification banner
  const renderVerificationBanner = () => {
    if (!emailVerificationStatus) return null;
    
    if (emailVerificationStatus === 'verifying') {
      return (
        <div className="verification-banner verification-loading">
          <span className="verification-spinner"></span>
          Verifying your email...
        </div>
      );
    }
    
    if (emailVerificationStatus === 'success') {
      return (
        <div className="verification-banner verification-success">
          <span>✅</span>
          {emailVerificationMessage}
          <button onClick={() => setEmailVerificationStatus(null)}>×</button>
        </div>
      );
    }
    
    if (emailVerificationStatus === 'error') {
      return (
        <div className="verification-banner verification-error">
          <span>❌</span>
          {emailVerificationMessage}
          <button onClick={() => setEmailVerificationStatus(null)}>×</button>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="app">
      <Header
        onLoginClick={() => openAuthModal('login')}
        onMyGalleryClick={openMyGallery}
        onExploreClick={openExploreGallery}
      />
      {renderVerificationBanner()}
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
