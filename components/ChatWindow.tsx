import React, { useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import Message from './Message';

interface ChatWindowProps {
  messages: ChatMessage[];
  loadingState: 'idle' | 'thinking' | 'rca';
  onCancelRca: () => void;
}

const LoadingIndicator: React.FC<{text?: string}> = ({ text = "Thinking..." }) => (
    <div className="flex justify-start animate-fade-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="bg-[var(--color-surface-subtle)] rounded-[var(--radius-xl)] rounded-bl-none p-4 max-w-lg shadow-md border border-[var(--color-border-primary)]">
            <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 bg-[var(--color-primary)] rounded-full animate-bounce"></div>
                <span className="text-sm text-[var(--color-text-secondary)]">{text}</span>
            </div>
        </div>
    </div>
);

const RcaLoadingIndicator: React.FC<{ onCancel: () => void }> = ({ onCancel }) => (
    <div className="flex justify-start animate-fade-slide-up" style={{ animationDelay: '50ms' }}>
        <div className="bg-[var(--color-surface-subtle)] rounded-[var(--radius-xl)] rounded-bl-none p-4 max-w-lg shadow-md border border-[var(--color-border-primary)] flex items-center justify-between space-x-6">
            <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 bg-[var(--color-primary)] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 bg-[var(--color-primary)] rounded-full animate-bounce"></div>
                <span className="text-sm text-[var(--color-text-secondary)]">Running Analysis...</span>
            </div>
            <button
                onClick={onCancel}
                className="text-xs bg-black/5 text-red-600 hover:bg-red-500 hover:text-white font-semibold py-1.5 px-3 rounded-full transition-all duration-200"
            >
                Cancel
            </button>
        </div>
    </div>
);


const ChatWindow: React.FC<ChatWindowProps> = ({ messages, loadingState, onCancelRca }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loadingState]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
      {messages.map((msg, index) => (
        <div key={msg.id} className="animate-fade-slide-up" style={{ animationDelay: `${Math.min(index * 50, 500)}ms`}}>
          <Message message={msg} />
        </div>
      ))}
      {loadingState === 'thinking' && <LoadingIndicator /> }
      {loadingState === 'rca' && <RcaLoadingIndicator onCancel={onCancelRca} /> }
    </div>
  );
};

export default ChatWindow;