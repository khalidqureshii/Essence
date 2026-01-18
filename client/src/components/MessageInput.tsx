import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, Mic, Send, Square, X, ExternalLink, MicVocal } from "lucide-react";

// Speech Recognition Types
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: SpeechRecognitionResult;
    length: number;
    item(index: number): SpeechRecognitionResult;
  };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}



interface MessageInputProps {
  onSend: (message: string, audioBlob?: Blob, screenshot?: string) => void;
  disabled?: boolean;
  isBotSpeaking?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, disabled, isBotSpeaking }) => {
  const [message, setMessage] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);

  // Voice Automation State
  const [listeningForWakeWord, setListeningForWakeWord] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, []);

  // Handle Voice Commands logic
  useEffect(() => {
    const recognition = recognitionRef.current;

    // Stop listening if dependencies are missing or bot is speaking
    if (!recognition || !screenStream || isBotSpeaking) {
      if (listeningForWakeWord) {
        recognition?.stop();
        setListeningForWakeWord(false);
      }
      return;
    }

    if (!listeningForWakeWord) {
      try {
        recognition.start();
        setListeningForWakeWord(true);
      } catch (e) {
        // Recognition might already be started
      }
    }

    recognition.onresult = (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript.trim().toLowerCase();
      console.log("Voice command detected:", transcript);

      // Wake word: "Essence"
      if (!isRecording && transcript.includes("essence")) {
        console.log("Wake word detected! Starting recording...");
        startRecording();
      }

      // Stop word: "Over"
      else if (isRecording && (transcript.includes("over") || transcript.endsWith("over"))) {
        console.log("Stop word detected! Stopping recording...");
        stopRecording();
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        setListeningForWakeWord(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we should still be listening
      if (screenStream && !isBotSpeaking && listeningForWakeWord) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore error if already started
        }
      } else {
        setListeningForWakeWord(false);
      }
    };

  }, [screenStream, isRecording, listeningForWakeWord, isBotSpeaking]);


  useEffect(() => {
    if (videoPreviewRef.current && screenStream) {
      videoPreviewRef.current.srcObject = screenStream;
    }
    if (pipVideoRef.current && screenStream) {
      pipVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream, pipWindow]);

  // Handle unmount - stop all streams and close PiP
  useEffect(() => {
    return () => {
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
      }
      if (pipWindow) {
        pipWindow.close();
      }
    };
  }, [screenStream, pipWindow]);

  const handleSend = () => {
    if (!message.trim() && !isRecording) return;
    onSend(message);
    setMessage("");
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        onSend("", audioBlob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false
      });

      setScreenStream(stream);

      // Detect when user stops sharing via browser UI
      stream.getTracks().forEach(track => {
        track.onended = () => {
          setScreenStream(null);
        };
      });
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
  };

  const takeSnapshot = async () => {
    if (!screenStream) return;

    try {
      const video = document.createElement("video");
      video.srcObject = screenStream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const screenshot = canvas.toDataURL("image/jpeg", 0.7);
      onSend("Analyze this screenshot", undefined, screenshot);
    } catch (err) {
      console.error("Error taking snapshot:", err);
    }
  };

  const handleCaptureClick = () => {
    if (screenStream) {
      takeSnapshot();
    } else {
      startScreenShare();
    }
  };

  const togglePiP = async () => {
    if (pipWindow) {
      pipWindow.close();
      setPipWindow(null);
      return;
    }

    const pipAPI = (window as any).documentPictureInPicture;
    if (!pipAPI) {
      alert("Document Picture-in-Picture is not supported in this browser.");
      return;
    }

    try {
      const pip = await pipAPI.requestWindow({
        width: 320,
        height: 240,
      });

      // Copy styles
      [...document.styleSheets].forEach((styleSheet) => {
        try {
          const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
          const style = document.createElement("style");
          style.textContent = cssRules;
          pip.document.head.appendChild(style);
        } catch (e) {
          const link = document.createElement("link");
          if (styleSheet.href) {
            link.rel = "stylesheet";
            link.href = styleSheet.href;
            pip.document.head.appendChild(link);
          }
        }
      });

      pip.addEventListener("pagehide", () => {
        setPipWindow(null);
      });

      setPipWindow(pip);
    } catch (err) {
      console.error("Error opening PiP:", err);
    }
  };

  const renderOverlay = (targetRef: React.RefObject<HTMLVideoElement | null>, isPiP: boolean) => (
    <div className={`${isPiP ? 'w-full h-full' : 'fixed bottom-6 right-6 w-72'} bg-gray-900 rounded-xl overflow-hidden border-2 border-teal-500 shadow-2xl z-50 group flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300`}>
      <div className="relative aspect-video bg-black">
        <video
          ref={targetRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
          <div className="flex justify-end space-x-2">
            {!isPiP && (
              <button
                onClick={togglePiP}
                className="bg-teal-500/80 p-1.5 rounded-full hover:bg-teal-600 transition backdrop-blur-sm text-white"
                title="Pop out (Always on top)"
                type="button"
              >
                <ExternalLink size={16} />
              </button>
            )}
            <button
              onClick={stopScreenShare}
              className="bg-red-500/80 p-1.5 rounded-full hover:bg-red-600 transition backdrop-blur-sm text-white"
              title="Stop Sharing"
              type="button"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={takeSnapshot}
              className="bg-teal-500/90 p-3 rounded-full hover:bg-teal-400 transition transform hover:scale-110 shadow-lg text-white"
              title="Capture Instant Snapshot"
              type="button"
            >
              <Camera size={20} />
            </button>

            {isRecording ? (
              <button
                onClick={stopRecording}
                className="bg-red-500/90 p-3 rounded-full hover:bg-red-400 transition animate-pulse transform hover:scale-110 shadow-lg text-white"
                title="Stop Recording"
                type="button"
              >
                <Square size={20} />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="bg-gray-700/80 p-3 rounded-full hover:bg-red-500 transition transform hover:scale-110 shadow-lg text-white"
                title="Record Voice Critique"
                type="button"
              >
                <Mic size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="bg-gray-800 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-teal-400 font-medium uppercase tracking-wider">
            {isPiP ? 'Always-on-Top' : 'Live Capture Active'}
          </span>
        </div>
        <div className="flex items-center space-x-3">
          {listeningForWakeWord && !isRecording && (
            <div className="flex items-center space-x-1.5 bg-black/40 px-2 py-0.5 rounded-md border border-teal-500/30">
              <MicVocal size={12} className="text-teal-400 animate-pulse" />
              <span className="text-[10px] text-teal-200">Say "Essence"</span>
            </div>
          )}
          {isRecording && (
            <div className="flex items-center space-x-1.5 animate-pulse">
              <span className="text-[10px] text-red-400 font-bold uppercase">Say "Over" to stop</span>
              <span className="text-[10px] text-red-500 font-bold">REC</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Tab-bound Overlay (Hidden if PiP is active) */}
      {screenStream && !pipWindow && renderOverlay(videoPreviewRef, false)}

      {/* Pop-out Overlay (PiP Portal) */}
      {screenStream && pipWindow && createPortal(
        renderOverlay(pipVideoRef, true),
        pipWindow.document.body
      )}

      <div className={`flex items-center bg-gray-800 rounded-lg shadow-lg px-4 py-2 space-x-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <button
          onClick={handleCaptureClick}
          className={`transition ${screenStream ? 'text-teal-400' : 'text-gray-400 hover:text-teal-400'}`}
          title={screenStream ? "Snapshot Active" : "Start Screen Share"}
          type="button"
        >
          <Camera size={22} />
        </button>

        <textarea
          rows={1}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Recording audio..." : "Type your message..."}
          className="flex-1 resize-none bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none"
        />

        {isRecording ? (
          <button
            onClick={stopRecording}
            className="text-red-500 hover:text-red-400 transition animate-pulse"
            title="Stop Recording"
            type="button"
          >
            <Square size={22} />
          </button>
        ) : (
          <button
            onClick={startRecording}
            className="text-gray-400 hover:text-red-400 transition"
            title="Voice input"
            type="button"
          >
            <Mic size={22} />
          </button>
        )}

        <button
          onClick={handleSend}
          disabled={disabled}
          className="bg-teal-500 hover:bg-teal-600 text-white p-2 rounded-full transition disabled:bg-gray-600"
          title="Send"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
