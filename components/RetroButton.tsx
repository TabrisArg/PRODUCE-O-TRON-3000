
import React from 'react';

interface RetroButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}

const RetroButton: React.FC<RetroButtonProps> = ({ children, onClick, className = "", active = false, disabled = false, title }) => {
  return (
    <button
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      title={title}
      className={`
        px-4 py-1 text-black active:retro-inset
        transition-all transform active:translate-y-0.5
        ${active ? 'retro-inset shadow-inner' : 'retro-beveled'}
        ${disabled ? 'bg-[#909090] text-gray-700 opacity-60 grayscale cursor-not-allowed pointer-events-none' : 'win95-bg hover:brightness-110 active:brightness-90'}
        ${className}
      `}
    >
      <span className="flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};

export default RetroButton;
