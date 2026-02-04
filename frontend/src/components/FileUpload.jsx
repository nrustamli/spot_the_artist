import { useRef, useState } from 'react';
import './FileUpload.css';

function FileUpload({ onImageSelect, disabled }) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        // Convert image to JPEG for cross-browser compatibility (HEIC not supported in Chrome)
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          // Convert to JPEG for universal browser support
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);

          // Create a new file from the converted data
          canvas.toBlob((blob) => {
            if (blob) {
              const convertedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg'
              });
              onImageSelect({
                file: convertedFile,
                preview: jpegDataUrl
              });
            } else {
              // Fallback to original if conversion fails
              onImageSelect({
                file: file,
                preview: e.target.result
              });
            }
          }, 'image/jpeg', 0.9);
        };

        img.onerror = () => {
          // Fallback to original if image loading fails
          onImageSelect({
            file: file,
            preview: e.target.result
          });
        };

        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (disabled) return;
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div
      className={`file-upload ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        disabled={disabled}
        className="file-input"
      />
      
      <div className="upload-content">
        <div className="upload-icon">📤</div>
        <p className="upload-text">
          {isDragging ? 'Drop it here!' : 'Drag & drop an image'}
        </p>
        <span className="upload-subtext">or click to browse</span>
      </div>
      
      <div className="upload-border"></div>
    </div>
  );
}

export default FileUpload;

