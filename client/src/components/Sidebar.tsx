import React from "react";
import { X } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  macroCompletedChunks: number;
  sectionLabel: string;
  sectionProgress: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  macroCompletedChunks,
  sectionLabel,
  sectionProgress,
}) => {
  const totalNodes = 6;
  const sansStyle = { fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif" };

  const EVALUATION_SECTIONS = [
    "Project Understanding",
    "UI & User Experience",
    "Design Decisions & Trade-offs",
    "Technical Awareness",
    "Limitations & Improvements",
    "Results / Report"
  ];

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Slide-out Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-full sm:w-[450px] bg-background border-r border-border z-[70] transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={sansStyle}
      >
        {/* Header containing Phase Label and Close button */}
        <div className="h-28 px-6 border-b border-border flex items-center justify-between shrink-0 pr-8">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-muted-foreground uppercase opacity-70 tracking-widest mb-1">
              Current Focus
            </span>
            <span className="text-xl font-black text-primary uppercase tracking-wide">
              {sectionLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent opacity-50 hover:opacity-100 transition-all duration-300 text-muted-foreground hover:text-white focus:outline-none border-none shadow-none"
          >
            <X size={28} strokeWidth={1.5} />
          </button>
        </div>

        {/* Vertical Progress Bar Area */}
        <div className="flex-1 overflow-y-auto px-8 py-10 flex flex-col items-start">
          {Array.from({ length: totalNodes }).map((_, i) => {
            const isCompleted = i < macroCompletedChunks;
            const isActive = i === macroCompletedChunks;

            return (
              <div key={i} className="flex flex-row items-stretch w-full group">
                {/* Numbered Node & Connector Column */}
                <div className="relative shrink-0 flex flex-col items-center w-14">
                  <div
                    className={`
                      w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-500 z-10 relative
                      ${
                        isCompleted
                          ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(20,184,166,0.6)]"
                          : isActive
                          ? "border-2 border-primary text-primary shadow-[0_0_20px_rgba(20,184,166,0.4)]"
                          : "border-2 border-border text-muted-foreground bg-card"
                      }
                    `}
                  >
                    {i + 1}
                    {/* Active Subtle Glow */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-primary/20 blur-md -z-10" />
                    )}
                  </div>

                  {/* Vertical Connector Line */}
                  {i < totalNodes - 1 && (
                    <div className="w-[4px] h-12 bg-card my-1 rounded-full overflow-hidden relative shrink-0">
                      <div
                        className="absolute inset-x-0 top-0 bg-primary transition-all duration-700 ease-out w-full"
                        style={{
                          height: `${
                            isCompleted ? 100 : isActive ? sectionProgress : 0
                          }%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Text Label Column */}
                <div className="ml-6 flex flex-col justify-start pt-3 pb-6 flex-1">
                  <span
                    className={`text-lg font-black tracking-wide transition-colors duration-300 ${
                      isCompleted || isActive ? "text-white" : "text-muted-foreground"
                    }`}
                  >
                    {EVALUATION_SECTIONS[i]}
                  </span>
                  
                  {isActive && (
                    <span className="text-xs text-primary font-bold uppercase tracking-widest mt-1 animate-pulse">
                      In Progress
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
