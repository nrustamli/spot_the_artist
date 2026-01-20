import './LoadingSpinner.css';

function LoadingSpinner({ message = 'Analyzing...' }) {
  return (
    <div className="loading-container">
      <div className="scanning-animation">
        <div className="scan-frame">
          <div className="scan-line"></div>
        </div>
        <div className="scan-icon">🎨</div>
      </div>
      <p className="loading-message">{message}</p>
      <div className="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

export default LoadingSpinner;

