import React, { useState } from 'react';

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
  const [isDevicePanelHelpOpen, setIsDevicePanelHelpOpen] = useState(false);
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
                <p>Use natural language to interact with your network. The AI understands context and can perform a wide range of actions, from simple lookups to complex, multi-device configurations.</p>
                
                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">1. Information & Reporting</h4>
                    <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>List Resources:</strong> Get an inventory of your organizations, networks, or devices.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Show all my Meraki orgs"</code> or <code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"List the devices in the Main Office network."</code></p>
                        </li>
                        <li>
                            <strong>Client & Usage Analysis:</strong> Investigate client devices and their data usage on a network.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Who are the top clients by usage in the Guest WiFi network over the last day?"</code></p>
                        </li>
                         <li>
                            <strong>Diagnostics & Status:</strong> Check the health of devices, SSIDs, and services.
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Show me traffic statistics for port 5 on the Core Switch."</code></p>
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"List the SSIDs in the HQ network"</code> or <code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Show me the L3 firewall rules for the main office."</code></p>
                        </li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">2. Switching (MS)</h4>
                     <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>Port Management:</strong> Configure VLANs, PoE, port security, and more on single ports or ranges.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Put ports 12-20 on switch Eng-SW1 into VLAN 150."</code></p>
                        </li>
                        <li>
                            <strong>PoE Power Cycle:</strong> Remotely reboot a device connected via Power over Ethernet.
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Power-cycle the camera on port 14 of the Lobby switch."</code></p>
                        </li>
                        <li>
                            <strong>Network-Wide Settings:</strong> Manage high-impact settings like Spanning Tree Protocol (STP).
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Set the STP priority to 4096 on the Core-1 switch."</code></p>
                        </li>
                    </ul>
                </div>
                
                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">3. Wireless (MR)</h4>
                     <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>SSID Management:</strong> Enable, disable, rename, and reconfigure your wireless networks.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Enable SSID 3 on the HQ network and set its VLAN to 20."</code></p>
                        </li>
                        <li>
                            <strong>Client Management:</strong> Block or whitelist specific devices from your network.
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Block client aa:bb:cc:dd:ee:ff on the Guest network for 8 hours."</code></p>
                        </li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">4. Security & SD-WAN (MX)</h4>
                     <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>Firewall Rules:</strong> Manage both L3 (IP-based) and L7 (application-based) firewall rules.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Add an L3 rule to deny traffic from the guest VLAN to the servers VLAN."</code></p>
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Create a new L7 rule to block all social media sites."</code></p>
                        </li>
                        <li>
                            <strong>Content Filtering:</strong> Block access to specific URL categories or individual websites.
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Block the 'Gambling' category for the guest network."</code></p>
                        </li>
                         <li>
                            <strong>VLAN & DHCP Management:</strong> Create, view, and modify VLANs directly on your MX security appliance.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Create a new VLAN 30 with subnet 10.30.0.0/24 for our IoT devices."</code></p>
                        </li>
                         <li>
                            <strong>Site-to-Site VPN:</strong> Configure and view the status of your AutoVPN tunnels.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Add the 192.168.100.0/24 subnet to the site-to-site VPN."</code></p>
                        </li>
                    </ul>
                </div>

                 <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">5. Health & Maintenance</h4>
                     <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>Device Health:</strong> Check the status and performance of device uplinks.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"What's the uplink status for the main office MX?"</code></p>
                        </li>
                         <li>
                            <strong>Device Actions:</strong> Reboot devices or blink their LEDs to physically locate them.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Reboot the AP in the Lobby"</code> or <code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Blink the LEDs on the core switch for 5 minutes."</code></p>
                        </li>
                        <li>
                            <strong>Firmware Management:</strong> View and schedule firmware upgrades for your networks.
                             <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Show available firmware upgrades for the Branch network."</code></p>
                        </li>
                    </ul>
                </div>

                 <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">6. Templates & Automation</h4>
                     <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                        <li>
                            <strong>Configuration Templates:</strong> List and bind networks to Meraki configuration templates for consistent setup.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Bind the new Branch-25 network to the 'Retail Store' template."</code></p>
                        </li>
                         <li>
                            <strong>Bulk Operations:</strong> Use the AI to generate and execute action batches for large-scale changes.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Tag all MX devices in the 'East' network with 'region-east'."</code></p>
                        </li>
                    </ul>
                </div>
                 <div>
                    <h4 className="font-semibold text-[var(--color-primary)]">7. Security, Cameras, Sensors & More</h4>
                     <ul className="list-disc list-inside pl-2 mt-1 space-y-2">
                         <li>
                            <strong>Admin Management:</strong> Add, view, or remove administrators from your organization.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"List all admins"</code> or <code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Add jane@example.com as a read-only admin."</code></p>
                        </li>
                         <li>
                            <strong>Camera Snapshots:</strong> Instantly get a snapshot from any MV camera.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Show me a snapshot from the LobbyCam."</code></p>
                        </li>
                         <li>
                            <strong>Sensor Alerts:</strong> Configure alerts for your MT environmental sensors.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"Alert me if the server room temperature goes above 30C."</code></p>
                        </li>
                         <li>
                            <strong>Licensing:</strong> Check your current license status and see what's expiring soon.
                            <p className="pl-4"><code className="bg-black/5 text-[var(--color-primary)] px-1.5 py-0.5 rounded-md text-xs font-mono">"What licenses expire in the next 90 days?"</code></p>
                        </li>
                    </ul>
                </div>
            </HelpSection>

            <div className="mb-6">
                <div 
                  role="button"
                  aria-expanded={isDevicePanelHelpOpen}
                  aria-controls="device-panel-help-content"
                  className="flex justify-between items-center cursor-pointer border-b border-[var(--color-border-primary)] pb-2 mb-3"
                  onClick={() => setIsDevicePanelHelpOpen(prev => !prev)}
                >
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">The Device Panel: Your Network At a Glance</h3>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-[var(--color-text-secondary)] transition-transform duration-300 ${isDevicePanelHelpOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
                <div
                    id="device-panel-help-content"
                    className={`transition-all duration-500 ease-in-out overflow-hidden ${isDevicePanelHelpOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="text-sm text-[var(--color-text-secondary)] space-y-3 pt-2">
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
                    </div>
                </div>
            </div>
            
            <HelpSection title="Key Features">
                <div>
                    <h4 className="font-semibold text-[var(--color-text-primary)]">Automated Root Cause Analysis (RCA)</h4>
                    <p>The application actively monitors device statuses. If a device goes from "online" to "offline", an RCA is triggered <strong>automatically</strong>. The assistant will fetch logs, analyze them, and post a report directly into the chat, helping you diagnose issues before you even know they happened.</p>
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