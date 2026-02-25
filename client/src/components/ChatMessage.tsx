import React from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  sender: "user" | "bot";
  text: string;
  image?: string;
  images?: string[];
  onPlay?: (text: string) => void;
  isPlaying?: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ sender, text, image, images, onPlay, isPlaying }) => {
  const isUser = sender === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}>
      <div
        className={`max-w-md rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-cyan-100 text-gray-900 rounded-br-sm shadow-sm"
            : "bg-gray-100 text-gray-900 rounded-bl-sm shadow-sm"
        }`}
      >
        {/* Images */}
        {image && !images && (
          <img
            src={image}
            alt="Context"
            className="mb-3 rounded-lg max-h-56 w-auto object-cover border border-gray-200"
          />
        )}

        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {images.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Context ${idx + 1}`}
                className="rounded-lg max-h-40 w-auto object-cover border border-gray-200"
              />
            ))}
          </div>
        )}

        {/* Text Content */}
        <div className="prose prose-sm max-w-none leading-relaxed text-gray-900">
          <ReactMarkdown
            components={{
              code: (props: any) => {
                const { inline, children } = props;
                if (!inline) {
                  return (
                    <pre className="bg-gray-200 text-gray-900 p-2 rounded overflow-x-auto my-2 border border-gray-300">
                      <code>{children}</code>
                    </pre>
                  );
                }
                return (
                  <code className="bg-gray-200 text-gray-900 px-1 py-0.5 rounded text-sm">
                    {children}
                  </code>
                );
              },
              a: (props: any) => (
                <a
                  href={props.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-600 hover:underline font-medium"
                >
                  {props.children}
                </a>
              ),
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>
            }}
          >
            {text}
          </ReactMarkdown>
        </div>

        {/* Listen Button */}
        {!isUser && onPlay && (
          <div className="mt-3 flex justify-start">
            <button
              onClick={() => onPlay(text)}
              className={`text-xs font-semibold tracking-wide p-2 rounded transition-colors flex items-center gap-2 ${
                isPlaying
                  ? "text-red-600 bg-red-50"
                  : "text-cyan-600 hover:bg-cyan-50"
              }`}
              title={isPlaying ? "Stop" : "Listen"}
            >
              {isPlaying ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z" clipRule="evenodd" />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 2.75 2.75 0 000-11.668.75.75 0 010-1.06z" />
                    <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                  </svg>
                  Listen
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
