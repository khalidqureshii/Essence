import React from "react";

interface CompletionDashboardProps {
  onGenerateReport: () => void;
  onDownloadPDF: () => void;
  onReset: () => void;
}

const CompletionDashboard: React.FC<CompletionDashboardProps> = ({
  onGenerateReport,
  onDownloadPDF,
  onReset
}) => {
  const verdanaStyle = { fontFamily: "'Verdana', sans-serif" };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-xl animate-in fade-in duration-500"
      style={verdanaStyle}
    >
      <div className="bg-background border border-border/30 rounded-3xl p-10 max-w-xl w-full mx-4 shadow-[0_0_50px_rgba(20,184,166,0.15)] text-center transform animate-in zoom-in-95 duration-500">
        
        {/* Success Icon */}
        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-teal-500/20">
          <svg className="w-10 h-10 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-4xl font-black text-foreground mb-4 tracking-tight">
          EVALUATION COMPLETE
        </h2>
        
        <p className="text-muted-foreground mb-10 text-lg leading-relaxed font-medium">
          Congratulations! You've successfully completed all five evaluation units. What would you like to do next?
        </p>

        <div className="flex flex-col space-y-4">
          <button
            onClick={onGenerateReport}
            className="app-btn app-btn-primary w-full"
          >
            Generate Detailed Report
          </button>
          
          <button
            onClick={onDownloadPDF}
            className="app-btn app-btn-secondary w-full"
          >
            Download Chat History PDF
          </button>

          <div className="pt-6">
            <button
              onClick={onReset}
              className="app-btn app-btn-ghost w-full"
            >
              Start New Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompletionDashboard;
