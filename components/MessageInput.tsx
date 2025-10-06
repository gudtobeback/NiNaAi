import React, { useState } from 'react';

interface MessageInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isLoading, disabled = false }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputValue.trim() && !isLoading && !disabled) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  const getPlaceholderText = () => {
    if (disabled && isLoading) return "Initializing...";
    if (disabled && !isLoading) return "Select a network to begin...";
    if (isLoading) return "AI is thinking...";
    return "Type your command...";
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="flex items-center space-x-2 p-1.5 bg-[var(--color-surface)] border-t border-[var(--color-border-primary)]"
    >
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={getPlaceholderText()}
        disabled={isLoading || disabled}
        className="flex-1 bg-[var(--color-surface-subtle)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] shadow-sm py-2 px-4 text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all duration-200 disabled:opacity-50"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={isLoading || disabled || !inputValue.trim()}
        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-bold p-3 rounded-[var(--radius-md)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] focus:ring-[var(--color-primary)] flex items-center justify-center transform active:scale-95 border border-blue-600 shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      </button>
    </form>
  );
};

export default MessageInput;