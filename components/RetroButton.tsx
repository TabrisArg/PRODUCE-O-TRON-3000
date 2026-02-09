
import React from 'react';

interface RetroButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}

const RetroButton: React.FC<RetroButtonProps> = ({ children, onClick, className = "", active = false }) => {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-1 win95-bg text-black active:retro-inset
        transition-all transform active:translate-y-0.5
        ${active ? 'retro-inset shadow-inner' : 'retro-beveled'}
        ${className}
      `}
      style={{ minWidth: '120px' }}
    >
      <span className="flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};

export default RetroButton;
