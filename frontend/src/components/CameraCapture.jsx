import { useRef, useState, useEffect, useCallback } from 'react';
import './CameraCapture.css';

function CameraCapture({ onImageCapture, disabled }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      
      // Stop any existing stream
      stopCamera();
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);
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
      if (blob) {
        const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
        const preview = canvas.toDataURL('image/jpeg');
        
        onImageCapture({
          file: file,
          preview: preview
        });
        
        // Stop camera after capture
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  }, [onImageCapture, stopCamera]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isActive) {
      startCamera();
    }
  }, [facingMode]);

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
        <button className="retry-button" onClick={() => setError(null)}>
          Try Again
        </button>
      </div>
    );
  }

  if (!isActive) {
    return (
      <button 
        className="camera-start-button"
        onClick={startCamera}
        disabled={disabled}
      >
        <span className="camera-icon">📸</span>
        <span className="camera-text">Open Camera</span>
      </button>
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
      </div>
      
      <canvas ref={canvasRef} className="capture-canvas" />
      
      <div className="camera-controls">
        <button 
          className="camera-control-button flip-button"
          onClick={toggleFacingMode}
          title="Flip camera"
        >
          🔄
        </button>
        
        <button 
          className="capture-button"
          onClick={captureImage}
          disabled={disabled}
        >
          <span className="capture-ring"></span>
        </button>
        
        <button 
          className="camera-control-button close-button"
          onClick={stopCamera}
          title="Close camera"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default CameraCapture;

