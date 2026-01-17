import React from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  sender: "user" | "bot";
  text: string;
  image?: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ sender, text, image }) => {
  const isUser = sender === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4 animate-in fade-in slide-in-from-bottom-2`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${isUser
            ? "bg-teal-600 text-white rounded-br-none"
            : "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700"
          }`}
      >
        {image && (
          <img
            src={image}
            alt="Context"
            className="mb-3 rounded-lg max-h-60 w-auto object-cover border border-white/10"
          />
        )}

        <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
          <ReactMarkdown
            components={{
              code: (props: any) => {
                const { inline, children } = props;
                if (!inline) {
                  return (
                    <pre className="bg-gray-900 text-gray-100 p-2 rounded-lg overflow-x-auto my-2 border border-gray-700">
                      <code>{children}</code>
                    </pre>
                  );
                }
                return (
                  <code className="bg-gray-700 text-gray-100 px-1 py-0.5 rounded text-sm">
                    {children}
                  </code>
                );
              },
              a: (props: any) => (
                <a
                  href={props.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:underline hover:text-teal-300"
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
      </div>
    </div>
  );
};

export default ChatMessage;
