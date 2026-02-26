import React from "react";

interface ChunkProgressBarProps {
  completedChunks: number;
  totalChunks?: number;
}

const ChunkProgressBar: React.FC<ChunkProgressBarProps> = ({
  completedChunks,
  totalChunks = 5
}) => {
  const verdanaStyle = { fontFamily: "'Verdana', sans-serif" };

  return (
    <div className="flex flex-col items-center space-y-3" style={verdanaStyle}>
      <div className="flex items-center space-x-2 h-8">
        {Array.from({ length: totalChunks }).map((_, i) => {
          const isCompleted = i < completedChunks;
          return (
            <div
              key={i}
              className={`w-5 h-5 rounded-md border-2 transition-all duration-700 shadow-sm ${
                isCompleted
                  ? "bg-gradient-to-br from-emerald-400 to-teal-500 border-teal-300 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-110"
                  : "bg-gray-800 border-gray-700 hover:border-gray-500"
              }`}
            />
          );
        })}
      </div>
      <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-widest">
        UNITS COMPLETE: {Math.min(completedChunks, totalChunks)} / {totalChunks}
      </span>
    </div>
  );
};

export default ChunkProgressBar;
