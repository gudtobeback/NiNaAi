import React from 'react';
import { ChatMessage, Sender } from '../types';

// New, robust line-by-line markdown parser
const RegularTextParser: React.FC<{ text: string }> = ({ text }) => {
    // Helper to render inline elements like bold and italic for single lines of text.
    const renderInline = (line: string): React.ReactNode[] => {
        const regex = /(\*\*.*?\*\*|\*.*?\*)/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(line)) !== null) {
            if (match.index > lastIndex) {
                parts.push(line.substring(lastIndex, match.index));
            }
            const matchedText = match[0];
            if (matchedText.startsWith('**') && matchedText.endsWith('**')) {
                parts.push(<strong className="font-semibold text-[var(--color-text-primary)]" key={`${match.index}-bold`}>{matchedText.slice(2, -2)}</strong>);
            } else if (matchedText.startsWith('*') && matchedText.endsWith('*')) {
                parts.push(<em key={`${match.index}-italic`}>{matchedText.slice(1, -1)}</em>);
            }
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < line.length) {
            parts.push(line.substring(lastIndex));
        }
        return parts;
    };

    const lines = text.trim().split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: { type: 'ul' | 'ol', items: React.ReactNode[] } | null = null;
    let currentParagraph: string[] = [];

    const flushParagraph = (key: string | number) => {
        if (currentParagraph.length > 0) {
            const paragraphText = currentParagraph.join('\n');
            const regex = /(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*)/g;
            const parts = paragraphText.split(regex);

            const renderedParts = parts.map((part, i) => {
                if (!part) return null;
                const withLineBreaks = (content: string) => content.split('\n').map((line, j, arr) => (
                    <React.Fragment key={j}>
                        {line}
                        {j < arr.length - 1 && <br />}
                    </React.Fragment>
                ));

                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={`bold-${i}`} className="font-semibold text-[var(--color-text-primary)]">{withLineBreaks(part.slice(2, -2))}</strong>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={`italic-${i}`}>{withLineBreaks(part.slice(1, -1))}</em>;
                }
                return withLineBreaks(part);
            });

            elements.push(<p key={`p-${key}`} className="my-2">{renderedParts}</p>);
            currentParagraph = [];
        }
    };

    const flushList = (key: string | number) => {
        if (currentList) {
            if (currentList.type === 'ol') {
                elements.push(<ol key={`ol-${key}`} className="list-decimal list-inside pl-4 space-y-1 my-2">{currentList.items}</ol>);
            } else {
                elements.push(<ul key={`ul-${key}`} className="list-disc list-inside pl-4 space-y-1 my-2">{currentList.items}</ul>);
            }
            currentList = null;
        }
    };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('## ')) {
            flushParagraph(index);
            flushList(index);
            elements.push(<h2 key={`h2-${index}`} className="text-lg font-bold text-[var(--color-text-primary)] mt-4 mb-2">{renderInline(trimmedLine.substring(3))}</h2>);
        } else if (trimmedLine.match(/^(\*|-|\d+\.) /)) {
            flushParagraph(index);
            const isOrdered = /^\d+\. /.test(trimmedLine);
            const listType = isOrdered ? 'ol' : 'ul';
            const content = renderInline(trimmedLine.replace(/^(\* |- |\d+\. )/, ''));

            if (!currentList || currentList.type !== listType) {
                flushList(`pre-${index}`);
                currentList = { type: listType, items: [] };
            }
            currentList.items.push(<li key={`li-${index}`}>{content}</li>);
        } else if (trimmedLine.match(/^(\*\*\*|---)$/)) {
            flushParagraph(index);
            flushList(index);
            elements.push(<hr key={`hr-${index}`} className="my-4 border-[var(--color-border-primary)]"/>);
        } else if (trimmedLine === '') {
            flushParagraph(index);
            flushList(index);
        } else {
            flushList(index);
            currentParagraph.push(line);
        }
    });

    flushParagraph('final');
    flushList('final');

    return <>{elements}</>;
};


const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
    const parts = text.split(/(```[\s\S]*?```)/g);

    return (
        <>
            {parts.map((part, index) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const code = part.slice(3, -3).trim();
                    return (
                        <div key={index} className="my-3">
                            <pre className="bg-gray-800 p-4 rounded-[var(--radius-md)] text-sm text-sky-300 font-mono overflow-x-auto border border-gray-700">
                                <code>{code}</code>
                            </pre>
                        </div>
                    );
                } else if (part.trim()) {
                    return <RegularTextParser key={index} text={part} />;
                }
                return null;
            })}
        </>
    );
}

const Message: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.sender === Sender.User;
  const isSystem = message.sender === Sender.System;

  if (isSystem) {
    return (
      <div className="text-center text-xs text-[var(--color-text-secondary)] my-2 italic">
        {message.text}
      </div>
    );
  }

  const containerClasses = isUser ? 'flex justify-end' : 'flex justify-start';
  
  let bubbleClasses = 'shadow-md p-4 max-w-2xl';
  let timestampClasses = '';
  let senderInfo = null;
  
  switch(message.sender) {
    case Sender.User:
      bubbleClasses += ' bg-[var(--color-user-message-bg)] text-white rounded-[var(--radius-lg)] rounded-br-none';
      timestampClasses = 'text-blue-200';
      break;
    case Sender.AI:
      bubbleClasses += ' bg-[var(--color-surface-subtle)] text-[var(--color-text-primary)] rounded-[var(--radius-lg)] rounded-bl-none border border-[var(--color-border-primary)]';
      timestampClasses = 'text-[var(--color-text-tertiary)]';
      break;
    case Sender.Webex:
      bubbleClasses += ' bg-gradient-to-br from-cyan-50 to-sky-100 text-sky-900 rounded-[var(--radius-lg)] rounded-bl-none border border-sky-200';
      timestampClasses = 'text-sky-600';
      senderInfo = (
        <div className="flex items-center space-x-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" />
                <circle cx="12" cy="12" r="2.5" fill="black" />
            </svg>
            <span className="text-xs font-bold text-sky-800">{message.personEmail || 'Webex User'}</span>
            <span className="text-xs text-sky-700 font-medium">via Webex</span>
        </div>
      );
      break;
  }

  return (
    <div className={containerClasses}>
      <div className={bubbleClasses}>
        {senderInfo}
        {message.sender === Sender.AI ? <MarkdownRenderer text={message.text} /> : <p className={`whitespace-pre-wrap ${isUser ? 'text-white' : ''}`}>{message.text}</p>}
        <p className={`text-xs mt-2 text-right ${timestampClasses}`}>{message.timestamp}</p>
      </div>
    </div>
  );
};

export default Message;