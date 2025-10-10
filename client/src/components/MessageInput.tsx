import React, { useState, useRef } from "react";
import { Paperclip, Mic, Send } from "lucide-react";

interface MessageInputProps {
  onSend: (message: string) => void;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend }) => {
  const [message, setMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSend = () => {
    if (!message.trim()) return;
    onSend(message);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center bg-gray-800 rounded-lg shadow-lg px-4 py-2 space-x-3">
      {/* File upload */}
      {/* <button
        onClick={() => fileInputRef.current?.click()}
        className="text-gray-400 hover:text-teal-400 transition"
        title="Attach file"
      > */}
      <Paperclip
        onClick={() => fileInputRef.current?.click()}
        className="text-gray-400 hover:text-teal-400 transition cursor-pointer "
        size={22}
      />
      {/* </button> */}
      <input type="file" ref={fileInputRef} className="hidden" />

      {/* Text input */}
      <textarea
        rows={1}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        className="flex-1 resize-none bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none"
      />

      {/* Mic icon (future feature) */}
      {/* <button
        className="text-gray-400 hover:text-red-400 transition"
        title="Voice input"
      > */}
      <Mic
        className="text-gray-400 hover:text-red-400 transition cursor-pointer "
        size={22}
      />
      {/* </button> */}

      {/* Send button */}
      <button
        onClick={handleSend}
        className="bg-teal-500 hover:bg-teal-600 text-white p-2 rounded-full transition"
        title="Send"
      >
        <Send size={20} />
      </button>
    </div>
  );
};

export default MessageInput;
