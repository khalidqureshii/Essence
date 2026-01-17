import React, { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import { API_BASE_URL } from "./config";
import { Toaster, toast } from "react-hot-toast";

interface Message {
  sender: "user" | "bot";
  text: string;
  image?: string;
}

// Derive WS URL from API_BASE_URL (http -> ws, https -> wss)
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/chatbot/ws";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hi, I am Essence - your Agentic Critic. Say 'Essence' or click Mic to start.",
    },
  ]);
  const [status, setStatus] = useState<"INACTIVE" | "ACTIVE" | "RESPONDING">("INACTIVE");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentDraft, setCurrentDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Ref to hold latest handleScreenshot to avoid stale closures in WS effect
  const handleScreenshotRef = useRef<((autoSend?: boolean) => Promise<void>) | null>(null);

  const scrollToBottom = () =>
    chatEndRef.current?.scrollIntoView({ block: "end" }); // Removed smooth behavior for performance
  useEffect(scrollToBottom, [messages]);

  // ... (WebSocket useEffect) ...

  // Screen Share Logic
  const startScreenShare = async () => {
    if (isSharing) {
      stopScreenShare();
      return;
    }
    try {
      // Request screen share with system audio if possible (though we only use video for screenshots mainly)
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = stream;
      setIsSharing(true);

      // Handle user stopping stream from browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (e) {
      console.error("Screen Share Error:", e);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setIsSharing(false);
  };


  // WebSocket Connection
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: any;

    const connect = () => {
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        console.log("Connected to Essence Backend");
        toast.success("Connected to Essence");
        setWs(socket);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case "state_update":
              if (data.payload.is_responding) setStatus("RESPONDING");
              else if (data.payload.active) setStatus("ACTIVE");
              else setStatus("INACTIVE");
              break;

            case "transcript_update":
              setMessages(prev => {
                return [...prev]; // Placeholder for now
              });
              console.log("Transcript Update:", data.payload);
              break;

            case "response_chunk":
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last.sender === "bot" && last.text !== "...") {
                  return [
                    ...prev.slice(0, -1),
                    { ...last, text: last.text + data.payload }
                  ];
                } else {
                  return [...prev, { sender: "bot", text: data.payload }];
                }
              });
              break;

            case "command":
              if (data.payload === "capture_screenshot") {
                // Use Ref to avoid stale closure issues
                if (handleScreenshotRef.current) {
                  handleScreenshotRef.current();
                }
              }
              break;

            case "commit_confirmation":
              setMessages(prev => {
                const displayText = data.payload.text || (data.payload.image ? "" : "🎤 (Audio Message)");
                return [...prev, {
                  sender: "user",
                  text: displayText,
                  image: data.payload.image
                }];
              });
              break;
          }
        } catch (e) {
          console.error("WS Message Error", e);
          toast.error("Failed to parse message");
        }
      };

      socket.onclose = () => {
        console.log("Disconnected. Retrying in 3s...");
        toast("Disconnected. Reconnecting...", { icon: "🔌" });
        setWs(null);
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error("Socket encountered error, closing:", err);
        socket?.close();
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // Separate effect to handle "trigger-screenshot" event to access latest closure?
  // Or better: Use a Ref for the current WS instance, but handleScreenshot needs to send data.
  // Actually, handleScreenshot uses `ws` from state.
  // If we move command handling to a separate useEffect that depends on [ws, handleScreenshot], we are good.

  // Let's REMOVE the command handling from the main WS setup and put it in a message queue or Ref?
  // Alternative: Use a ref for handleScreenshot?
  // `const handleScreenshotRef = useRef(handleScreenshot);`
  // `useEffect(() => { handleScreenshotRef.current = handleScreenshot; });`
  // Then call `handleScreenshotRef.current()` inside the closure. 
  /* 
     We will implement this Ref pattern to fix the stale closure issue.
  */

  // Audio Recording (Continuous Logic)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(event.data);
        }
      };

      mediaRecorder.start(1000); // 1-second chunks
      setIsRecording(true);
      setStatus("ACTIVE");
    } catch (err) {
      console.error("Mic Error:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());
    setIsRecording(false);
  };

  const cancelRecording = () => {
    stopRecording();
    if (ws) ws.send(JSON.stringify({ type: "reset" }));
    setStatus("INACTIVE");
    setPendingImage(null); // Clear image on cancel too
    setCurrentDraft("");
  };

  const finishRecording = () => {
    stopRecording();
    handleCommit();
  };

  const toggleMic = () => {
    if (isRecording) {
      // User requested explicit "Stop & Send" and "Cancel".
      // The Mic button will now only start recording.
      // Stopping and committing/cancelling will be handled by dedicated buttons.
      // For now, if mic is clicked while recording, it just stops without committing.
      stopRecording();
      setStatus("INACTIVE"); // Assuming stopping mic makes turn inactive if no other input.
    }
    else startRecording();
  };

  // Image Input
  const handleScreenshot = async (autoSend: boolean = false) => {
    try {
      let stream = screenStreamRef.current;
      let isOneOff = false;

      // Use active stream if available, otherwise one-off capture
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        isOneOff = true;
      }

      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);

      const base64Image = canvas.toDataURL("image/jpeg");

      // Only stop one-off streams
      if (isOneOff) {
        stream.getTracks().forEach(track => track.stop());
      }

      setPendingImage(base64Image); // Update UI preview

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "image_input",
          image: base64Image,
          source: "shared"
        }));

        if (autoSend) {
          ws.send(JSON.stringify({ type: "commit" }));
          setPendingImage(null);
        }
      } else {
        console.warn("WebSocket not ready for screenshot");
      }

    } catch (e) {
      console.error("Screenshot error:", e);
    }
  };

  // Keep ref updated for WS usage
  useEffect(() => {
    handleScreenshotRef.current = handleScreenshot;
  });

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          if (ws && ws.readyState === WebSocket.OPEN && event.target?.result) {
            const imgStr = event.target.result as string;
            setPendingImage(imgStr); // Update UI preview
            ws.send(JSON.stringify({
              type: "image_input",
              image: imgStr,
              source: "pasted"
            }));
          }
        };
        if (blob) reader.readAsDataURL(blob);
      }
    }
  };


  // Output Handlers
  const handleSendText = (text: string) => {
    setCurrentDraft(text);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "text_input", text, mode: "replace" }));
    }
  };

  const handleCommit = () => {
    // Don't block local check! Backend manages the "Active Turn Context".
    // If we have local text/image, we clear it, but we ALWAYS send commit if requested.

    if (currentDraft.trim() || pendingImage) {
      setCurrentDraft("");
      setPendingImage(null);
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "commit" }));
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden"
      onPaste={handlePaste} // Global paste listener for simplicity
    >
      <Toaster position="top-center" toastOptions={{
        style: { background: '#333', color: '#fff' }
      }} />
      {/* Header */}
      <header className="p-4 text-center border-b border-gray-700 shadow-md flex-shrink-0 flex justify-between items-center transition-colors duration-500"
        style={{ borderColor: status === "ACTIVE" ? "#34d399" : status === "RESPONDING" ? "#60a5fa" : "#374151" }}
      >
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold text-teal-400">Essence</h1>
          <p className="text-xs uppercase tracking-widest font-semibold mt-1"
            style={{ color: status === "ACTIVE" ? "#34d399" : status === "RESPONDING" ? "#60a5fa" : "#9ca3af" }}>
            {status}
          </p>
        </div>
        <div>
          {/* Header controls removed as per user request */}
          {isRecording ? (
            <div className="flex items-center animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-xs text-red-400 font-bold tracking-wider">RECORDING</span>
            </div>
          ) : (
            <div className="flex items-center">
              <span className="text-xs text-gray-500 mr-2 uppercase tracking-wide">Ready</span>
            </div>
          )}
        </div>
      </header>

      {/* Chat Area (scrollable only here) */}
      <main className="flex-1 overflow-y-auto px-4 md:px-16 py-6 space-y-4 scrollbar-hide relative">
        {messages.map((msg, i) => (
          <ChatMessage key={i} sender={msg.sender} text={msg.text} image={msg.image} />
        ))}
        <div ref={chatEndRef} />

        {/* Context Preview Indicator - Always show if image pending or active */}
        {(status === "ACTIVE" || status === "RESPONDING" || pendingImage) && (
          <div className="fixed bottom-24 right-4 flex flex-col items-end space-y-2 animate-in fade-in slide-in-from-bottom-2 z-50">
            {pendingImage && (
              <div className="relative group">
                <img
                  src={pendingImage}
                  alt="Pending Context"
                  className="w-24 h-auto rounded-lg border-2 border-teal-500/50 shadow-lg object-cover bg-gray-900"
                />
                <div className="absolute -top-2 -right-2 bg-teal-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">
                  IMG
                </div>
              </div>
            )}
            {status === "ACTIVE" && !pendingImage && (
              <div className="bg-gray-800/90 border border-teal-500/50 p-3 rounded-lg backdrop-blur-sm shadow-xl flex items-center space-x-3">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                <span className="text-xs text-teal-200 font-medium">Turn Active</span>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-4 border-t border-gray-700 bg-gray-900 flex-shrink-0">
        <MessageInput
          onSend={() => {
            if (isRecording) finishRecording();
            else handleCommit();
          }}
          onInputChange={(text) => handleSendText(text)}
          onMicClick={toggleMic}
          onCameraClick={handleScreenshot}
          onCancelRecording={cancelRecording}
          onShareClick={startScreenShare}
          onStopSharing={stopScreenShare}
          isRecording={isRecording}
          isSharing={isSharing}
          disabled={status === "RESPONDING"}
        />
        <div className="text-xs text-gray-500 text-center mt-2">
          Say "Essence" to start • "Over" to send • "Screenshot" to capture
        </div>
      </footer>
    </div>
  );
};

export default App;

