
import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border-primary)] pb-2 mb-3">{title}</h3>
    <div className="text-sm text-[var(--color-text-secondary)] space-y-3">
      {children}
    </div>
  </div>
);

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-[var(--radius-2xl)] shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-white/50 animate-scale-in" onClick={e => e.stopPropagation()}>
        <header className="p-5 border-b border-[var(--color-border-primary)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Help & Features</h2>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-3xl leading-none">&times;</button>
        </header>
        
        <main className="flex-1 overflow-y-auto p-6">
            <HelpSection title="Chat Commands: What to Ask the AI">
                <p>Use natural language to interact with your network. The AI will parse your request and, for actions that make changes, will always ask for confirmation.</p>
                
                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">1. Device Configuration</h4>
                    <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>Switch Ports:</strong> Configure single ports or ranges (e.g., "ports 5-10").
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Put ports 12-20 on the Engineering-Switch into VLAN 150 and enable BPDU guard."</code></p>
                        </li>
                        <li>
                            <strong>Firewall Rules:</strong> View and update L3 firewall rules on security appliances (MX devices).
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Add a firewall rule to the main office MX to deny TCP traffic from 10.0.1.50 to any destination on port 3389."</code></p>
                        </li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">2. Information & Analysis</h4>
                     <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>Port Statistics:</strong> Get traffic stats and configuration details for a switch port or range. This will also display a traffic chart in the Device Panel.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Show me traffic statistics for port 5 on the Core Switch."</code></p>
                        </li>
                        <li>
                            <strong>VPN Status:</strong> Get a summary of the organization's site-to-site VPN status.
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"What's the current health of our site-to-site VPNs?"</code></p>
                        </li>
                         <li>
                            <strong>Manual RCA:</strong> Ask the AI to investigate a device. It will fetch logs and config changes for analysis.
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Why is my main office switch offline? Run a full diagnostic."</code></p>
                        </li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">3. Device Management</h4>
                    <ul className="list-disc list-inside pl-2 mt-1">
                        <li>
                            <strong>Claim Devices:</strong> Add new Meraki devices to a network.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Claim serial Q2AB-CDEF-1234 into the 'New York Office' network."</code></p>
                        </li>
                    </ul>
                </div>
            </HelpSection>

            <HelpSection title="The Device Panel: Your Network At a Glance">
                <p>The right-side panel provides detailed views and quick actions for your network devices.</p>
                <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                    <li><strong>Status Tab:</strong> See all devices, grouped by model. The chart gives a high-level health overview. Click any device to select it, or use the 'Features' and 'Analyze' buttons for quick AI actions.</li>
                    <li><strong>Offline Tab:</strong> A filtered view showing only devices currently offline, making it easy to identify problem areas.</li>
                    <li><strong>VPN Tab:</strong> A hierarchical view of your site-to-site VPN topology, showing the status of each network and its peers.</li>
                    <li><strong>Logs Tab:</strong> Select a device from the 'Status' or 'Offline' tab to view its recent event logs and hardware details here.</li>
                    <li><strong>Changes Tab:</strong> See a log of all recent configuration changes made across the organization, including who made them and what was changed.</li>
                    <li><strong>Claim Tab:</strong> A form to quickly claim one or more devices into a network using their serial numbers.</li>
                    <li><strong>Template Tab:</strong> Create, save, and apply standardized port configurations to your switches.</li>
                </ul>
            </HelpSection>
            
            <HelpSection title="Key Features">
                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">Automated Root Cause Analysis (RCA)</h4>
                    <p>The application actively monitors device statuses. If a device goes from "online" to "offline", an RCA is triggered <strong>automatically</strong>. The assistant will fetch logs, analyze them, and post a report directly into the chat, helping you diagnose issues before you even know they happened.</p>
                </div>
                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">Port Templates</h4>
                    <p>Use the 'Template' tab to define standard configurations for switch ports (e.g., "VoIP Phone," "User PC," "AP Trunk"). You can then select a switch and apply these templates to a range of ports, ensuring consistency and saving time.</p>
                </div>
                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">Webex Integration</h4>
                    <p>In the Settings modal, you can connect a network configuration to a Webex space. This enables full bi-directional chat: messages from the app appear in Webex, and messages from users in Webex are processed by the AI and appear in the app.</p>
                </div>
            </HelpSection>
        </main>
      </div>
    </div>
  );
};

export default HelpModal;
