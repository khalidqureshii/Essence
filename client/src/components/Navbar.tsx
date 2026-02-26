import ChunkProgressBar from "./ChunkProgressBar";

interface NavbarProps {
  status: "INACTIVE" | "ACTIVE" | "RESPONDING";
  isRecording: boolean;
  autoplayResponses: boolean;
  onToggleAutoplay: () => void;
  onGenerateReport: () => void;
  onExportPDF: () => void;
  macroCompletedChunks: number;
}

const Navbar: React.FC<NavbarProps> = ({
  status,
  isRecording,
  autoplayResponses,
  onToggleAutoplay,
  onGenerateReport,
  onExportPDF,
  macroCompletedChunks
}) => {
  return (
    <header className="h-24 px-4 text-center border-b border-gray-700 shadow-md flex-shrink-0 flex justify-between items-center transition-colors duration-500 overflow-hidden"
      style={{ borderColor: status === "ACTIVE" ? "#34d399" : status === "RESPONDING" ? "#60a5fa" : "#374151" }}
    >
      <div className="w-[150px] flex-shrink-0 flex items-center space-x-2">
        <h1 className="text-2xl font-bold text-teal-400 font-mono tracking-tighter">Essence</h1>
      </div>

      <div className="flex-1 flex justify-center px-4">
        <ChunkProgressBar completedChunks={macroCompletedChunks} />
      </div>

      <div className="w-[280px] flex-shrink-0 flex justify-end">
        {isRecording ? (
          <div className="flex items-center animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
            <span className="text-xs text-red-400 font-bold tracking-wider">RECORDING</span>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <label className="flex items-center cursor-pointer space-x-2 group">
              <input
                type="checkbox"
                checked={autoplayResponses}
                onChange={onToggleAutoplay}
                className="form-checkbox h-4 w-4 text-teal-500 rounded border-gray-600 focus:ring-teal-500 focus:ring-offset-gray-900 bg-gray-800 transition-colors"
              />
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide group-hover:text-teal-400 transition-colors select-none">
                Auto-play
              </span>
            </label>
            <button
              onClick={onGenerateReport}
              className="text-[10px] px-3 py-1.5 rounded bg-teal-600/20 hover:bg-teal-600 border border-teal-500/30 text-teal-300 hover:text-white font-bold uppercase tracking-tight transition-all"
            >
              Report
            </button>
            <button
              onClick={onExportPDF}
              className="text-[10px] px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 hover:text-white font-bold uppercase tracking-tight transition-all"
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
