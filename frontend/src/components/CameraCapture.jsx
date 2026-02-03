import { useRef, useState, useEffect, useCallback } from 'react';
import './CameraCapture.css';

function CameraCapture({ onImageCapture, disabled, autoStart = false, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const hasAutoStartedRef = useRef(false);

  const [isActive, setIsActive] = useState(false);
  const [isStarting, setIsStarting] = useState(autoStart);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [capturedImage, setCapturedImage] = useState(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
    setIsStarting(false);
  }, []);

  const startCamera = useCallback(async (facingModeOverride) => {
    try {
      setError(null);

      // Stop any existing stream
      stopCamera();
      setIsStarting(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingModeOverride ?? facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
        setIsStarting(false);
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions.');
      } else if (err.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Unable to access camera. Please try again.');
      }
      setIsActive(false);
      setIsStarting(false);
    }
  }, [facingMode, stopCamera]);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('Failed to capture image. Please try again.');
        return;
      }

      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      const preview = canvas.toDataURL('image/jpeg');

      setCapturedImage({
        file,
        preview
      });

      // Stop camera after capture
      stopCamera();
    }, 'image/jpeg', 0.9);
  }, [stopCamera]);

  const handleUpload = useCallback(() => {
    if (!capturedImage) return;
    onImageCapture(capturedImage);
  }, [capturedImage, onImageCapture]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    setError(null);
    startCamera();
  }, [startCamera]);

  const toggleFacingMode = useCallback(() => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  }, [facingMode, startCamera]);

  // Auto-start when entering camera mode
  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      startCamera();
    }
  }, [autoStart, startCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (error) {
    return (
      <div className="camera-error">
        <div className="error-icon">📷</div>
        <p className="error-message">{error}</p>
        <button className="retry-button" onClick={startCamera}>
          Try Again
        </button>
      </div>
    );
  }

  if (capturedImage) {
    return (
      <div className="camera-container">
        <div className="camera-preview">
          <img
            src={capturedImage.preview}
            alt="Captured artwork"
            className="camera-preview-image"
          />
        </div>
        <div className="camera-review-actions">
          <button
            className="camera-action-button upload-button"
            onClick={handleUpload}
            disabled={disabled}
          >
            Upload
          </button>
          <button
            className="camera-action-button retake-button"
            onClick={handleRetake}
            disabled={disabled}
          >
            Retake
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="camera-container">
      <div className="camera-viewfinder">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-video"
        />
        <div className="viewfinder-overlay">
          <div className="corner top-left"></div>
          <div className="corner top-right"></div>
          <div className="corner bottom-left"></div>
          <div className="corner bottom-right"></div>
        </div>
        {!isActive && (
          <div className="camera-placeholder">
            <div className="camera-placeholder-icon">📷</div>
            <p className="camera-placeholder-text">
              {isStarting ? 'Starting camera...' : 'Camera ready. Tap Start to begin.'}
            </p>
            {!isStarting && (
              <button
                className="retry-button"
                onClick={startCamera}
                disabled={disabled}
              >
                Start Camera
              </button>
            )}
          </div>
        )}
      </div>
      
      <canvas ref={canvasRef} className="capture-canvas" />
      
      <div className="camera-controls">
        <button 
          className="camera-control-button flip-button"
          onClick={toggleFacingMode}
          title="Flip camera"
          disabled={!isActive || isStarting}
        >
          🔄
        </button>
        
        <button 
          className="capture-button"
          onClick={captureImage}
          disabled={disabled || !isActive || isStarting}
        >
          <span className="capture-ring"></span>
        </button>
        
        <button 
          className="camera-control-button close-button"
          onClick={() => {
            stopCamera();
            if (onClose) {
              onClose();
            }
          }}
          title="Close camera"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default CameraCapture;

