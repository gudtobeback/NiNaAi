import React from 'react';
import { User, NetworkConfiguration } from '../types';
import NetworkSelector from './NetworkSelector';

interface HeaderProps {
    user: User;
    networks: NetworkConfiguration[];
    activeNetworkId: number | null;
    onNetworkSelect: (id: number) => void;
    onOpenSettings: () => void;
    onOpenHelp: () => void;
    onOpenMaturity: () => void;
    onLogout: () => void;
}

const HeaderButton: React.FC<{onClick: () => void, 'aria-label': string, children: React.ReactNode}> = ({ onClick, 'aria-label': ariaLabel, children }) => (
    <button 
        onClick={onClick}
        className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] bg-transparent hover:bg-blue-500/10 transition-colors duration-200 p-2.5 rounded-[var(--radius-md)]"
        aria-label={ariaLabel}
    >
        {children}
    </button>
);

const Header: React.FC<HeaderProps> = ({ user, networks, activeNetworkId, onNetworkSelect, onOpenSettings, onOpenHelp, onOpenMaturity, onLogout }) => {
  return (
    <header className="bg-[var(--color-surface)] p-2.5 rounded-[var(--radius-lg)] shadow-md z-10 w-full max-w-7xl mx-auto animate-fade-slide-up border border-[var(--color-border-primary)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center pl-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[var(--color-primary)] mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m-9 9h18" />
            </svg>
            <h1 className="text-lg font-bold text-[var(--color-text-primary)] hidden sm:block tracking-wide">NetOps AI</h1>
        </div>
        <div className="flex items-center space-x-1">
            <NetworkSelector 
                networks={networks}
                activeNetworkId={activeNetworkId}
                onSelect={onNetworkSelect}
                onOpenSettings={onOpenSettings}
            />
            <HeaderButton onClick={onOpenMaturity} aria-label="Open AIOps Maturity Model">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
            </HeaderButton>
            <HeaderButton onClick={onOpenHelp} aria-label="Open help">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
            </HeaderButton>
             <HeaderButton onClick={onOpenSettings} aria-label="Open settings">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-1.57 1.996A1.532 1.532 0 013.17 8.51c-1.56.38-1.56 2.6 0 2.98a1.532 1.532 0 01.948 2.286c-.836 1.372.734 2.942 1.996 1.57a1.532 1.532 0 012.286.948c.38 1.56 2.6 1.56 2.98 0a1.532 1.532 0 012.286-.948c1.372.836 2.942-.734 1.57-1.996A1.532 1.532 0 0116.83 11.49c1.56-.38 1.56-2.6 0-2.98a1.532 1.532 0 01-.948-2.286c.836-1.372-.734-2.942-1.996-1.57A1.532 1.532 0 0111.49 3.17zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
            </HeaderButton>
            <div className="flex items-center space-x-2 text-sm pl-2">
                <span className="font-medium text-[var(--color-text-primary)] hidden md:inline">{user.username}</span>
                <button onClick={onLogout} aria-label="Logout" className="p-2.5 text-[var(--color-text-secondary)] hover:text-red-500 rounded-[var(--radius-md)] hover:bg-red-500/10 transition-colors duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V5h10a1 1 0 100-2H3zm12.293 4.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L17.586 12H7a1 1 0 110-2h10.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
      </div>
    </header>
  );
};

export default Header;