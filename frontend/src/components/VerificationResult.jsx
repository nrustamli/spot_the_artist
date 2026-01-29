import { useState, useEffect } from 'react';
import './VerificationResult.css';

function VerificationResult({ result, imagePreview, onReset }) {
  const [showResult, setShowResult] = useState(false);
  const [meterValue, setMeterValue] = useState(0);

  useEffect(() => {
    // Animate the result appearing
    const timer1 = setTimeout(() => setShowResult(true), 100);
    
    // Animate the confidence meter
    const timer2 = setTimeout(() => {
      setMeterValue(result.confidence);
    }, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [result.confidence]);

  const getStatusClass = () => (result.is_verified ? 'verified' : 'rejected');

  const getStatusIcon = () => (result.is_verified ? '✅' : '❌');

  const getMeterColor = () =>
    result.confidence >= 80 ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div className={`verification-result ${showResult ? 'visible' : ''}`}>
      {imagePreview && (
        <div className="result-image-container">
          <img src={imagePreview} alt="Uploaded artwork" className="result-image" />
          <div className={`result-badge ${getStatusClass()}`}>
            {getStatusIcon()}
          </div>
        </div>
      )}

      <div className="result-content">
        <div className={`result-status ${getStatusClass()}`}>
          <span className="status-icon">{getStatusIcon()}</span>
          <span className="status-text">
            {result.is_verified ? 'Verified!' : 'Not Recognized'}
          </span>
        </div>

        <div className="confidence-section">
          <div className="confidence-header">
            <span className="confidence-label">Confidence</span>
          </div>
          <div className="confidence-meter">
            <div
              className="confidence-fill"
              style={{
                width: `${meterValue}%`,
                backgroundColor: getMeterColor()
              }}
            />
          </div>
        </div>

        <p className="result-message">{result.message}</p>

        <button className="try-again-button" onClick={onReset}>
          <span>🔍</span>
          <span>Scan Another</span>
        </button>
      </div>
    </div>
  );
}

export default VerificationResult;

