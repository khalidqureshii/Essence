import React, { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";
import { API_BASE_URL } from "./config";

interface Message {
  sender: "user" | "bot";
  text: string;
}

const API_URL = `${API_BASE_URL}/chatbot/stream`;

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hi, I am Essence - your Agentic Critic. How can I help you today?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () =>
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToBottom, [messages]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async (text: string, audioBlob?: Blob, screenshot?: string) => {
    if (!text.trim() && !audioBlob && !screenshot) return;

    const userMessage: Message = { sender: "user", text: text || (audioBlob ? "[Audio Message]" : "[Screen Capture]") };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const formData = new FormData();
      if (text) formData.append("text", text);
      if (audioBlob) formData.append("audio", audioBlob, "audio.wav");
      if (screenshot) formData.append("image", screenshot.split(',')[1]); // Base64 after comma

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botText = "";
      let hasStartedSpeaking = false;

      // Add placeholder bot message
      setMessages((prev) => [...prev, { sender: "bot", text: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        botText += chunk;

        // Update last message
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = botText;
          return newMessages;
        });

        // Trigger TTS logic
        if (!hasStartedSpeaking && botText.includes("QUESTION:") && botText.includes("REASONING:")) {
          const questionMatch = botText.match(/QUESTION: (.*?)\n/s);
          if (questionMatch && questionMatch[1]) {
            speak(questionMatch[1]);
            hasStartedSpeaking = true;
          }
        }
      }
    } catch (err) {
      console.error("Stream error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "⚠️ Error connecting to the server. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
      {/* Header */}
      <header className="p-4 text-center border-b border-gray-700 shadow-md flex-shrink-0">
        <h1 className="text-2xl font-bold text-teal-400">
          Essence - Agentic Critic
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          AI-powered constructive analysis chatbot
        </p>
      </header>

      {/* Chat Area (scrollable only here) */}
      <main className="flex-1 overflow-y-auto px-4 md:px-16 py-6 space-y-4 scrollbar-hide">
        {messages.map((msg, i) => (
          <ChatMessage key={i} sender={msg.sender} text={msg.text} />
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 px-4 py-2 rounded-2xl animate-pulse">
              Essence is thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </main>

      <footer className="p-4 border-t border-gray-700 bg-gray-900 flex-shrink-0">
        <MessageInput onSend={sendMessage} disabled={loading} />
      </footer>
    </div>
  );
};

export default App;
