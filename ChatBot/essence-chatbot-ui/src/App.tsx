import React, { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/ChatMessage";
import MessageInput from "./components/MessageInput";

interface Message {
  sender: "user" | "bot";
  text: string;
}

const API_URL = "https://essence-gf00.onrender.com/chatbot";

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

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMessage: Message = { sender: "user", text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await response.json();
      const botReply = data.reply || "Sorry, I couldn’t understand that.";
      setMessages((prev) => [...prev, { sender: "bot", text: botReply }]);
    } catch {
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white overflow-hidden">
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

      {/* Message Input (fixed at bottom) */}
      <footer className="p-4 border-t border-gray-700 bg-gray-900 flex-shrink-0">
        <MessageInput onSend={sendMessage} />
      </footer>
    </div>
  );
};

export default App;
