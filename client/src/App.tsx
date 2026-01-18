import React, { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import { API_BASE_URL } from "./config";
import { Toaster, toast } from "react-hot-toast";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  image?: string;
  isFinal?: boolean;
}

// Global TTS reference to prevent Garbage Collection bugs
declare global {
  interface Window {
    currentUtterance?: SpeechSynthesisUtterance | null;
  }
}

// Derive WS URL from API_BASE_URL (http -> ws, https -> wss)
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/chatbot/ws";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-1",
      sender: "bot",
      text: "Hi, I am Essence - your Agentic Critic. Say 'Essence' or click Mic to start.",
      isFinal: true,
    },
  ]);
  const [status, setStatus] = useState<"INACTIVE" | "ACTIVE" | "RESPONDING">("INACTIVE");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentDraft, setCurrentDraft] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [autoplayResponses, setAutoplayResponses] = useState(() => {
    return localStorage.getItem("autoplayResponses") === "true";
  });

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Ref to hold latest handleScreenshot to avoid stale closures in WS effect
  const handleScreenshotRef = useRef<((autoSend?: boolean) => Promise<void>) | null>(null);

  const scrollToBottom = () =>
    chatEndRef.current?.scrollIntoView({ block: "end" }); // Removed smooth behavior for performance
  useEffect(scrollToBottom, [messages]);

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
              if (data.payload.is_responding) {
                setStatus("RESPONDING");
              } else {
                if (data.payload.active) setStatus("ACTIVE");
                else setStatus("INACTIVE");

                // Mark last bot message as final when responding stops
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.sender === "bot" && !last.isFinal) {
                    return [...prev.slice(0, -1), { ...last, isFinal: true }];
                  }
                  return prev;
                });
              }

              // 4️⃣ Log when a message is marked final (Status Change triggers completion)
              console.log("MESSAGE FINALIZED (Status Change)", {
                newStatus: data.payload.is_responding ? "RESPONDING" : (data.payload.active ? "ACTIVE" : "INACTIVE"),
                messagesCount: messages.length
              });
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
                  return [...prev, { id: crypto.randomUUID(), sender: "bot", text: data.payload }];
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
                  id: crypto.randomUUID(),
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

  // Audio Recording (Continuous Logic)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && ws && ws.readyState === WebSocket.OPEN && !speakingText) {
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
      stopRecording();
      setStatus("INACTIVE");
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

  // Audio Controls - IMPERATIVE ARCHITECTURE
  // We rely on window.currentUtterance instead of Ref to ensure GC safety across re-renders

  const stopSpeaking = () => {
    console.log("TTS DEBUG: Explicit Stop called");
    window.speechSynthesis.cancel();
    setSpeakingText(null);
    window.currentUtterance = null;
  };

  const speakResponse = (text: string) => {
    console.log(`TTS DEBUG: speakResponse called. Length: ${text.length}. Content: "${text.substring(0, 50)}..."`);

    // 1. Cancel existing
    if (window.speechSynthesis.speaking) {
      console.log("TTS DEBUG: Canceling previous speech");
      window.speechSynthesis.cancel();
    }

    if (!text) {
      console.warn("TTS DEBUG: Empty text, aborting.");
      return;
    }

    // 2. Create Utterance
    const utterance = new SpeechSynthesisUtterance(text);
    window.currentUtterance = utterance; // SUPER STRONG GC protection

    // 3. Bind Events (Update State)
    utterance.onstart = () => {
      console.log("TTS DEBUG: onstart fired");
      setSpeakingText(text);
    };
    utterance.onend = () => {
      console.log("TTS DEBUG: onend fired");
      setSpeakingText(null);
      window.currentUtterance = null;
    };
    utterance.onerror = (e) => {
      console.error("TTS DEBUG: onerror fired", e);
      setSpeakingText(null);
      window.currentUtterance = null;
    };

    // 4. Speak
    console.log("TTS DEBUG: calling window.speechSynthesis.speak");
    window.speechSynthesis.speak(utterance);
  };

  const handleManualMicClick = (text: string) => {
    // UI Handler: Toggles state
    if (speakingText === text) {
      console.log("UI DEBUG: User clicked Stop");
      stopSpeaking();
    } else {
      console.log("UI DEBUG: User clicked Listen");
      // 2️⃣ Log the text used by the Listen button
      console.log("MANUAL LISTEN TEXT", {
        length: text.length,
        preview: text.slice(0, 100),
      });
      speakResponse(text);
    }
  };

  const lastAutoplayMessageIdRef = useRef<string | null>(null);

  // Initialize lastAutoplayMessageIdRef to prevent playing old messages on load
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg) {
        lastAutoplayMessageIdRef.current = lastMsg.id;
      }
    }
  }, []); // Run once on mount

  // Robust Autoplay Trigger (ID Based)
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];

    console.log("AUTOPLAY CHECK:", {
      status,
      autoplayResponses,
      hasLastMsg: !!lastMsg,
      savedId: lastAutoplayMessageIdRef.current,
      currentId: lastMsg?.id,
      sender: lastMsg?.sender,
      isFinal: lastMsg?.isFinal
    });

    // 1. Completion Check (Wait for Explicit Finalization)
    if (!lastMsg?.isFinal) {
      // console.log("AUTOPLAY DEBUG: Waiting for stream completion...", lastMsg.id);
      return;
    }

    if (!autoplayResponses) return;

    // 2. Validate it's a new Bot message
    if (!lastMsg || lastMsg.sender !== "bot") return;

    // 3. Idempotency Check (Stable ID)
    if (lastAutoplayMessageIdRef.current === lastMsg.id) {
      console.log("AUTOPLAY DEBUG: Skipping, already spoken", lastMsg.id);
      return;
    }

    // 4. Speak
    // 1️⃣ Log the FULL message object used for autoplay
    console.log("AUTOPLAY MESSAGE OBJECT", JSON.stringify(lastMsg, null, 2));

    console.log("AUTOPLAY DEBUG: Triggering Speak for", lastMsg.id);
    speakResponse(lastMsg.text);

    // 5. Update Ref
    lastAutoplayMessageIdRef.current = lastMsg.id;

  }, [status, autoplayResponses, messages]);

  const toggleAutoplay = () => {
    setAutoplayResponses(prev => {
      const next = !prev;
      localStorage.setItem("autoplayResponses", String(next));
      return next;
    });
  };

  const handleCommit = () => {
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
            <div className="flex items-center space-x-4">
              <label className="flex items-center cursor-pointer space-x-2 group">
                <input
                  type="checkbox"
                  checked={autoplayResponses}
                  onChange={toggleAutoplay}
                  className="form-checkbox h-4 w-4 text-teal-500 rounded border-gray-600 focus:ring-teal-500 focus:ring-offset-gray-900 bg-gray-800 transition-colors"
                />
                <span className="text-xs text-gray-400 font-medium uppercase tracking-wide group-hover:text-teal-400 transition-colors select-none">
                  Auto-play
                </span>
              </label>
              <span className="text-xs text-gray-500 mr-2 uppercase tracking-wide">Ready</span>
            </div>
          )}
        </div>
      </header>

      {/* Chat Area (scrollable only here) */}
      <main className="flex-1 overflow-y-auto px-4 md:px-16 py-6 space-y-4 scrollbar-hide relative">
        {messages.map((msg, i) => {
          // 3️⃣ Log the text rendered in the UI
          if (msg.sender === 'bot' && i === messages.length - 1) {
            console.log("UI RENDER TEXT", {
              length: msg.text.length,
              preview: msg.text.slice(0, 100),
            });
          }
          return (
            <ChatMessage
              key={i}
              sender={msg.sender}
              text={msg.text}
              image={msg.image}
              isPlaying={speakingText === msg.text}
              onPlay={handleManualMicClick}
            />
          );
        })}
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
