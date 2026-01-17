import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, Mic, Send, Square, Monitor } from "lucide-react";


interface MessageInputProps {
  onSend: () => void;
  onInputChange: (text: string) => void;
  onMicClick: () => void;
  onCameraClick: () => void;
  onCancelRecording: () => void;
  onShareClick: () => void;
  onStopSharing: () => void; // Explicit stop
  isRecording: boolean;
  isSharing: boolean;
  disabled: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onInputChange,
  onMicClick,
  onCameraClick,
  onCancelRecording,
  onShareClick,
  onStopSharing,
  isRecording,
  isSharing,
  disabled,
}) => {
  const [message, setMessage] = useState<string>("");
  const [pipWindow, setPipWindow] = useState<Window | null>(null);

  // Ref for cleanup callback
  const onStopSharingRef = React.useRef(onStopSharing);
  useEffect(() => { onStopSharingRef.current = onStopSharing; }, [onStopSharing]);

  const handleSend = () => {
    // Delegate validation to parent (so we can send images with empty text)
    onSend();
    setMessage("");
    onInputChange("");
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onInputChange(e.target.value);
  };

  // Auto-PiP Management
  useEffect(() => {
    if (isSharing && !pipWindow) {
      openPiP();
    } else if (!isSharing && pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }
  }, [isSharing]);

  const openPiP = async () => {
    if (pipWindow) return;

    const pipAPI = (window as any).documentPictureInPicture;
    if (!pipAPI) return;

    try {
      const pip = await pipAPI.requestWindow({ width: 150, height: 100 });

      // Copy basic styles to PiP window
      const style = pip.document.createElement("style");
      style.textContent = `
        body { margin: 0; background: #111827; display: flex; justify-content: center; align-items: center; height: 100vh; }
      `;
      pip.document.head.appendChild(style);

      pip.addEventListener("pagehide", () => {
        setPipWindow(null);
        // Stop sharing when PiP closes (user action)
        if (onStopSharingRef.current) {
          onStopSharingRef.current();
        }
      });
      setPipWindow(pip);
    } catch (e) {
      console.error(e);
    }
  };

  const renderPiPContent = () => (
    <div className='bg-gray-900 h-full w-full flex items-center justify-center'>
      {/* Only Camera logic as requested */}
      <button
        onClick={onCameraClick}
        className="bg-teal-500 hover:bg-teal-400 p-4 rounded-full text-white shadow-lg transform active:scale-95 transition-all"
        title="Take Screenshot"
      >
        <Camera size={28} />
      </button>
    </div>
  );

  return (
    <div>
      {/* PiP Portal */}
      {pipWindow && createPortal(renderPiPContent(), pipWindow.document.body)}

      <div className={`flex items-center bg-gray-800 rounded-lg shadow-lg px-4 py-2 space-x-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>

        {/* Share Button (replaces PiP toggle) */}
        <button
          onClick={onShareClick}
          className={`transition ${isSharing ? 'text-blue-400 animate-pulse' : 'text-gray-400 hover:text-white'}`}
          title={isSharing ? "Stop Sharing" : "Share Screen"}
        >
          <Monitor size={20} />
        </button>

        <textarea
          rows={1}
          value={message}
          onChange={handleTextChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isRecording ? "Listening..." : "Type your message..."}
          className="flex-1 resize-none bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none"
        />

        {isRecording ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={onCancelRecording}
              className="p-2 text-gray-400 hover:text-red-400 transition-colors"
              title="Cancel Recording"
            >
              <div className="relative w-6 h-6 flex items-center justify-center bg-gray-700 rounded-full">
                <span className="text-xs font-bold">✕</span>
              </div>
            </button>
            <button
              onClick={onSend}
              className="p-2 text-white bg-red-600 hover:bg-red-500 rounded-full shadow-lg shadow-red-500/30 animate-pulse transition-all"
              title="Stop & Send"
            >
              <Square size={18} fill="currentColor" />
            </button>
          </div>
        ) : (
          <button
            onClick={onMicClick}
            className="text-gray-400 hover:text-white transition-colors p-2"
            title="Start Recording"
          >
            <Mic size={22} />
          </button>
        )}

        <button
          onClick={handleSend}
          disabled={disabled}
          className="bg-teal-500 hover:bg-teal-600 text-white p-2 rounded-full transition disabled:bg-gray-600"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
