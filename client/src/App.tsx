import React, { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import Loader from "./components/Loader";
import { Toaster, toast } from "react-hot-toast";
import SpeechRecognition, {
  useSpeechRecognition
} from "react-speech-recognition";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import ProjectReport from "./Pages/ProjectReport";

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
  const [evaluationProgress, setEvaluationProgress] = useState(0);

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
              const fallbackImages = lastSentImageRef.current;
              // Clear immediately as it's consumed
              lastSentImageRef.current = []; // cleared in handleCommit already but safe to ensure

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
                const displayText = data.payload.text || (hasImages ? "" : "🎤 (Audio Message)");

                return [...prev, {
                  id: crypto.randomUUID(),
                  sender: "user",
                  text: displayText,
                  images: imagesToUse
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


  //New Audio Recording code

  const {
    transcript,
    resetTranscript
  } = useSpeechRecognition();

  useEffect(() => {
    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      console.error("STT not supported");
      return;
    }

    SpeechRecognition.startListening({
      continuous: true,
      language: "en-US"
    });

    return () => {
      SpeechRecognition.stopListening();
    };
  }, []);

  useEffect(() => {
    const text = transcript.toLowerCase().trim();
    if (!text) return;

    console.log("🎧 Transcript Update:", text);

    // START: "essence"
    if (
      /\bessence\b/.test(text) &&
      !isRecording
    ) {
      startRecording();
      resetTranscript(); // important to avoid repeat trigger
    }

    // STOP: "over"
    if (
      /\bover\b/.test(text) &&
      isRecording
    ) {
      stopRecording();
      setTimeout(() => {
        handleCommit();
        resetTranscript();
      }, 1200); // 🔑 allow audio flush
    }
  }, [transcript]);

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

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "image_input",
          image: base64Image,
          source: "shared"
        }));

        if (autoSend) {
          wsRef.current.send(JSON.stringify({ type: "commit" }));
          setPendingImage([]);
        }
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
            wsRef.current.send(JSON.stringify({
              type: "image_input",
              image: imgStr,
              source: "pasted"
            }));
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

      // 2. Clear Draft
      setCurrentDraft("");
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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



  return (
    <div
      className="h-screen w-screen flex flex-col bg-white text-gray-900 overflow-hidden"
      onPaste={handlePaste}
    >
      <Toaster position="top-center" toastOptions={{
        style: { background: '#f5f5f5', color: '#000' }
      }} />

      {/* Minimalist Header */}
      <header className="border-b border-gray-200 px-6 md:px-12 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-tight text-cyan-600">Essence</h1>
            <p className="text-xs text-gray-500 uppercase tracking-widest mt-1 font-medium">
              Agentic Critic
            </p>
          </div>
          <div className="flex items-center space-x-6">
            {isRecording ? (
              <div className="flex items-center space-x-2 bg-red-50 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-red-600 font-semibold">RECORDING</span>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={autoplayResponses}
                    onChange={toggleAutoplay}
                    className="w-4 h-4 accent-cyan-600 rounded"
                  />
                  <span className="text-xs text-gray-600 font-medium group-hover:text-cyan-600 transition-colors">Auto-play</span>
                </label>
                <button
                  onClick={generateReport}
                  className="text-xs px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors font-medium"
                >
                  Generate Report
                </button>
                <button
                  onClick={exportChatToPDF}
                  className="text-xs px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 transition-colors font-medium"
                >
                  Download PDF
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Indicator with Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Status: {status}
            </span>
            {status === "RESPONDING" && (
              <span className="text-xs text-cyan-600 font-medium">Evaluating...</span>
            )}
          </div>
          <div className="w-full bg-gray-200 h-1 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-500 ease-out rounded-full"
              style={{
                width: status === "RESPONDING" ? "100%" : status === "ACTIVE" ? "50%" : "0%"
              }}
            ></div>
          </div>
        </div>
      </header>

      {/* Main Chat Area - Centered & Spacious */}
      <main id="chat-export" className="flex-1 overflow-y-auto px-6 md:px-20 py-8 space-y-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-20">💬</div>
                <p className="text-gray-500 font-light">Start a conversation</p>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessage
                key={i}
                sender={msg.sender}
                text={msg.text}
                image={msg.image}
                images={msg.images}
                isPlaying={speakingText === msg.text}
                onPlay={handleManualMicClick}
              />
            ))
          )}
          <div ref={chatEndRef} />

          {/* Floating Context Preview */}
          {pendingImage.length > 0 && (
            <div className="flex gap-3 flex-wrap justify-end">
              {pendingImage.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img}
                    alt={`Context ${idx + 1}`}
                    className="w-20 h-20 rounded-lg border-2 border-cyan-500/30 shadow-sm object-cover"
                  />
                  <div className="absolute -top-2 -right-2 bg-cyan-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Input Footer - Sticky */}
      <footer className="border-t border-gray-200 bg-white px-6 md:px-20 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <MessageInput
            onSend={() => {
              if (isRecording) finishRecording();
              else handleCommit();
            }}
            value={currentDraft}
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
          <p className="text-xs text-gray-400 text-center mt-3 font-light">
            Say <span className="font-semibold text-gray-600">Essence</span> to start • <span className="font-semibold text-gray-600">Over</span> to send
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
