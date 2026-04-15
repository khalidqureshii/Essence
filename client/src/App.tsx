import React, { useState, useRef, useEffect, useReducer } from "react";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import Loader from "./components/Loader";
import { Toaster, toast } from "react-hot-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import ProjectReport from "./Pages/ProjectReport";
import InterviewReport from "./Pages/InterviewReport";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import CompletionDashboard from "./components/CompletionDashboard";
import { X } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://essence-gf00.onrender.com";
const LOCAL_API_BASE_URL = import.meta.env.VITE_LOCAL_API_BASE_URL || "http://localhost:8000";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  image?: string;
  images?: string[];
  isFinal?: boolean;
  isSetupMessage?: boolean;
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
const PROD_WS_URL = API_BASE_URL.replace(/^http/, "ws") + "/chatbot/ws";
const WS_URL = import.meta.env.VITE_LOCAL_WS_URL || PROD_WS_URL;

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
      text: "Welcome to Essence! Please select an interview mode to begin:",
      isFinal: true,
      isSetupMessage: true,
    },
  ]);
  const [appMode, setAppMode] = useState<"project" | "resume" | null>(null);
  const [setupStep, setSetupStep] = useState<"mode" | "resume_focus" | "resume_time" | "autoplay_config" | "resume_upload" | "complete">("mode");
  const [resumeParsedText, setResumeParsedText] = useState("");
  const [interviewTimeLimit, setInterviewTimeLimit] = useState<number>(15);
  const [interviewFocus, setInterviewFocus] = useState<string>("general");
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"INACTIVE" | "ACTIVE" | "RESPONDING">("INACTIVE");
  const [serverProgressData, setServerProgressData] = useState<{macro_completed_chunks: number, micro_section_progress: number, section: string} | null>(null);
  const [view, setView] = useState<"chat" | "report">("chat");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [currentDraft, setCurrentDraft] = useState("");
  // const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [speakingText, setSpeakingText] = useState<string | null>(null);
  const [autoplayResponses, setAutoplayResponses] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reportGenerationCount, setReportGenerationCount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasConcluded, setHasConcluded] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (setupStep === "complete" && appMode === "resume") {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev === null) return null;
          if (prev <= 0) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [setupStep, appMode]);

  useEffect(() => {
    if (timeRemaining === 0 && !hasConcluded && appMode === "resume" && setupStep === "complete") {
      // If the timer is 0 and there is no active input/speaking, conclude the interview automatically
      if (!isRecording && status === "INACTIVE" && currentDraft.trim() === "" && pendingImage.length === 0) {
        setHasConcluded(true);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
           wsRef.current.send(JSON.stringify({ 
             type: "text_input", 
             text: "[System] The interview time has expired. The user has not provided further input and is idle. Please conclude the interview immediately using a standard closing line. Do not ask any further questions.",
             mode: "append" 
           }));
           wsRef.current.send(JSON.stringify({ type: "commit" }));
        }
      }
    }
  }, [timeRemaining, hasConcluded, appMode, setupStep, isRecording, status, currentDraft, pendingImage]);

  const [evaluationState, dispatchEvaluation] = useReducer(evaluationReducer, {
    currentSectionIndex: 0,
    currentSection: EVALUATION_SECTIONS[0].key,
    sectionConfidence: 0,
    sectionProgress: 0,
    completedSections: 0
  });

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
  const isCancellingRef = useRef(false);


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
              if (data.payload === "RESPONDING" || data.payload?.is_responding) {
                setStatus("RESPONDING");
              } else {
                if (data.payload === "ACTIVE" || data.payload?.active) setStatus("ACTIVE");
                else if (data.payload === "INACTIVE" || data.payload?.active === false) setStatus("INACTIVE");

                // Mark last bot message as final when responding stops
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.sender === "bot" && !last.isFinal) {
                    return [...prev.slice(0, -1), { ...last, isFinal: true }];
                  }
                  return prev;
                });
              }
              
              if (typeof data.payload === "object" && data.payload?.section) {
                setServerProgressData({
                  macro_completed_chunks: data.payload.macro_completed_chunks,
                  micro_section_progress: data.payload.micro_section_progress,
                  section: data.payload.section
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

                if (displayText.startsWith("[System]")) {
                  return prev;
                }

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
      isCancellingRef.current = false;
      setCurrentDraft("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size <= 0) return;

        // Send audio chunk
        const socket = wsRef.current;
        if (socket && socket.readyState === WebSocket.OPEN && !speakingText && !isCancellingRef.current) {
          socket.send(event.data);
          // debug logging
          event.data.arrayBuffer().then(buf =>
            console.log("Sent chunk bytes:", buf.byteLength)
          );
        } else if (!isCancellingRef.current) {
          console.warn("Cannot send audio chunk: ws not open");
        }

        // If we are in stopping mode, this was the FINAL chunk.
        // Trigger commit only AFTER this chunk has been sent.
        if (isStoppingRef.current) {
          isStoppingRef.current = false;

          if (!isCancellingRef.current) {
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
    isCancellingRef.current = true;
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
    setAppMode(null);
    setSetupStep("mode");
    setResumeParsedText("");
    
    setMessages([
      {
        id: "init-" + Date.now(),
        sender: "bot",
        text: "Session reset. Please select an interview mode to begin:",
        isFinal: true,
        isSetupMessage: true,
      },
    ]);
    
    // Backend Reset Notification
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
       wsRef.current.send(JSON.stringify({
          type: "reset",
          mode: "project",
          resume_text: "",
          focus_mode: "general",
          time_limit: 15
       }));
    }

    dispatchEvaluation({ type: "RESET_EVALUATION" });
    setCurrentDraft("");
    setPendingImage([]);
    setReport(null);
    setReportGenerationCount(0);
    setTimeRemaining(null);
    setHasConcluded(false);
    setShowCompletionModal(false);
    lastAutoplayMessageIdRef.current = null;
    toast.success("Session reset successfully");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pdf")) {
      toast.error("Please upload a PDF file.");
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading("Processing Resume...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${LOCAL_API_BASE_URL}/api/upload_resume`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process PDF");
      }

      const data = await response.json();
      if (data.parsed_text && data.parsed_text.trim().length > 50) {
        setResumeParsedText(data.parsed_text);
        toast.success("Resume processed successfully! Starting interview...", { id: toastId });
        
        setSetupStep("complete");
        setTimeRemaining(interviewTimeLimit * 60);
        setMessages(prev => [
            ...prev,
            { id: crypto.randomUUID(), sender: "user", text: "Uploaded Resume ✅", isFinal: true }
        ]);

        // Let backend know the resume context was loaded
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
           wsRef.current.send(JSON.stringify({
              type: "reset",
              mode: appMode || "resume",
              resume_text: data.parsed_text,
              focus_mode: interviewFocus,
              time_limit: interviewTimeLimit
           }));
        }
      } else {
        toast.error("Extracted text too small. Vision fallback not enabled.", { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error connecting to server.", { id: toastId });
    } finally {
      setIsUploading(false);
    }
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
      if (timeRemaining === 0 && !hasConcluded && appMode === "resume" && setupStep === "complete") {
         setHasConcluded(true);
         wsRef.current.send(JSON.stringify({ 
           type: "text_input", 
           text: " [System] The interview time has expired. Please address the user's response concisely and then immediately conclude the interview with a closing line. Do not ask any further questions.", 
           mode: "append" 
         }));
      }
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

  const generateProjectReport = async () => {
    console.log("🔵 Generate Project Report clicked")

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
      console.log("✅ Raw project report data:", data)

      if (data.error) {
        console.error("❌ Backend returned error:", data.error)
        toast.error(`Report generation failed: ${data.error}`)
        return
      }

      let parsedReport = data

      if (typeof data.report === 'string') {
        try {
          let reportStr = data.report.trim()
          if (reportStr.startsWith('```json')) {
            reportStr = reportStr.replace(/^```json\s*/, '').replace(/\s*```$/, '')
          } else if (reportStr.startsWith('```')) {
            reportStr = reportStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
          }
          parsedReport = { report: JSON.parse(reportStr) }
        } catch (parseError) {
          console.error("❌ Failed to parse report JSON:", parseError)
          toast.error("Report format is invalid - not valid JSON")
          return
        }
      } else if (typeof data.report === 'object') {
        parsedReport = data
      } else {
        console.error("❌ Unexpected report format:", typeof data.report)
        toast.error("Report format is invalid")
        return
      }

      setReport(parsedReport)
      setReportGenerationCount(prev => prev + 1)
      setView("report")

    } catch (error) {
      console.error("❌ Failed to generate project report:", error)
      toast.error("Failed to generate report")
    } finally {
      setLoading(false)
    }
  }

  const generateInterviewReport = async () => {
    console.log("🔵 Generate Interview Report clicked")
    console.log("📋 interviewFocus:", interviewFocus, "timeLimit:", interviewTimeLimit)
    console.log("📋 resumeParsedText length:", resumeParsedText?.length)
    console.log("📋 messages:", messages.length)

    if (reportGenerationCount >= MAX_REPORT_GENERATIONS) {
      console.log("⚠️ Report already generated, switching to report view")
      setView("report")
      return
    }

    try {
      setLoading(true)
      console.log("📡 Sending request to LOCAL /api/interview_report endpoint")

      const response = await fetch(`${LOCAL_API_BASE_URL}/api/interview_report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chat_history: messages,
          resume_text: resumeParsedText || "",
          interview_type: interviewFocus || "general",
          duration_mins: interviewTimeLimit || 5
        })
      })

      console.log("📥 HTTP status:", response.status)
      const data = await response.json()
      console.log("📦 Raw response data:", JSON.stringify(data).slice(0, 500))
      
      if (data.error) {
        console.error("❌ Backend returned error:", data.error, data.raw_response)
        toast.error(`Report generation failed: ${data.error}`)
        return
      }

      // data = { report: { meta, scorecard, ... } }
      console.log("✅ Setting report data, keys:", Object.keys(data))
      setReport(data)
      setReportGenerationCount(prev => prev + 1)
      setView("report")

    } catch (error) {
      console.error("❌ Failed to generate interview report:", error)
      toast.error("Failed to generate report")
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    if (appMode === "resume") {
      await generateInterviewReport()
    } else {
      await generateProjectReport()
    }
  }

  const handleSelectProjectMode = () => {
    setAppMode("project");
    setSetupStep("autoplay_config");
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), sender: "user", text: "Project Mode", isFinal: true },
      { id: crypto.randomUUID(), sender: "bot", text: "Project Mode selected. Would you like to enable Autoplay for my voice responses?", isFinal: true, isSetupMessage: true }
    ]);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
       wsRef.current.send(JSON.stringify({
          type: "reset",
          mode: "project",
          resume_text: "",
          focus_mode: "general",
          time_limit: 15
       }));
    }
  };

  const handleSelectResumeMode = () => {
    setAppMode("resume");
    setSetupStep("resume_focus");
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), sender: "user", text: "Resume Mode", isFinal: true },
      { id: crypto.randomUUID(), sender: "bot", text: "Please select an interview focus:", isFinal: true, isSetupMessage: true }
    ]);
  };

  const handleSelectFocus = (focus: string, label: string) => {
    setInterviewFocus(focus);
    setSetupStep("resume_time");
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), sender: "user", text: label, isFinal: true },
      { id: crypto.randomUUID(), sender: "bot", text: "Please select an interview time limit:", isFinal: true, isSetupMessage: true }
    ]);
  };

  const handleSelectTime = (minutes: number) => {
    setInterviewTimeLimit(minutes);
    setSetupStep("autoplay_config");
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), sender: "user", text: `${minutes} Minutes`, isFinal: true },
      { id: crypto.randomUUID(), sender: "bot", text: "Would you like to enable Autoplay for my voice responses?", isFinal: true, isSetupMessage: true }
    ]);
  };

  const handleSelectAutoplay = (enable: boolean) => {
    setAutoplayResponses(enable);
    localStorage.setItem("autoplayResponses", String(enable));
    
    if (appMode === "project") {
      setSetupStep("complete");
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), sender: "user", text: enable ? "Enable Autoplay" : "Keep Autoplay Off", isFinal: true },
        { id: crypto.randomUUID(), sender: "bot", text: "Please share your project details (repo link, description, etc.) to get started. Click the Mic when you're ready.", isFinal: true, isSetupMessage: true }
      ]);
    } else {
      setSetupStep("resume_upload");
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), sender: "user", text: enable ? "Enable Autoplay" : "Keep Autoplay Off", isFinal: true },
        { id: crypto.randomUUID(), sender: "bot", text: "Please upload your resume to begin.", isFinal: true, isSetupMessage: true }
      ]);
    }
  };

  const renderInteractiveUI = () => {
    const btnClass = "app-btn bg-secondary text-white hover:brightness-125 px-5 py-2 text-sm shadow-md border border-border transition-all";

    if (setupStep === "mode") {
      return (
        <div className="flex flex-row space-x-3 mt-1">
          <button onClick={handleSelectProjectMode} className={btnClass}>
            Project Mode
          </button>
          <button onClick={handleSelectResumeMode} className={btnClass}>
            Resume Mode
          </button>
        </div>
      );
    }

    if (setupStep === "resume_focus") {
      return (
        <div className="flex flex-row flex-wrap gap-3 mt-1">
          <button onClick={() => handleSelectFocus("general", "General")} className={btnClass}>
            General
          </button>
          <button onClick={() => handleSelectFocus("skills", "Technical Skills")} className={btnClass}>
            Technical Skills
          </button>
          <button onClick={() => handleSelectFocus("projects", "Projects Focus")} className={btnClass}>
            Projects Focus
          </button>
        </div>
      );
    }

    if (setupStep === "resume_time") {
      return (
        <div className="flex flex-row space-x-3 mt-1">
          <button onClick={() => handleSelectTime(1)} className={btnClass}>
            1 Minute
          </button>
          <button onClick={() => handleSelectTime(5)} className={btnClass}>
            5 Minutes
          </button>
          <button onClick={() => handleSelectTime(15)} className={btnClass}>
            15 Minutes
          </button>
          <button onClick={() => handleSelectTime(60)} className={btnClass}>
            60 Minutes
          </button>
        </div>
      );
    }

    if (setupStep === "autoplay_config") {
      return (
        <div className="flex flex-row space-x-3 mt-1">
          <button onClick={() => handleSelectAutoplay(true)} className={btnClass}>
            Yes, Enable Autoplay
          </button>
          <button onClick={() => handleSelectAutoplay(false)} className={btnClass}>
            No, Keep it Off
          </button>
        </div>
      );
    }

    if (setupStep === "resume_upload") {
      return (
        <div className="mt-1">
           <label className={`cursor-pointer flex items-center justify-center ${btnClass}`}>
             {isUploading ? "Processing..." : "Select Resume (PDF)"}
             <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
           </label>
        </div>
      );
    }

    return null;
  };

  if (!isBackendConnected) {
    return (
      <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden justify-center items-center">
        <Loader />
      </div>
    );
  }

  if (view === "report") {
    if (appMode === "resume") {
      return <InterviewReport onBack={() => setView("chat")} report={report} duration={interviewTimeLimit || 15} />;
    } else {
      return <ProjectReport onBack={() => setView("chat")} report={report} />;
    }
  }

  const currentSectionLabel =
    appMode === "resume" && serverProgressData
      ? serverProgressData.section
      : EVALUATION_SECTIONS.find(section => section.key === evaluationState.currentSection)?.label ?? EVALUATION_SECTIONS[0].label;

  const currentMacroChunks = appMode === "resume" && serverProgressData
      ? serverProgressData.macro_completed_chunks
      : evaluationState.completedSections;

  const currentSectionProgress = appMode === "resume" && serverProgressData
      ? serverProgressData.micro_section_progress
      : evaluationState.sectionProgress;

  return (
    <div
      className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden"
      onPaste={handlePaste} // Global paste listener for simplicity
    >
      <Toaster position="top-center" toastOptions={{
        style: { background: '#333', color: '#fff' }
      }} />
      {/* Header */}

      <Navbar
        status={status}
        isRecording={isRecording}
        autoplayResponses={autoplayResponses}
        onToggleAutoplay={toggleAutoplay}
        onGenerateReport={generateReport}
        onExportPDF={exportChatToPDF}
        macroCompletedChunks={currentMacroChunks}
        sectionLabel={currentSectionLabel}
        sectionProgress={currentSectionProgress}
        isModeLocked={setupStep === "complete"}
        timeRemaining={timeRemaining}
        onToggleSidebar={() => setIsSidebarOpen(true)}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        macroCompletedChunks={serverProgressData ? serverProgressData.macro_completed_chunks : evaluationState.completedSections}
        sectionLabel={currentSectionLabel}
        sectionProgress={currentSectionProgress}
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
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          const showUI = isLast && msg.sender === "bot" && setupStep !== "complete";

          return (
            <ChatMessage
              key={msg.id || i}
              sender={msg.sender}
              text={msg.text}
              image={msg.image}
              images={msg.images}
              isPlaying={speakingText === msg.text}
              onPlay={msg.isSetupMessage ? undefined : handleManualMicClick}
            >
              {showUI && renderInteractiveUI()}
            </ChatMessage>
          );
        })}
        <div ref={chatEndRef} />

        {/* See Feedback Button */}
        {(hasConcluded || (appMode === "resume" && serverProgressData?.section === "COMPLETED")) && status !== "RESPONDING" && (
           <div className="flex justify-center mt-8 animate-in fade-in slide-in-from-bottom pb-8">
             <button
               onClick={generateReport}
               disabled={loading}
               className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-4 px-8 rounded-full shadow-xl hover:scale-105 transition-all flex items-center gap-2 text-lg disabled:opacity-70 disabled:hover:scale-100"
             >
               {loading ? (
                 <div className="flex items-center space-x-2">
                   <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                   <span>Generating Feedback...</span>
                 </div>
               ) : (
                 "SEE FEEDBACK"
               )}
             </button>
           </div>
        )}

        {/* Context Preview Indicator - Always show if image pending or active */}
        {!(hasConcluded || serverProgressData?.section === "COMPLETED") && (status === "ACTIVE" || status === "RESPONDING" || pendingImage.length > 0) && (
          <div className="fixed bottom-24 right-4 flex flex-col items-end space-y-2 animate-in fade-in slide-in-from-bottom-2 z-50">
            {pendingImage.length > 0 && (
              <div className="flex gap-2">
                {pendingImage.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img}
                      alt={`Pending Context ${idx + 1}`}
                      onError={(e) => console.error("Image load error", e)}
                      className="w-24 h-auto rounded-lg border-2 border-border shadow-lg object-cover bg-background"
                    />
                    <button
                      onClick={() => setPendingImage(prev => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md z-10 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                      title="Remove Image"
                    >
                      <X size={12} strokeWidth={3} />
                    </button>
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full z-0 opacity-0 md:opacity-100 group-hover:opacity-0 transition-opacity pointer-events-none">
                      IMG
                    </div>
                  </div>
                ))}
              </div>
            )}
            {status === "ACTIVE" && pendingImage.length === 0 && (
              <div className="bg-card/90 border border-border p-3 rounded-lg backdrop-blur-sm shadow-xl flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span className="text-xs text-primary font-medium">Turn Active</span>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-4 border-t border-border bg-background flex-shrink-0">
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
          disabled={status === "RESPONDING" || hasConcluded || (appMode === "resume" && serverProgressData?.section === "COMPLETED")}
        />
        <div className="text-xs text-muted-foreground text-center mt-2">
          Click Mic to start and stop recording
        </div>
      </footer>
    </div>
  );
};

export default App;

