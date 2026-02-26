import React, { useState, useRef, useEffect, useReducer } from "react";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import Loader from "./components/Loader";
import { Toaster, toast } from "react-hot-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import ProjectReport from "./Pages/ProjectReport";
import Navbar from "./components/Navbar";
import CompletionDashboard from "./components/CompletionDashboard";


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://essence-gf00.onrender.com";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  image?: string;
  images?: string[];
  isFinal?: boolean;
}

// Global TTS reference to prevent Garbage Collection bugs
declare global {
  interface Window {
    currentUtterance?: SpeechSynthesisUtterance | null;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Derive WS URL from API_BASE_URL (http -> ws, https -> wss)
const WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/chatbot/ws";

const EVALUATION_SECTIONS = [
  { key: "PROJECT_UNDERSTANDING", label: "Project Understanding" },
  { key: "UI_UX", label: "UI & User Experience" },
  { key: "DESIGN_DECISIONS", label: "Design Decisions & Trade-offs" },
  { key: "TECHNICAL_AWARENESS", label: "Technical Awareness" },
  { key: "LIMITATIONS_IMPROVEMENTS", label: "Limitations & Improvements" },
  { key: "RESULTS", label: "Results / Report" }
] as const;

type EvaluationSectionKey = typeof EVALUATION_SECTIONS[number]["key"];

interface EvaluationState {
  currentSectionIndex: number;
  currentSection: EvaluationSectionKey;
  sectionConfidence: number;
  sectionProgress: number;
  completedSections: number;
}

type AnswerQuality = "strong" | "partial" | "weak";
type EvaluationAction = 
  | { type: "ANSWER_EVALUATED"; payload: { text: string } }
  | { type: "RESET_EVALUATION" };

const SECTION_COMPLETION_THRESHOLD = 0.75;

const invalidResponses = new Set([
  "no",
  "nope",
  "nah",
  "n/a",
  "na",
  "idk",
  "i dont know",
  "i don't know",
  "dont know",
  "not sure",
  "none",
  "nothing",
  "skip",
  "refuse",
  "cant",
  "can't",
  "cannot",
  "wont",
  "won't",
  "no comment"
]);

const descriptiveKeywords = [
  "because",
  "therefore",
  "however",
  "but",
  "tradeoff",
  "trade-off",
  "constraint",
  "user",
  "users",
  "audience",
  "flow",
  "layout",
  "color",
  "typography",
  "component",
  "state",
  "backend",
  "frontend",
  "api",
  "performance",
  "accessibility",
  "responsive",
  "testing",
  "scalability",
  "security",
  "data",
  "cache",
  "latency",
  "error",
  "edge",
  "goal",
  "objective",
  "feature",
  "problem",
  "solution",
  "design",
  "implementation",
  "architecture",
  "interface",
  "interaction",
  "usability",
  "feedback",
  "limitation",
  "improvement",
  "decision",
  "trade-offs"
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const analyzeAnswer = (text: string) => {
  const normalized = text.trim().toLowerCase();
  const sanitized = normalized.replace(/[^\w\s'-]/g, "").trim();

  if (!sanitized) {
    return { quality: "weak" as AnswerQuality, score: 0, isInvalid: true };
  }

  if (invalidResponses.has(sanitized)) {
    return { quality: "weak" as AnswerQuality, score: 0, isInvalid: true };
  }

  const words = sanitized.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = sanitized.replace(/\s+/g, "").length;
  const keywordHits = descriptiveKeywords.reduce((count, keyword) => {
    return sanitized.includes(keyword) ? count + 1 : count;
  }, 0);

  if (wordCount <= 2 && words[0] === "no") {
    return { quality: "weak" as AnswerQuality, score: 0, isInvalid: true };
  }

  const score = clamp(
    (Math.min(wordCount, 40) / 40 +
      Math.min(charCount, 200) / 200 +
      Math.min(keywordHits, 5) / 5) / 3,
    0,
    1
  );

  const quality: AnswerQuality =
    wordCount >= 20 || charCount >= 120 || keywordHits >= 3
      ? "strong"
      : wordCount >= 8 || charCount >= 50 || keywordHits >= 1
        ? "partial"
        : "weak";

  return { quality, score, isInvalid: false };
};

const getConfidenceIncrement = (quality: AnswerQuality, score: number) => {
  switch (quality) {
    case "strong":
      return 0.25 + 0.10 * score;
    case "partial":
      return 0.10 + 0.10 * score;
    default:
      return 0.01 + 0.04 * score;
  }
};

const evaluationReducer = (state: EvaluationState, action: EvaluationAction): EvaluationState => {
  switch (action.type) {
    case "ANSWER_EVALUATED": {
      // Prevent evaluation if we're already in RESULTS section
      if (state.currentSection === "RESULTS") return state;

      const { quality, score } = analyzeAnswer(action.payload.text);
      const increment = getConfidenceIncrement(quality, score);

      const nextConfidence = clamp(state.sectionConfidence + increment, 0, 1);
      const nextProgress = clamp(nextConfidence * 100, 0, 100);

      let nextState: EvaluationState = {
        ...state,
        sectionConfidence: nextConfidence,
        sectionProgress: nextProgress
      };

      if (
        nextConfidence >= SECTION_COMPLETION_THRESHOLD &&
        state.completedSections < EVALUATION_SECTIONS.length
      ) {
        const nextSectionIndex = Math.min(
          state.currentSectionIndex + 1,
          EVALUATION_SECTIONS.length - 1
        );
        const nextSection = EVALUATION_SECTIONS[nextSectionIndex];
        const nextCompletedSections = Math.min(
          state.completedSections + 1,
          EVALUATION_SECTIONS.length
        );

        if (state.currentSectionIndex !== nextSectionIndex) {
          nextState = {
            ...nextState,
            currentSectionIndex: nextSectionIndex,
            currentSection: nextSection.key,
            sectionConfidence: 0,
            sectionProgress: 0,
            completedSections: nextCompletedSections
          };
        } else {
          nextState = {
            ...nextState,
            completedSections: nextCompletedSections
          };
        }
      }

      return nextState;
    }
    case "RESET_EVALUATION":
      return {
        currentSectionIndex: 0,
        currentSection: EVALUATION_SECTIONS[0].key,
        sectionConfidence: 0,
        sectionProgress: 0,
        completedSections: 0
      };
    default:
      return state;
  }
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init-1",
      sender: "bot",
      text: "Hi, I am Essence - your Agentic Critic. Click Mic to start.",
      isFinal: true,
    },
  ]);
  const [status, setStatus] = useState<"INACTIVE" | "ACTIVE" | "RESPONDING">("INACTIVE");
  const [view, setView] = useState<"chat" | "report">("chat");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentDraft, setCurrentDraft] = useState("");
  // const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [autoplayResponses, setAutoplayResponses] = useState(() => {
    return localStorage.getItem("autoplayResponses") === "true";
  });
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reportGenerationCount, setReportGenerationCount] = useState(0)
  const [evaluationState, dispatchEvaluation] = useReducer(evaluationReducer, {
    currentSectionIndex: 0,
    currentSection: EVALUATION_SECTIONS[0].key,
    sectionConfidence: 0,
    sectionProgress: 0,
    completedSections: 0
  });

  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const MAX_REPORT_GENERATIONS = 1



  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(API_BASE_URL); // Ping backend
        if (res.ok) {
          setIsBackendConnected(true);
          toast.success("Backend Connected!");
        } else {
          setTimeout(checkBackend, 2000); // Retry on non-200
        }
      } catch (error) {
        console.log("Backend offline, retrying...", error);
        setTimeout(checkBackend, 2000); // Retry on error
      }
    };

    checkBackend();
  }, []);



  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const isStoppingRef = useRef(false); // NEW


  const screenStreamRef = useRef<MediaStream | null>(null);
  // Ref to hold latest handleScreenshot to avoid stale closures in WS effect
  const handleScreenshotRef = useRef<((autoSend?: boolean) => Promise<void>) | null>(null);
  const pendingCommitRef = useRef(false);
  const pendingImageRef = useRef<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Sync state to ref for stale closures (MediaRecorder)
  useEffect(() => {
    pendingImageRef.current = pendingImage;
  }, [pendingImage]);

  useEffect(() => {
    wsRef.current = ws;
  }, [ws]);

  // Robustness: Track the last sent image to ensure it appears in chat even if backend doesn't echo it
  // const lastSentImageRef = useRef<string | null>(null);
  const lastSentImageRef = useRef<string[]>([]);


  const scrollToBottom = () =>
    chatEndRef.current?.scrollIntoView({ block: "end" }); // Removed smooth behavior for performance
  useEffect(scrollToBottom, [messages]);

  // const [isSpeaking, setIsSpeaking] = useState(false);

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
              break;

            case "transcript_update":
              if (data.payload) {
                const lower = data.payload.trim().toLowerCase();
                // Filter common Whisper hallucinations on silence
                const isHallucination =
                  lower === "thank you." ||
                  lower === "thank you" ||
                  lower === "you" ||
                  lower === ".";

                if (!isHallucination) {
                  console.log("✅ Valid Backend Transcript:", data.payload);
                  setCurrentDraft(data.payload);

                  // Delayed commit: If we were waiting for this text, commit now
                  if (pendingCommitRef.current) {
                    console.log("🚀 Triggering delayed commit");
                    wsRef.current?.send(JSON.stringify({ type: "commit" }));
                    pendingCommitRef.current = false;
                    setCurrentDraft(""); // Clear after auto-commit
                  }
                } else {
                  console.warn("⚠️ Filtered Hallucination:", lower);
                  // If we were waiting but got garbage, abort commit
                  if (pendingCommitRef.current) {
                    pendingCommitRef.current = false;
                    setCurrentDraft("");
                  }
                }
              }
              // console.log("Transcript Update:", data.payload); // reduced noise
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
              // Fallback: If backend sends no image, use the one we just sent (optimistic persistence)
              // READ REF OUTSIDE UPDATER (Safety fix for Strict Mode / Double Render)
              // Clear waiting-for-transcript state if it was active
              pendingCommitRef.current = false;

              const fallbackImages = lastSentImageRef.current;
              // Clear immediately as it's consumed
              lastSentImageRef.current = []; // cleared in handleCommit already but safe to ensure

              const payloadText = typeof data.payload?.text === "string" ? data.payload.text : "";

              setMessages(prev => {
                // Support both single 'image' and multiple 'images' from payload
                let imagesToUse: string[] = [];

                if (data.payload.images && Array.isArray(data.payload.images) && data.payload.images.length > 0) {
                  imagesToUse = data.payload.images;
                } else if (data.payload.image) {
                  imagesToUse = [data.payload.image];
                } else {
                  // If no images from backend, use fallback (local)
                  imagesToUse = fallbackImages;
                }

                const hasImages = imagesToUse.length > 0;
                const displayText = payloadText || (hasImages ? "" : "🎤 (Audio Message)");

                return [...prev, {
                  id: crypto.randomUUID(),
                  sender: "user",
                  text: displayText,
                  images: imagesToUse
                }];
              });

              dispatchEvaluation({ type: "ANSWER_EVALUATED", payload: { text: payloadText } });

              const analysis = analyzeAnswer(payloadText);
              if (analysis.isInvalid) {
                const sectionLabel =
                  EVALUATION_SECTIONS.find(section => section.key === evaluationState.currentSection)?.label
                  ?? EVALUATION_SECTIONS[0].label;
                setMessages(prev => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    sender: "bot",
                    text: `Could you share a bit more detail about ${sectionLabel.toLowerCase()}?`,
                    isFinal: true
                  }
                ]);
              }
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



  const startRecording = async () => {
    try {
      if (isRecording) return;
      setCurrentDraft("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size <= 0) return;

        // Send audio chunk
        const socket = wsRef.current;
        if (socket && socket.readyState === WebSocket.OPEN && !speakingText) {
          socket.send(event.data);
          // debug logging
          event.data.arrayBuffer().then(buf =>
            console.log("Sent chunk bytes:", buf.byteLength)
          );
        } else {
          console.warn("Cannot send audio chunk: ws not open");
        }

        // If we are in stopping mode, this was the FINAL chunk.
        // Trigger commit only AFTER this chunk has been sent.
        if (isStoppingRef.current) {
          isStoppingRef.current = false;

          // Optional small delay to give the server socket loop time to append bytes
          setTimeout(() => {
            const currentSocket = wsRef.current;
            if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
              console.log("🔔 Sending commit to backend after final chunk");
              // 1️⃣ Send queued screenshots FIRST
              flushPendingImages();

              // 2️⃣ Then commit audio
              currentSocket.send(JSON.stringify({ type: "commit" }));

            } else {
              console.warn("Commit aborted: ws not open");
            }
          }, 120); // 100–300ms is fine; small to be safe
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setStatus("ACTIVE");
    } catch (err) {
      console.error("Mic Error:", err);
    }
  };


  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;

    // Mark that we're stopping — the next ondataavailable will be final
    isStoppingRef.current = true;

    // Force final dataavailable event
    mediaRecorderRef.current.requestData();

    // Stop recording (final dataavailable fires before onstop)
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());

    setIsRecording(false);
  };



  const cancelRecording = () => {
    stopRecording();
    if (wsRef.current) wsRef.current.send(JSON.stringify({ type: "reset" }));
    setStatus("INACTIVE");
    // setPendingImage(null); // Clear image on cancel too
    setPendingImage([]);
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
    } else {
      startRecording();
    }
  };

  const actionsRef = useRef({ isRecording, startRecording, finishRecording });
  useEffect(() => {
    actionsRef.current = { isRecording, startRecording, finishRecording };
  }, [isRecording, startRecording, finishRecording]);


  // Image Input
  // const handleScreenshot = async (autoSend: boolean = false) => {
  //   try {
  //     let stream = screenStreamRef.current;
  //     let isOneOff = false;

  //     // Use active stream if available, otherwise one-off capture
  //     if (!stream || !stream.active) {
  //       stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  //       isOneOff = true;
  //     }

  //     const video = document.createElement("video");
  //     video.srcObject = stream;
  //     await video.play();

  //     const canvas = document.createElement("canvas");
  //     canvas.width = video.videoWidth;
  //     canvas.height = video.videoHeight;
  //     canvas.getContext("2d")?.drawImage(video, 0, 0);

  //     const base64Image = canvas.toDataURL("image/jpeg");

  //     // Only stop one-off streams
  //     if (isOneOff) {
  //       stream.getTracks().forEach(track => track.stop());
  //     }

  //     setPendingImage(base64Image); // Update UI preview

  //     if (ws && ws.readyState === WebSocket.OPEN) {
  //       ws.send(JSON.stringify({
  //         type: "image_input",
  //         image: base64Image,
  //         source: "shared"
  //       }));

  //       if (autoSend) {
  //         // Robustness: Even if auto-sending, we need to persist this for the response
  //         lastSentImageRef.current = base64Image;
  //         ws.send(JSON.stringify({ type: "commit" }));
  //         setPendingImage(null);
  //       }
  //     } else {
  //       console.warn("WebSocket not ready for screenshot");
  //     }

  //   } catch (e) {
  //     console.error("Screenshot error:", e);
  //   }
  // };
  const handleScreenshot = async (autoSend: boolean = false) => {
    try {
      let stream = screenStreamRef.current;
      let isOneOff = false;

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

      if (isOneOff) {
        stream.getTracks().forEach(track => track.stop());
      }

      // 🔒 RECORDING OWNS THE TURN
      if (isRecording) {
        // Queue screenshot, DO NOT SEND
        setPendingImage(prev => [...prev, base64Image]);
        console.log("📸 Screenshot queued (recording active)");
        return;
      }

      // Normal (not recording) behavior
      setPendingImage([base64Image]);

      if (autoSend) {
        handleCommit();
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
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && event.target?.result) {
            const imgStr = event.target.result as string;
            console.log("Paste Image Data:", imgStr.substring(0, 50) + "...", imgStr.length);
            setPendingImage(prev => [...prev, imgStr]); // Update UI preview
          } else {
            console.warn("WS not ready or paste failed");
          }
        };
        if (blob) reader.readAsDataURL(blob);
      }
    }
  };


  const flushPendingImages = () => {
    const imagesToFlush = pendingImageRef.current;
    const socket = wsRef.current;
    if (imagesToFlush.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
      console.log("🔔 Flushing pending images before commit", imagesToFlush.length);
      imagesToFlush.forEach(img => {
        socket.send(JSON.stringify({
          type: "image_input",
          image: img,
          source: "shared"
        }));
      });
      // Update ref for fallback rendering
      lastSentImageRef.current = imagesToFlush;
      // Clear queue
      setPendingImage([]);
      pendingImageRef.current = [];
    }
  };

  // Output Handlers
  const handleSendText = (text: string) => {
    setCurrentDraft(text);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "text_input", text, mode: "replace" }));
    }
  };

  // Audio Controls - IMPERATIVE ARCHITECTURE
  // We rely on window.currentUtterance instead of Ref to ensure GC safety across re-renders

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeakingText(null);
    window.currentUtterance = null;
  };

  const speakResponse = (text: string) => {
    // 1. Cancel existing
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    if (!text) return;

    // 2. Create Utterance
    const utterance = new SpeechSynthesisUtterance(text);
    window.currentUtterance = utterance; // SUPER STRONG GC protection

    // 3. Bind Events (Update State)
    utterance.onstart = () => {
      setSpeakingText(text);
    };
    utterance.onend = () => {
      setSpeakingText(null);
      window.currentUtterance = null;
    };
    utterance.onerror = (e) => {
      console.error("TTS error", e);
      setSpeakingText(null);
      window.currentUtterance = null;
    };

    // 4. Speak
    window.speechSynthesis.speak(utterance);
  };

  const handleManualMicClick = (text: string) => {
    // UI Handler: Toggles state
    if (speakingText === text) {
      stopSpeaking();
    } else {
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

    // 1. Completion Check (Wait for Explicit Finalization)
    if (!lastMsg?.isFinal) {
      return;
    }

    if (!autoplayResponses) return;

    // 2. Validate it's a new Bot message
    if (!lastMsg || lastMsg.sender !== "bot") return;

    // 3. Idempotency Check (Stable ID)
    if (lastAutoplayMessageIdRef.current === lastMsg.id) {
      return;
    }

    // 4. Speak
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

  const resetSession = () => {
    setMessages([
      {
        id: "init-" + Date.now(),
        sender: "bot",
        text: "Session reset. I am Essence - your Agentic Critic. Click Mic to start.",
        isFinal: true,
      },
    ]);
    dispatchEvaluation({ type: "RESET_EVALUATION" });
    setCurrentDraft("");
    setPendingImage([]);
    setReport(null);
    setReportGenerationCount(0);
    setShowCompletionModal(false);
    lastAutoplayMessageIdRef.current = null;
    toast.success("Session reset successfully");
  };

  useEffect(() => {
    if (evaluationState.currentSection === "RESULTS" && !showCompletionModal && view !== "report") {
      // Immediately switch to report view or show modal
      setShowCompletionModal(true);
      // Small delay before switching view to let user see the final state
      setTimeout(() => setView("report"), 2000);
    }
  }, [evaluationState.currentSection]);

  const handleCommit = () => {
    // Also filter hallucinations at commit time just in case
    const lower = currentDraft.trim().toLowerCase();
    const isHallucination =
      lower === "thank you." ||
      lower === "thank you" ||
      lower === "you" ||
      lower === ".";

    // If hallucination, clear and abort
    if (isHallucination) {
      setCurrentDraft("");
      return;
    }

    // If empty and no image, WAIT for potential backend transcript (latency)
    if (!currentDraft.trim() && pendingImage.length === 0) {
      console.log("Empty draft, waiting for transcript...");
      pendingCommitRef.current = true;
      // Safety timeout: If no transcript arrives in 3s, abort
      setTimeout(() => {
        if (pendingCommitRef.current) {
          console.log("Commit timeout - no transcript arrived.");
          pendingCommitRef.current = false;
        }
      }, 3000);
      return;
    }

    // Normal commit
    if (currentDraft.trim() || pendingImage.length > 0) {
      // 1. Flush Images
      flushPendingImages();

      // Clear draft locally as it will be yielded back by commit_confirmation
      setCurrentDraft("");
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("🚀 Sending commit to backend");
      wsRef.current.send(JSON.stringify({ type: "commit" }));
    }
  };

  const exportChatToPDF = async () => {
    const element = document.getElementById("chat-export");
    if (!element) return;

    element.classList.add("pdf-export");

    const toastId = toast.loading("Generating PDF...");

    try {
      const canvas = await html2canvas(element, {
        scale: 2, // good balance between clarity and size
        useCORS: true,
        backgroundColor: "#ffffff",
        ignoreElements: (element) => element.tagName === 'VIDEO' // ignore video elements if any
      });

      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Canvas dimensions in pixels
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Convert canvas pixels -> PDF mm
      const ratio = pageWidth / canvasWidth;
      const pageHeightPx = pageHeight / ratio;

      let position = 0;
      let pageIndex = 0;

      while (position < canvasHeight) {
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvasWidth;
        pageCanvas.height = Math.min(pageHeightPx, canvasHeight - position);

        const ctx = pageCanvas.getContext("2d");
        if (!ctx) break;

        ctx.drawImage(
          canvas,
          0,
          position,
          canvasWidth,
          pageCanvas.height,
          0,
          0,
          canvasWidth,
          pageCanvas.height
        );

        const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.85); // JPEG drastically reduces size

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          pageImgData,
          "JPEG",
          0,
          0,
          pageWidth,
          (pageCanvas.height * pageWidth) / canvasWidth
        );

        position += pageHeightPx;
        pageIndex++;
      }

      pdf.save(`essence-session-${Date.now()}.pdf`);
      toast.success("PDF Downloaded!", { id: toastId });
    } catch (error) {
      console.error("PDF Export Error:", error);
      toast.error("Failed to export PDF", { id: toastId });
    } finally {
      element.classList.remove("pdf-export");
    }
  };

  const generateReport = async () => {
    console.log("🔵 Generate Report clicked")

    if (reportGenerationCount >= MAX_REPORT_GENERATIONS) {
      console.log("⚠️ Report already generated, switching to report view")
      setView("report")
      return
    }

    try {
      setLoading(true)
      console.log("📡 Sending request to /report endpoint with", messages.length, "messages")

      const response = await fetch(`${API_BASE_URL}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_history: messages })
      })

      console.log("📥 Response received:", response.status)
      const data = await response.json()
      console.log("✅ Raw report data:", data)

      // Check for error in response
      if (data.error) {
        console.error("❌ Backend returned error:", data.error)
        toast.error(`Report generation failed: ${data.error}`)
        return
      }

      // Validate the report structure
      if (!data.report) {
        console.error("❌ No report field in response")
        toast.error("Invalid response format from server")
        return
      }

      // The backend now returns proper JSON object, but handle legacy string format too
      let parsedReport = data

      if (typeof data.report === 'string') {
        console.log("⚠️ Report is a string (legacy format), attempting to parse...")
        try {
          let reportStr = data.report.trim()
          // Remove markdown code blocks if present
          if (reportStr.startsWith('```json')) {
            reportStr = reportStr.replace(/^```json\s*/, '').replace(/\s*```$/, '')
          } else if (reportStr.startsWith('```')) {
            reportStr = reportStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
          }
          parsedReport = { report: JSON.parse(reportStr) }
          console.log("✅ Successfully parsed string JSON report")
        } catch (parseError) {
          console.error("❌ Failed to parse report JSON:", parseError)
          toast.error("Report format is invalid - not valid JSON")
          return
        }
      } else if (typeof data.report === 'object') {
        console.log("✅ Report is already a JSON object (expected format)")
        parsedReport = data
      } else {
        console.error("❌ Unexpected report format:", typeof data.report)
        toast.error("Report format is invalid")
        return
      }

      console.log("📊 Final parsed report structure:", parsedReport)
      setReport(parsedReport)
      setReportGenerationCount(prev => prev + 1)

      setView("report") // ✅ switch to report view

    } catch (error) {
      console.error("❌ Failed to generate report:", error)
      toast.error("Failed to generate report")
    } finally {
      setLoading(false)
    }
  }

  if (!isBackendConnected) {
    return (
      <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden justify-center items-center">
        <Loader />
      </div>
    );
  }

  if (view === "report") {
    return <ProjectReport onBack={() => setView("chat")} report={report} />;
  }

  const currentSectionLabel =
    EVALUATION_SECTIONS.find(section => section.key === evaluationState.currentSection)?.label
    ?? EVALUATION_SECTIONS[0].label;

  return (
    <div
      className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden"
      onPaste={handlePaste} // Global paste listener for simplicity
    >
      <Toaster position="top-center" toastOptions={{
        style: { background: '#333', color: '#fff' }
      }} />
      {/* Header */}
      <Toaster position="top-center" toastOptions={{
        style: { background: '#333', color: '#fff' }
      }} />

      <Navbar
        status={status}
        isRecording={isRecording}
        autoplayResponses={autoplayResponses}
        onToggleAutoplay={toggleAutoplay}
        onGenerateReport={generateReport}
        onExportPDF={exportChatToPDF}
        macroCompletedChunks={evaluationState.completedSections}
        sectionLabel={currentSectionLabel}
        sectionProgress={evaluationState.sectionProgress}
      />

      {showCompletionModal && (
        <CompletionDashboard 
          onGenerateReport={generateReport}
          onDownloadPDF={exportChatToPDF}
          onReset={resetSession}
        />
      )}

      {/* Chat Area (scrollable only here) */}
      <main id="chat-export" className="flex-1 overflow-y-auto px-4 md:px-16 py-6 space-y-4 scrollbar-hide relative">
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            sender={msg.sender}
            text={msg.text}
            image={msg.image}
            images={msg.images}
            isPlaying={speakingText === msg.text}
            onPlay={handleManualMicClick}
          />
        ))}
        <div ref={chatEndRef} />

        {/* Context Preview Indicator - Always show if image pending or active */}
        {(status === "ACTIVE" || status === "RESPONDING" || pendingImage.length > 0) && (
          <div className="fixed bottom-24 right-4 flex flex-col items-end space-y-2 animate-in fade-in slide-in-from-bottom-2 z-50">
            {pendingImage.length > 0 && (
              <div className="flex gap-2">
                {pendingImage.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img}
                      alt={`Pending Context ${idx + 1}`}
                      onError={(e) => console.error("Image load error", e)}
                      className="w-24 h-auto rounded-lg border-2 border-teal-500/50 shadow-lg object-cover bg-gray-900"
                    />
                    <div className="absolute -top-2 -right-2 bg-teal-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">
                      IMG
                    </div>
                  </div>
                ))}
              </div>
            )}
            {status === "ACTIVE" && pendingImage.length === 0 && (
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
          value={currentDraft} // Controlled input
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
          Click Mic to start and stop recording
        </div>
      </footer>
    </div>
  );
};

export default App;

