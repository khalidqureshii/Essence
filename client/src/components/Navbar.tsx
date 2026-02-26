import React from "react";

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
  // Clean modern sans-serif stack
  const sansStyle = { fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif" };

  const totalNodes = 6;
  
  return (
    <header 
      className="h-28 px-6 text-center border-b border-border shadow-xl flex-shrink-0 flex justify-between items-center bg-background/90 backdrop-blur-xl relative z-50"
      style={{ 
        borderColor: status === "ACTIVE" ? "var(--primary)" : status === "RESPONDING" ? "var(--accent)" : "var(--border)",
        ...sansStyle
      }}
    >
      {/* Left: Brand */}
      <div className="w-[180px] flex-shrink-0 flex items-center justify-start ml-10">
        <h1 className="text-3xl font-black text-primary tracking-tighter filter drop-shadow-[0_0_10px_rgba(20,184,166,0.3)]">
          Essence
        </h1>
      </div>

      {/* Center: Minimal Connector-Only Progress */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 px-4 max-w-3xl mx-auto">
        
        {/* Node & Connector Row */}
        <div className="flex items-center justify-between w-full relative h-10">
          {Array.from({ length: totalNodes }).map((_, i) => {
            const isCompleted = i < macroCompletedChunks;
            const isActive = i === macroCompletedChunks;
            
            return (
              <React.Fragment key={i}>
                {/* Numbered Node */}
                <div className="relative">
                  <div 
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500 z-10 relative
                      ${isCompleted ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(20,184,166,0.5)]" : 
                        isActive ? "border-2 border-primary text-primary shadow-[0_0_15px_rgba(20,184,166,0.3)]" : 
                        "border-2 border-border text-muted-foreground"}
                    `}
                  >
                    {i + 1}
                    {/* Active Subtle Glow */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-primary/15 blur-md -z-10" />
                    )}
                  </div>
                </div>

                {/* Connector Bar (The Only Progress Bar) */}
                {i < totalNodes - 1 && (
                  <div className="flex-1 h-[3px] bg-secondary mx-1 rounded-full overflow-hidden relative">
                    <div 
                      className="absolute inset-y-0 left-0 bg-primary transition-all duration-700 ease-out"
                      style={{ 
                        width: `${i < macroCompletedChunks ? 100 : (i === macroCompletedChunks ? sectionProgress : 0)}%` 
                      }}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Phase Label - Refined Hierarchy */}
        <div className="h-6 flex items-center justify-center space-x-2 transition-all duration-500 animate-in fade-in slide-in-from-top-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-80">
                PHASE
            </span>
            <span className="text-[13px] font-extrabold text-primary uppercase tracking-wide">
                {sectionLabel}
            </span>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="w-[180px] flex-shrink-0 flex justify-end items-center">
        {isRecording ? (
          <div className="flex items-center space-x-2.5 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
            <span className="text-[10px] text-red-500 font-black tracking-widest uppercase">Live</span>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            {/* Debug Actions */}
            <button
              onClick={onGenerateReport}
              className="text-[10px] px-3.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary border border-primary/20 text-primary hover:text-primary-foreground font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95"
            >
              Report
            </button>
            <button
              onClick={onExportPDF}
              className="text-[10px] px-3.5 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-muted-foreground hover:text-foreground font-bold uppercase tracking-widest transition-all shadow-sm active:scale-95"
            >
              PDF
            </button>

            <div className="h-8 w-[1px] bg-border mx-1" />

            {/* Premium Autoplay Toggle */}
            <div className="flex flex-col items-center space-y-1">
                <button 
                  onClick={onToggleAutoplay}
                  className={`relative w-9 h-5 transition-colors duration-300 rounded-full border border-border focus:outline-none focus:ring-2 focus:ring-ring/20 ${autoplayResponses ? "bg-primary" : "bg-secondary"}`}
                >
                    <div className={`absolute top-0.5 left-0.5 w-[0.9rem] h-[0.9rem] bg-white rounded-full transition-transform duration-300 shadow-sm ${autoplayResponses ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest leading-none">
                    Auto-play
                </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
