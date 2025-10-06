import React, { useState, useEffect } from 'react';
import { NetworkConfiguration } from '../types';
import * as db from '../services/dbService';
import { verifyWebexConnection } from '../services/merakiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  onNetworksUpdate: () => void;
}

type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'failed';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userId, onNetworksUpdate }) => {
  const [networks, setNetworks] = useState<NetworkConfiguration[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkConfiguration | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(true);

  // Form state for the selected/new network
  const [formState, setFormState] = useState<Partial<NetworkConfiguration>>({
    userId,
    name: '',
    apiKey: '',
    orgId: '',
    webexBotToken: '',
    webexSpaceId: '',
    webexVerified: false,
  });
  
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  // Load networks when the modal opens
  useEffect(() => {
    if (isOpen) {
      loadNetworks();
    }
  }, [isOpen, userId]);
  
  // When selectedNetwork changes, update the form
  useEffect(() => {
      if (selectedNetwork) {
          setFormState(selectedNetwork);
          setIsCreatingNew(false);
          setVerificationStatus(selectedNetwork.webexVerified ? 'verified' : 'idle');
          setVerificationMessage(null);
      } else {
          resetForm();
      }
  }, [selectedNetwork]);

  const loadNetworks = async () => {
    const userNetworks = await db.getNetworksForUser(userId);
    setNetworks(userNetworks);
    if (!selectedNetwork && userNetworks.length > 0) {
        // If nothing is selected, select the first one by default unless creating new
        if (!isCreatingNew) {
           setSelectedNetwork(userNetworks[0]);
        }
    } else if (userNetworks.length === 0) {
        handleAddNewClick();
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
    // If Webex details are changed, reset verification status
    if (name === 'webexBotToken' || name === 'webexSpaceId') {
        setVerificationStatus('idle');
        setVerificationMessage(null);
        setFormState(prevState => ({...prevState, webexVerified: false}));
    }
  };
  
  const resetForm = () => {
    setFormState({
        userId,
        name: '',
        apiKey: '',
        orgId: '',
        webexBotToken: '',
        webexSpaceId: '',
        webexVerified: false
    });
    setVerificationStatus('idle');
    setVerificationMessage(null);
  }
  
  const handleAddNewClick = () => {
      setSelectedNetwork(null);
      setIsCreatingNew(true);
      resetForm();
  }

  const handleSaveNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.apiKey || !formState.orgId) {
        alert('Please fill in Name, API Key, and Organization ID.');
        return;
    }

    try {
        const id = await db.saveNetwork(formState as NetworkConfiguration);
        // If it was a new network, select it after saving
        if (isCreatingNew) {
            const newNetwork = { ...formState, id };
            setSelectedNetwork(newNetwork as NetworkConfiguration);
            setIsCreatingNew(false);
        }
        await loadNetworks();
        onNetworksUpdate(); 
    } catch (error) {
        console.error("Failed to save network", error);
        alert("Failed to save network. Check if a network with this name already exists.");
    }
  };
  
  const handleDelete = async (network: NetworkConfiguration) => {
      if (network.id && window.confirm(`Are you sure you want to delete the "${network.name}" configuration?`)) {
          await db.deleteNetwork(network.id);
          if (selectedNetwork?.id === network.id) {
              handleAddNewClick();
          }
          await loadNetworks();
          onNetworksUpdate();
      }
  };

  const handleVerifyWebex = async () => {
      if (!formState.webexBotToken || !formState.webexSpaceId) {
          setVerificationStatus('failed');
          setVerificationMessage('Both Bot Token and Space ID are required.');
          return;
      }
      setVerificationStatus('verifying');
      setVerificationMessage(null);
      try {
          await verifyWebexConnection(formState.webexBotToken, formState.webexSpaceId);
          setVerificationStatus('verified');
          setVerificationMessage('✅ Verified and saved! A test message was sent to your space.');
          
          // Save the verified state
          const updatedNetwork = { ...formState, webexVerified: true };
          setFormState(updatedNetwork);
          await db.saveNetwork(updatedNetwork as NetworkConfiguration);
          await loadNetworks();
          onNetworksUpdate();

      } catch (error) {
          setVerificationStatus('failed');
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
          setVerificationMessage(`❌ Verification failed: ${errorMessage}`);
          
          // Unset verified status on failure and save
          const updatedNetwork = { ...formState, webexVerified: false };
          setFormState(updatedNetwork);
          await db.saveNetwork(updatedNetwork as NetworkConfiguration);
          await loadNetworks();
          onNetworksUpdate();
      }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-2xl)] shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[var(--color-border-primary)] animate-scale-in" onClick={e => e.stopPropagation()}>
        <header className="p-5 border-b border-[var(--color-border-primary)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Configurations</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-3xl leading-none">&times;</button>
        </header>
        
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <aside className="w-full md:w-2/5 overflow-y-auto p-6 bg-[var(--color-surface-subtle)] border-b md:border-b-0 md:border-r border-[var(--color-border-primary)] rounded-bl-[var(--radius-2xl)]">
            <button onClick={handleAddNewClick} className="w-full text-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 px-4 rounded-full transition-all transform active:scale-95 mb-4">
                + Add New Network
            </button>
            {networks.length > 0 ? (
                <ul className="space-y-2">
                {networks.map(net => {
                    const isSelected = selectedNetwork?.id === net.id;
                    return (
                    <li key={net.id} className={`flex justify-between items-center p-3 rounded-[var(--radius-lg)] border transition-colors cursor-pointer ${isSelected ? 'bg-[var(--color-primary)] text-white border-transparent' : 'bg-white border-[var(--color-border-primary)] hover:bg-gray-50'}`} onClick={() => setSelectedNetwork(net)}>
                        <div className="flex items-center space-x-2">
                            <span className={`font-medium ${isSelected ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>{net.name}</span>
                            {net.webexVerified && (
                               <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-green-500'}`} title="Webex Verified" viewBox="0 0 24 24" fill="currentColor">
                                   <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                               </svg>
                            )}
                        </div>
                        <button onClick={(e) => {e.stopPropagation(); handleDelete(net)}} className={`text-sm font-semibold transition-colors p-1 rounded-full ${isSelected ? 'text-red-300 hover:text-white hover:bg-red-500/50' : 'text-red-500 hover:text-red-700 hover:bg-red-500/10'}`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </li>
                )})}
                </ul>
            ) : (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">No networks configured yet.</p>
            )}
          </aside>
           <main className="w-full md:w-3/5 overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">{isCreatingNew ? "Add New Network" : `Editing "${formState.name}"`}</h3>
            <form onSubmit={handleSaveNetwork} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Config Name*</label>
                <input type="text" name="name" value={formState.name} onChange={handleInputChange} className="mt-1 block w-full bg-[var(--color-surface-subtle)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] shadow-sm p-3 text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition" required />
              </div>
              <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Meraki Org ID*</label>
                  <input type="text" name="orgId" value={formState.orgId} onChange={handleInputChange} className="mt-1 block w-full bg-[var(--color-surface-subtle)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] shadow-sm p-3 text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition" required />
              </div>
              <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Meraki API Key*</label>
                  <input type="password" name="apiKey" value={formState.apiKey} onChange={handleInputChange} className="mt-1 block w-full bg-[var(--color-surface-subtle)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] shadow-sm p-3 text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition" required autoComplete="new-password"/>
              </div>
               <div className="flex justify-end pt-2">
                <button type="submit" className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold py-2.5 px-6 rounded-full transition-all transform active:scale-95">{isCreatingNew ? 'Save Network' : 'Update Network'}</button>
              </div>
            </form>
            
            {/* --- Webex Integration Section --- */}
            <div className="pt-6 mt-6 border-t border-[var(--color-border-primary)]">
                <h4 className="text-md font-semibold text-[var(--color-text-primary)] mb-3">Integrations: Webex</h4>
                <div className="space-y-4 p-4 bg-black/5 rounded-[var(--radius-lg)]">
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Webex Bot Token</label>
                        <input type="password" name="webexBotToken" value={formState.webexBotToken || ''} onChange={handleInputChange} className="mt-1 block w-full bg-[var(--color-surface)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] shadow-sm p-3" autoComplete="new-password" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)]">Webex Space ID</label>
                        <input type="text" name="webexSpaceId" value={formState.webexSpaceId || ''} onChange={handleInputChange} className="mt-1 block w-full bg-[var(--color-surface)] border border-[var(--color-border-primary)] rounded-[var(--radius-md)] shadow-sm p-3" />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="text-sm h-5">
                            {verificationStatus === 'verified' && <p className="text-green-600 font-medium animate-fade-in">{verificationMessage}</p>}
                            {verificationStatus === 'failed' && <p className="text-red-600 font-medium animate-fade-in">{verificationMessage}</p>}
                        </div>
                        <button 
                            type="button" 
                            onClick={handleVerifyWebex}
                            disabled={verificationStatus === 'verifying' || isCreatingNew}
                            className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-full transition-all transform active:scale-95 text-sm"
                        >
                            {verificationStatus === 'verifying' ? 'Verifying...' : 'Verify & Save Integration'}
                        </button>
                    </div>
                    {isCreatingNew && <p className="text-xs text-center text-amber-700">You must save the network before adding integrations.</p>}
                </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;