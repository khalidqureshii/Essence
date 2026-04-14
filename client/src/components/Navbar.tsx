import React, { useState } from "react";
import { PanelLeft, MoreVertical } from "lucide-react";

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
  isModeLocked: boolean;
  onToggleSidebar: () => void;
}
// Navbar for navigation
const Navbar: React.FC<NavbarProps> = ({
  status,
  isRecording,
  autoplayResponses,
  onToggleAutoplay,
  onGenerateReport,
  onExportPDF,
  macroCompletedChunks,
  sectionLabel,
  sectionProgress,
  isModeLocked,
  onToggleSidebar
}) => {
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(false);

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
      {/* Left: Sidebar Toggle */}
      <div className="w-[180px] flex-shrink-0 flex items-center justify-start">
        <button
          onClick={onToggleSidebar}
          className="p-3 bg-secondary/30 hover:bg-secondary/70 border border-border rounded-xl transition-all shadow-sm text-muted-foreground hover:text-white"
        >
          <PanelLeft size={26} strokeWidth={2} />
        </button>
      </div>

      {/* Center: Absolute Perfect Centered Brand */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
        <h1 className="text-3xl font-black text-white tracking-tighter shadow-lg">
          Essence
        </h1>
      </div>

      {/* Right: Controls */}
      <div className="w-[180px] flex-shrink-0 flex justify-end items-center relative">
        {isRecording ? (
          <div className="flex items-center space-x-2.5 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20 animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
            <span className="text-[10px] text-red-500 font-black tracking-widest uppercase">Live</span>
          </div>
        ) : (
          <>
            {/* Desktop Controls (min: 1200px) */}
            <div className="hidden min-[1200px]:flex items-center space-x-4">
              <button onClick={onGenerateReport} className="app-btn app-btn-primary h-11">
                Report
              </button>
              <button onClick={onExportPDF} className="app-btn app-btn-primary h-11">
                PDF
              </button>

              <div className="h-8 w-[1px] bg-border mx-1" />

              <div className={`ml-2 ${!isModeLocked ? "cursor-not-allowed" : ""}`}>
                <button
                  onClick={onToggleAutoplay}
                  disabled={!isModeLocked}
                  className={`app-btn transition-all duration-300 w-auto whitespace-nowrap flex items-center gap-3 px-5 h-11 ${!isModeLocked ? "opacity-50 pointer-events-none" : ""} ${autoplayResponses
                    ? "app-btn-primary border-transparent"
                    : "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80 focus:ring-secondary/20"
                    }`}
                >
                  <span>AUTOPLAY</span>
                  <span className={`text-[10px] leading-none px-2 py-1 rounded-[4px] font-black tracking-wider ${autoplayResponses ? "bg-white/20 text-white" : "bg-black/30 text-muted-foreground"}`}>
                    {autoplayResponses ? "ON" : "OFF"}
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile / Tablet Controls (max: 1200px) */}
            <div className="min-[1200px]:hidden">
              <button
                onClick={() => setIsRightMenuOpen(!isRightMenuOpen)}
                className="p-3 bg-secondary/30 hover:bg-secondary/70 border border-border rounded-xl transition-all shadow-sm text-muted-foreground hover:text-white"
              >
                <MoreVertical size={24} />
              </button>

              {isRightMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsRightMenuOpen(false)} />
                  <div className="absolute top-[3.5rem] right-0 w-[260px] bg-card border-2 border-secondary rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.7)] p-4 flex flex-col items-center space-y-3 z-50 animate-in fade-in slide-in-from-top-2">
                    <button
                      onClick={() => { onGenerateReport(); setIsRightMenuOpen(false); }}
                      className="app-btn app-btn-primary h-11 w-full justify-center"
                    >
                      Report
                    </button>
                    <button
                      onClick={() => { onExportPDF(); setIsRightMenuOpen(false); }}
                      className="app-btn app-btn-primary h-11 w-full justify-center"
                    >
                      PDF
                    </button>

                    <div className="h-[1px] w-full bg-border my-1" />

                    <div className={`w-full ${!isModeLocked ? "cursor-not-allowed" : ""}`}>
                      <button
                        onClick={onToggleAutoplay}
                        disabled={!isModeLocked}
                        className={`app-btn transition-all duration-300 w-full whitespace-nowrap flex items-center justify-center gap-3 px-5 h-11 ${!isModeLocked ? "opacity-50 pointer-events-none" : ""} ${autoplayResponses
                          ? "app-btn-primary border-transparent"
                          : "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80 focus:ring-secondary/20"
                          }`}
                      >
                        <span>AUTOPLAY</span>
                        <span className={`text-[10px] leading-none px-2 py-1 rounded-[4px] font-black tracking-wider ${autoplayResponses ? "bg-white/20 text-white" : "bg-black/30 text-muted-foreground"}`}>
                          {autoplayResponses ? "ON" : "OFF"}
                        </span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
