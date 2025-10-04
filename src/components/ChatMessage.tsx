import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  onStreamUpdate?: () => void;
}

export function ChatMessage({ role, content, isStreaming = false, onStreamUpdate }: Props) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedContent(content);
      setCurrentIndex(content.length);
      return;
    }

    if (currentIndex < content.length) {
      const charsToAdd = Math.min(3, content.length - currentIndex);
      const timeout = setTimeout(() => {
        setDisplayedContent(content.slice(0, currentIndex + charsToAdd));
        setCurrentIndex(currentIndex + charsToAdd);
        if (onStreamUpdate) onStreamUpdate();
      }, 15);

      return () => clearTimeout(timeout);
    }
  }, [content, currentIndex, isStreaming, onStreamUpdate]);

  useEffect(() => {
    if (isStreaming) {
      setDisplayedContent('');
      setCurrentIndex(0);
    } else {
      setDisplayedContent(content);
      setCurrentIndex(content.length);
    }
  }, [content, isStreaming]);

  const isUserMessage = role === 'user';

  return (
    <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'} w-full mb-2`}>
      <div
        className={`px-4 py-2.5 rounded-lg break-words whitespace-pre-wrap ${
          isUserMessage ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'
        }`}
        style={{
          width: isUserMessage ? 'fit-content' : '100%',
          minWidth: 'fit-content',
        }}
      >
        {isUserMessage ? (
          <p className="text-sm">{content}</p>
        ) : (
          <div className="text-sm prose prose-sm max-w-full
            prose-headings:mt-3 prose-headings:mb-2
            prose-p:my-2 prose-p:leading-relaxed
            prose-ul:my-2 prose-ul:pl-5 prose-ul:list-disc prose-li:leading-relaxed
            prose-ol:my-2 prose-ol:pl-5 prose-ol:list-decimal prose-li:leading-relaxed
            prose-code:text-xs prose-code:bg-gray-200 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-gray-200 prose-pre:text-gray-900
            prose-strong:text-gray-900 prose-strong:font-semibold
            prose-em:text-gray-800">
            <ReactMarkdown
              remarkPlugins={[remarkMath, remarkGfm]}
              rehypePlugins={[rehypeKatex]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold text-gray-900 border-b border-gray-300 pb-1">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold text-gray-900 mt-4 mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold text-gray-900 mt-3 mb-1.5">{children}</h3>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-gray-900 leading-relaxed my-2">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-5 my-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-5 my-2">{children}</ol>
                ),
                li: ({ children }) => (
                  <li className="text-sm text-gray-900 leading-relaxed">{children}</li>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">{children}</strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-gray-800">{children}</em>
                ),
                code: ({ className, children }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-gray-200 text-gray-900 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                  ) : (
                    <code className="block bg-gray-200 text-gray-900 p-2 rounded text-xs font-mono overflow-x-auto my-2">{children}</code>
                  );
                },
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700 my-2">{children}</blockquote>
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">{children}</a>
                ),
                table: ({ children }) => (
                  <div className="overflow-x-auto my-2">
                    <table className="min-w-full border-collapse border border-gray-300">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gray-200">{children}</thead>,
                th: ({ children }) => (
                  <th className="border border-gray-300 px-3 py-1.5 text-left text-xs font-semibold text-gray-900">{children}</th>
                ),
                td: ({ children }) => (
                  <td className="border border-gray-300 px-3 py-1.5 text-xs text-gray-900">{children}</td>
                ),
              }}
            >
              {isStreaming ? displayedContent : content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}