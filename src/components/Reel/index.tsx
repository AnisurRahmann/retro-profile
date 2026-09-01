import React from 'react';
import StatusBar from './StatusBar';

interface PhoneFrameProps {
  children: React.ReactNode;
  /** Canvas label, top-left outside the bezel */
  label?: string;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children, label = 'SHAKIL · REELS · v1' }) => (
  <div className="stage">
    <div className="stage-meta">
      <span className="dot" />{label}
    </div>
    <div className="stage-meta-r">ar.shakil</div>
    <div className="phone">
      <div className="phone-screen">
        <StatusBar />
        {children}
      </div>
    </div>
  </div>
);

export default PhoneFrame;
