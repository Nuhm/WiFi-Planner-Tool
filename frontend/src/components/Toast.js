import React, { useEffect, useState } from 'react';
import '../styles/Toast.css';

function Toast({ message, onClose, duration = 3000 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(hideTimer);
  }, [duration]);

  // Give the exit animation time to play before actually removing
  useEffect(() => {
    if (!visible) {
      const removeTimer = setTimeout(() => {
        onClose();
      }, 300); // Match your fade-out animation duration
      return () => clearTimeout(removeTimer);
    }
  }, [visible, onClose]);

  return (
    <div className={`toast ${visible ? 'toast--visible' : 'toast--hidden'}`}>
      {message}
    </div>
  );
}

export default Toast;
