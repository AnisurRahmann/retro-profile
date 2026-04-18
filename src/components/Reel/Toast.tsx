import React, { useEffect } from 'react';

interface ToastProps {
  msg: string;
  onDone: () => void;
}

const Toast: React.FC<ToastProps> = ({ msg, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return <div className="toast">{msg}</div>;
};

export default Toast;
