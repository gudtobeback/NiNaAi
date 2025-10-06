import React from 'react';
import { NetworkConfiguration } from '../types';

interface NetworkSelectorProps {
    networks: NetworkConfiguration[];
    activeNetworkId: number | null;
    onSelect: (id: number) => void;
    onOpenSettings: () => void;
}

const NetworkSelector: React.FC<NetworkSelectorProps> = ({ networks, activeNetworkId, onSelect, onOpenSettings }) => {
    
    if (networks.length === 0) {
        return (
            <button 
                onClick={onOpenSettings}
                className="text-sm text-[var(--color-primary)] bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2.5 rounded-full flex items-center space-x-2 transition-colors duration-200 font-medium"
                aria-label="Add a new network configuration"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Add Network</span>
            </button>
        );
    }
    
    return (
        <div className="relative">
            <select
                value={activeNetworkId || ''}
                onChange={(e) => onSelect(parseInt(e.target.value, 10))}
                className="appearance-none w-full bg-black/5 border-none rounded-full pl-4 pr-10 py-2.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--color-primary)] transition"
                aria-label="Select active network"
            >
                {networks.map(network => (
                    <option key={network.id} value={network.id}>
                        {network.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[var(--color-text-secondary)]">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
            </div>
        </div>
    );
};

export default NetworkSelector;