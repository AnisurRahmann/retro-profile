import React from 'react';
import StatusBar from './StatusBar';

interface PhoneFrameProps {
  children: React.ReactNode;
}

const PhoneFrame: React.FC<PhoneFrameProps> = ({ children }) => (
  <div className="stage">
    <div className="stage-meta">
      <span className="dot" />SHAKIL &middot; REELS &middot; v1
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
