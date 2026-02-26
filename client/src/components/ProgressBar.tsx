import React from 'react';

interface ProgressBarProps {
  progress: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  return (
    <div className="w-[300px] flex flex-col items-center">
      <div className="w-full bg-secondary/50 rounded-full h-2.5 overflow-hidden border border-border shadow-inner px-[1px]">
        <div 
          className="bg-primary h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(20,184,166,0.5)]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-center w-full mt-1">
        <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-tighter">
          {Math.round(progress)}% Complete
        </span>
      </div>
    </div>
  );
};

export default ProgressBar;
