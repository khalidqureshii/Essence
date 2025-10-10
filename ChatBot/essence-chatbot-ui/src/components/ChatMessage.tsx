import React from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  sender: "user" | "bot";
  text: string;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ sender, text }) => {
  const isUser = sender === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl shadow-md whitespace-pre-wrap leading-relaxed ${
          isUser
            ? "bg-teal-600 text-white rounded-br-none"
            : "bg-gray-700 text-gray-100 rounded-bl-none"
        }`}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            components={{
              code: (props: any) => {
                const { inline, children } = props;
                if (!inline) {
                  return (
                    <pre className="bg-gray-900 text-gray-100 p-2 rounded-lg overflow-x-auto">
                      <code>{children}</code>
                    </pre>
                  );
                }
                return (
                  <code className="bg-gray-700 text-gray-100 px-1 py-0.5 rounded">
                    {children}
                  </code>
                );
              },
              a: (props: any) => (
                <a
                  href={props.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-400 hover:underline"
                >
                  {props.children}
                </a>
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        </div>

        {/* <ReactMarkdown
          // @ts-expect-error: TypeScript types for custom renderers
          className="prose prose-invert prose-sm max-w-none"
          components={{
            code: (props: any) => {
              const { inline, children } = props;
              if (!inline) {
                return (
                  <pre className="bg-gray-900 text-gray-100 p-2 rounded-lg overflow-x-auto">
                    <code>{children}</code>
                  </pre>
                );
              }
              return (
                <code className="bg-gray-700 text-gray-100 px-1 py-0.5 rounded">
                  {children}
                </code>
              );
            },
            a: (props: any) => (
              <a
                href={props.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-400 hover:underline"
              >
                {props.children}
              </a>
            ),
          }}
        >
          {text}
        </ReactMarkdown> */}
      </div>
    </div>
  );
};

export default ChatMessage;
