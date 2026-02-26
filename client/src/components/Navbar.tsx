import React from "react";
import ChunkProgressBar from "./ChunkProgressBar";

interface NavbarProps {
  status: "INACTIVE" | "ACTIVE" | "RESPONDING";
  isRecording: boolean;
  autoplayResponses: boolean;
  onToggleAutoplay: () => void;
  onGenerateReport: () => void;
  onExportPDF: () => void;
  macroCompletedChunks: number;
  sectionLabel: string;
  sectionProgress: number;
}

const Navbar: React.FC<NavbarProps> = ({
  status,
  isRecording,
  autoplayResponses,
  onToggleAutoplay,
  onGenerateReport,
  onExportPDF,
  macroCompletedChunks,
  sectionLabel,
  sectionProgress
}) => {
  const verdanaStyle = { fontFamily: "'Verdana', sans-serif" };

  return (
    <header 
      className="h-28 px-6 text-center border-b border-gray-700 shadow-xl flex-shrink-0 flex justify-between items-center transition-all duration-500 overflow-hidden bg-gray-900/80 backdrop-blur-md"
      style={{ 
        borderColor: status === "ACTIVE" ? "#14b8a6" : status === "RESPONDING" ? "#3b82f6" : "#374151",
        ...verdanaStyle
      }}
    >
      {/* Left: Brand */}
      <div className="w-[200px] flex-shrink-0 flex items-center">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 tracking-tighter filter drop-shadow-[0_0_10px_rgba(20,184,166,0.2)]">
          Essence
        </h1>
      </div>

      {/* Center: Consolidated Horizontal Progress */}
      <div className="flex-1 flex flex-row items-center justify-center space-x-12 px-12">
        
        {/* Left Part: Macro Progress */}
        <div className="flex flex-col items-center justify-center space-y-2 py-2">
            <div className="transform scale-110">
                <ChunkProgressBar completedChunks={macroCompletedChunks} />
            </div>
        </div>

        {/* Vertical Divider */}
        <div className="h-14 w-[1px] bg-gray-700/50" />

        {/* Right Part: Micro Progress & Phase */}
        <div className="flex flex-col items-center justify-center space-y-3 min-w-[320px]">
            <div className="flex items-center space-x-2.5">
                <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px] ${status === "RESPONDING" ? "bg-blue-400 shadow-blue-400/50" : "bg-teal-500 shadow-teal-500/50"}`} />
                <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-gray-300">
                    Phase: <span className="text-teal-400 ml-1.5">{sectionLabel}</span>
                </span>
            </div>
            
            <div className="w-full bg-gray-800/80 rounded-full h-2 overflow-hidden border border-gray-600/50 shadow-inner px-[0.5px]">
                <div
                    className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(20,184,166,0.4)]"
                    style={{ width: `${Math.min(Math.max(sectionProgress, 0), 100)}%` }}
                />
            </div>
            <div className="flex justify-center w-full">
                <span className="text-[11px] text-teal-500/80 font-bold uppercase tracking-widest">
                    {Math.round(sectionProgress)}% DONE
                </span>
            </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="w-[300px] flex-shrink-0 flex justify-end">
        {isRecording ? (
          <div className="flex items-center space-x-3 bg-red-500/10 px-6 py-3 rounded-xl border border-red-500/30 animate-pulse">
            <div className="w-3 h-3 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.9)]"></div>
            <span className="text-[13px] text-red-500 font-bold tracking-[0.2em]">RECORDING</span>
          </div>
        ) : (
          <div className="flex items-center space-x-5">
            {/* Premium Autoplay Toggle */}
            <div className="flex flex-col items-center space-y-1.5">
                <button 
                  onClick={onToggleAutoplay}
                  className={`relative w-11 h-6 transition-colors duration-300 rounded-full border border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${autoplayResponses ? "bg-teal-600/80" : "bg-gray-800"}`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-[1.125rem] h-[1.125rem] bg-white rounded-full transition-transform duration-300 shadow-md ${autoplayResponses ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest select-none">
                    Auto-play
                </span>
            </div>

            <div className="h-10 w-[1px] bg-gray-700/50" />
            <button
              onClick={onGenerateReport}
              className="text-[11px] px-5 py-2.5 rounded-xl bg-teal-600/10 hover:bg-teal-600 border border-teal-500/30 text-teal-300 hover:text-white font-bold uppercase tracking-widest transition-all shadow-md active:scale-95"
            >
              Report
            </button>
            <button
              onClick={onExportPDF}
              className="text-[11px] px-5 py-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 border border-gray-600/50 text-gray-300 hover:text-white font-bold uppercase tracking-widest transition-all shadow-md active:scale-95"
            >
              PDF
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
