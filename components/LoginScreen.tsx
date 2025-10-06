import React, { useState } from 'react';
import { User } from '../types';
import * as auth from '../services/authService';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const user = await auth.authenticateUser(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError('Invalid username or password.');
      }
    } catch (e) {
      setError('An error occurred during login. Please try again.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const dummyUserCredentials = [
      {u: 'admin', p: 'adminpass'},
      {u: 'neteng', p: 'netengpass'},
      {u: 'operator', p: 'oppass'},
      {u: 'guest', p: 'guestpass'}
  ];

  const handleDummyUserClick = (u: string, p: string) => {
      setUsername(u);
      setPassword(p);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center mb-8 animate-fade-slide-up" style={{ animationDelay: '100ms' }}>
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-[var(--color-primary)] mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m-9 9h18" />
            </svg>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-wide">NetOps AI</h1>
        </div>
        <div className="bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-lg p-8 border border-[var(--color-border-primary)] animate-fade-slide-up" style={{ animationDelay: '200ms' }}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="mt-1 block w-full px-4 py-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition"
              />
            </div>
            <div>
              <label htmlFor="password"className="block text-sm font-medium text-[var(--color-text-secondary)]">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 block w-full px-4 py-3 bg-[var(--color-surface-subtle)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] text-[var(--color-text-primary)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-[var(--radius-md)] shadow-sm text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] focus:ring-[var(--color-primary)] disabled:opacity-50 transition-all transform active:scale-95"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
        <div className="mt-6 text-center text-sm text-[var(--color-text-secondary)] animate-fade-slide-up" style={{ animationDelay: '300ms' }}>
            <p className="font-semibold mb-2">Demo Users:</p>
            <div className="flex flex-wrap justify-center gap-2">
                {dummyUserCredentials.map(cred => (
                    <button key={cred.u} onClick={() => handleDummyUserClick(cred.u, cred.p)} className="bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs font-mono py-1 px-2 rounded-[var(--radius-sm)] transition-colors">
                        {cred.u} / {cred.p}
                    </button>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;