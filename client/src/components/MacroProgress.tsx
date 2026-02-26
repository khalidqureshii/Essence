import React from 'react';

interface MacroProgressProps {
  completedChunks: number;
}

const MacroProgress: React.FC<MacroProgressProps> = ({ completedChunks }) => {
  const totalChunks = 15;
  
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="flex items-center space-x-1.5 h-6">
        {Array.from({ length: totalChunks }).map((_, i) => {
          const isCompleted = i < completedChunks;
          return (
            <div
              key={i}
              className={`w-4 h-4 rounded-sm border transition-all duration-500 shadow-sm ${
                isCompleted 
                  ? "bg-primary border-primary shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                  : "bg-card border-border"
              }`}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-tighter">
        Overall Evaluation: {completedChunks}/{totalChunks} Units
      </span>
    </div>
  );
};

export default MacroProgress;
