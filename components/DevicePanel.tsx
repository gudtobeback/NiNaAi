
import React, { useState, useEffect, useRef } from 'react';
import { 
    MerakiDevice, MerakiNetwork, MerakiVpnStatus, MerakiEvent, MerakiDeviceDetails, 
    MerakiConfigChange, MerakiSwitchPortStats, DefaultTemplate 
} from '../types';
import * as db from '../services/dbService';

type Tab = 'status' | 'offline' | 'vpn' | 'logs' | 'changes' | 'claim' | 'templates';

interface DevicePanelProps {
    devices: MerakiDevice[];
    merakiNetworks: MerakiNetwork[];
    vpnStatuses: MerakiVpnStatus[] | null;
    onClaimDevices: (networkId: string, serials: string[]) => void;
    onManualRca: (device: MerakiDevice) => void;
    onShowFeatures: (device: MerakiDevice) => void;
    onFetchLogs: (device: MerakiDevice) => Promise<MerakiEvent[]>;
    onFetchDetails: (device: MerakiDevice) => Promise<MerakiDeviceDetails | null>;
    onFetchConfigChanges: () => Promise<MerakiConfigChange[]>;
    portStats: MerakiSwitchPortStats[] | null;
    activePortDetails: { device: MerakiDevice; portId: string; settings: any } | null;
    onApplyTemplate: (device: MerakiDevice, template: DefaultTemplate) => void;
    userId: number;
}

const TabButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        title={label}
        className={`flex-1 flex flex-col items-center justify-center p-2.5 transition-colors duration-200 text-xs ${
            isActive
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:bg-black/5'
        }`}
    >
        {icon}
        <span className="mt-1 font-medium">{label}</span>
    </button>
);

const PortStatsChart: React.FC<{ stats: MerakiSwitchPortStats[]; sentLabel: string; receivedLabel: string; }> = ({ stats, sentLabel, receivedLabel }) => {
  if (!stats || stats.length < 2) {
    return <p className="text-center text-sm text-[var(--color-text-secondary)] py-8">Not enough data to display a chart.</p>;
  }

  const width = 320;
  const height = 160;
  const padding = 20;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxSent = Math.max(...stats.map(s => s.sent));
  const maxReceived = Math.max(...stats.map(s => s.received));
  const maxVal = Math.max(maxSent, maxReceived, 1);

  const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPath = (dataKey: 'sent' | 'received') => {
    return stats.map((stat, i) => {
        const x = (i / (stats.length - 1)) * chartWidth + padding;
        const y = height - padding - (stat[dataKey] / maxVal) * chartHeight;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  };
  
  const sentPath = getPath('sent');
  const receivedPath = getPath('received');

  return (
    <div className="p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Y-Axis labels */}
            <text x={padding - 5} y={padding} dy="0.3em" textAnchor="end" className="text-[10px] fill-current text-[var(--color-text-tertiary)]">{formatBytes(maxVal)}</text>
            <text x={padding - 5} y={height - padding} dy="0.3em" textAnchor="end" className="text-[10px] fill-current text-[var(--color-text-tertiary)]">0</text>

            {/* Grid line */}
            <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="var(--color-border-primary)" strokeDasharray="2" />
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--color-border-primary)" />
            
            <path d={sentPath} fill="none" stroke="var(--color-primary)" strokeWidth="2" />
            <path d={receivedPath} fill="none" stroke="#2dd4bf" strokeWidth="2" />
        </svg>
        <div className="flex justify-center items-center space-x-4 mt-2 text-xs">
            <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[var(--color-primary)]"></div>
                <span>{sentLabel} ({formatBytes(stats.reduce((acc, s) => acc + s.sent, 0))})</span>
            </div>
            <div className="flex items-center space-x-1.5">
                <div className="w-3 h-3 rounded-full bg-[#2dd4bf]"></div>
                <span>{receivedLabel} ({formatBytes(stats.reduce((acc, s) => acc + s.received, 0))})</span>
            </div>
        </div>
    </div>
  );
};

const DevicePanel: React.FC<DevicePanelProps> = ({
    devices, merakiNetworks, vpnStatuses, onClaimDevices, onManualRca, onShowFeatures,
    onFetchLogs, onFetchDetails, onFetchConfigChanges, portStats, activePortDetails,
    onApplyTemplate, userId
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('status');
    const [selectedDevice, setSelectedDevice] = useState<MerakiDevice | null>(null);

    // State for data fetched on demand
    const [logs, setLogs] = useState<MerakiEvent[]>([]);
    const [details, setDetails] = useState<MerakiDeviceDetails | null>(null);
    const [configChanges, setConfigChanges] = useState<MerakiConfigChange[]>([]);
    const [templates, setTemplates] = useState<DefaultTemplate[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    
    // Claim form state
    const [claimSerials, setClaimSerials] = useState('');
    const [claimNetworkId, setClaimNetworkId] = useState<string>(merakiNetworks.length > 0 ? merakiNetworks[0].id : '');

    // Template form state
    const templateNameRef = useRef<HTMLInputElement>(null);
    const portRangeRef = useRef<HTMLInputElement>(null);
    const vlanRef = useRef<HTMLInputElement>(null);
    const poeEnabledRef = useRef<HTMLInputElement>(null);
    
    const hasFetchedChanges = useRef(false);

    useEffect(() => {
        if (merakiNetworks.length > 0 && !claimNetworkId) {
            setClaimNetworkId(merakiNetworks[0].id);
        }
    }, [merakiNetworks, claimNetworkId]);
    
    useEffect(() => {
        const fetchData = async () => {
            setIsLoadingData(true);
            try {
                if (activeTab === 'logs' && selectedDevice) {
                    setLogs([]); setDetails(null); // Clear previous
                    const [fetchedLogs, fetchedDetails] = await Promise.all([
                        onFetchLogs(selectedDevice),
                        onFetchDetails(selectedDevice)
                    ]);
                    setLogs(fetchedLogs);
                    setDetails(fetchedDetails);
                } else if (activeTab === 'changes' && !hasFetchedChanges.current) {
                    const changes = await onFetchConfigChanges();
                    setConfigChanges(changes);
                    hasFetchedChanges.current = true;
                } else if (activeTab === 'templates') {
                    const userTemplates = await db.getTemplatesForUser(userId);
                    setTemplates(userTemplates);
                }
            } catch (error) {
                console.error("Error fetching data for device panel:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        fetchData();
    }, [activeTab, selectedDevice, userId, onFetchLogs, onFetchDetails, onFetchConfigChanges]);

    const handleSelectDevice = (device: MerakiDevice) => {
        setSelectedDevice(device);
        if (activeTab !== 'logs') {
            setActiveTab('logs');
        }
    };

    const handleClaimSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const serials = claimSerials.split(/[\s,]+/).filter(Boolean);
        if (!claimNetworkId || serials.length === 0) {
            alert("Please select a network and enter at least one serial number.");
            return;
        }
        onClaimDevices(claimNetworkId, serials);
        setClaimSerials('');
    };

    const handleAddTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = templateNameRef.current?.value.trim();
        const portRange = portRangeRef.current?.value.trim();
        const vlan = vlanRef.current?.value ? parseInt(vlanRef.current.value, 10) : undefined;
        const poeEnabled = poeEnabledRef.current?.checked;
        
        if (!name || !portRange) {
            alert("Template Name and Port Range are required.");
            return;
        }

        const newTemplate: DefaultTemplate = {
            userId,
            name,
            portRange,
            settings: {
                enabled: true,
                type: 'access',
                vlan,
                poeEnabled,
                stpGuard: 'bpdu guard'
            }
        };

        await db.addTemplate(newTemplate);
        const userTemplates = await db.getTemplatesForUser(userId);
        setTemplates(userTemplates);
        
        // Reset form
        if (templateNameRef.current) templateNameRef.current.value = '';
        if (portRangeRef.current) portRangeRef.current.value = '';
        if (vlanRef.current) vlanRef.current.value = '';
        if (poeEnabledRef.current) poeEnabledRef.current.checked = false;
    };

    const handleDeleteTemplate = async (id: number) => {
        if (window.confirm("Are you sure you want to delete this template?")) {
            await db.deleteTemplate(id);
            const userTemplates = await db.getTemplatesForUser(userId);
            setTemplates(userTemplates);
        }
    };
    
    const handleApplyTemplateToDevice = (template: DefaultTemplate) => {
        if (!selectedDevice) {
            alert("Please select a device from the 'Status' tab first to apply a template.");
            setActiveTab('status');
            return;
        }
        onApplyTemplate(selectedDevice, template);
    };

    const groupedDevices = devices.reduce((acc, device) => {
        const modelFamily = device.model.split('-')[0];
        if (!acc[modelFamily]) {
            acc[modelFamily] = [];
        }
        acc[modelFamily].push(device);
        return acc;
    }, {} as Record<string, MerakiDevice[]>);
    
    const offlineDevices = devices.filter(d => d.status === 'offline');

    const renderDeviceList = (deviceList: MerakiDevice[]) => (
        <div className="space-y-4">
            {Object.entries(
                deviceList.reduce((acc, device) => {
                    const modelFamily = device.model.split('-')[0];
                    if (!acc[modelFamily]) acc[modelFamily] = [];
                    acc[modelFamily].push(device);
                    return acc;
                }, {} as Record<string, MerakiDevice[]>)
            ).map(([modelFamily, devs]) => (
                <div key={modelFamily}>
                    <h4 className="font-bold text-sm text-[var(--color-text-secondary)] px-4 pb-2 border-b border-[var(--color-border-primary)]">{modelFamily} Series</h4>
                    <ul className="divide-y divide-[var(--color-border-primary)]">
                        {devs.map(device => (
                            <li key={device.serial} className={`p-3 transition-colors ${selectedDevice?.serial === device.serial ? 'bg-[var(--color-primary)]/20' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${device.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} title={device.status}></span>
                                        <div>
                                            <p className="font-semibold text-sm text-[var(--color-text-primary)]">{device.name}</p>
                                            <p className="text-xs text-[var(--color-text-secondary)]">{device.model} | {device.serial}</p>
                                        </div>
                                    </div>
                                    <div className="flex space-x-1">
                                         <button onClick={() => onShowFeatures(device)} title="Show Features" className="p-1.5 rounded-md hover:bg-black/10 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-text-secondary)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg></button>
                                         <button onClick={() => onManualRca(device)} title="Analyze/RCA" className="p-1.5 rounded-md hover:bg-black/10 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-text-secondary)]" viewBox="0 0 20 20" fill="currentColor"><path d="M9 9a2 2 0 114 0 2 2 0 01-4 0z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a4 4 0 00-3.446 6.032l-2.261 2.26a1 1 0 101.414 1.415l2.261-2.261A4 4 0 1011 5z" clipRule="evenodd" /></svg></button>
                                         <button onClick={() => handleSelectDevice(device)} title="View Logs/Details" className="p-1.5 rounded-md hover:bg-black/10 transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );

    const renderContent = () => {
        if (isLoadingData) {
            return <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading...</div>;
        }

        switch (activeTab) {
            case 'status':
                return devices.length > 0 ? renderDeviceList(devices) : <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">No devices found.</p>;
            case 'offline':
                return offlineDevices.length > 0 ? renderDeviceList(offlineDevices) : <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">All devices are online.</p>;
            case 'vpn':
                return vpnStatuses && vpnStatuses.length > 0 ? (
                    <div className="p-4 space-y-3">
                        {vpnStatuses.map(vpn => (
                            <div key={vpn.networkId} className="bg-white border border-[var(--color-border-primary)] rounded-lg p-3">
                                <p className="font-bold">{vpn.networkName}</p>
                                <p className={`text-sm font-semibold ${vpn.deviceStatus === 'online' ? 'text-green-600' : 'text-red-600'}`}>{vpn.deviceStatus}</p>
                                {vpn.peers.map(peer => <p key={peer.networkId} className="text-xs pl-2">&rarr; {peer.networkName}: <span className={peer.reachability === 'reachable' ? 'text-green-500' : 'text-red-500'}>{peer.reachability}</span></p>)}
                            </div>
                        ))}
                    </div>
                ) : <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">No VPN status to display.</p>;
            case 'logs':
                 if (!selectedDevice) return <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">Select a device from the 'Status' tab to view its logs and details.</p>;
                 return (
                     <div className="p-4">
                         <h4 className="font-bold text-lg mb-2">{selectedDevice.name}</h4>
                         <p className="text-sm text-[var(--color-text-secondary)]">Firmware: {details?.firmware || 'N/A'}</p>
                         <p className="text-sm text-[var(--color-text-secondary)]">LAN IP: {details?.lanIp || 'N/A'}</p>
                         <h5 className="font-bold mt-4 mb-2">Recent Events</h5>
                         {logs.length > 0 ? (
                             <ul className="text-xs space-y-2 max-h-96 overflow-y-auto bg-black/5 p-2 rounded-md">
                                 {logs.map(log => <li key={log.occurredAt+log.description}>{new Date(log.occurredAt).toLocaleString()}: {log.description}</li>)}
                             </ul>
                         ) : <p className="text-sm text-center py-4">No recent events found.</p>}
                     </div>
                 );
            case 'changes':
                 return configChanges.length > 0 ? (
                     <div className="p-4">
                         <h4 className="font-bold text-lg mb-2">Recent Config Changes</h4>
                         <ul className="text-xs space-y-2 max-h-[80vh] overflow-y-auto bg-black/5 p-2 rounded-md">
                            {configChanges.map(c => <li key={c.ts}>{new Date(c.ts).toLocaleString()} by {c.adminName}: {c.oldValue} &rarr; {c.newValue}</li>)}
                         </ul>
                     </div>
                 ) : <p className="p-8 text-center text-sm text-[var(--color-text-secondary)]">No recent configuration changes found.</p>;
            case 'claim':
                return (
                    <div className="p-4">
                        <h4 className="font-bold text-lg mb-2">Claim Devices</h4>
                        <form onSubmit={handleClaimSubmit} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium">Network</label>
                                <select value={claimNetworkId} onChange={e => setClaimNetworkId(e.target.value)} className="w-full mt-1 p-2 border border-[var(--color-border-primary)] rounded-md bg-white">
                                    {merakiNetworks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Serials (comma or space separated)</label>
                                <textarea value={claimSerials} onChange={e => setClaimSerials(e.target.value)} rows={4} className="w-full mt-1 p-2 border border-[var(--color-border-primary)] rounded-md bg-white" />
                            </div>
                            <button type="submit" className="w-full bg-[var(--color-primary)] text-white font-bold py-2 rounded-md hover:bg-[var(--color-primary-hover)]">Claim</button>
                        </form>
                    </div>
                );
            case 'templates':
                return (
                     <div className="p-4">
                         <h4 className="font-bold text-lg mb-2">Port Templates</h4>
                         <form onSubmit={handleAddTemplate} className="space-y-3 bg-white p-3 rounded-md border border-[var(--color-border-primary)] mb-4">
                             <input ref={templateNameRef} placeholder="Template Name" className="w-full p-2 border rounded-md" required />
                             <input ref={portRangeRef} placeholder="Port Range (e.g., 5-10)" className="w-full p-2 border rounded-md" required />
                             <input ref={vlanRef} type="number" placeholder="VLAN ID" className="w-full p-2 border rounded-md" />
                             <label className="flex items-center space-x-2"><input ref={poeEnabledRef} type="checkbox" /><span>PoE Enabled</span></label>
                             <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 rounded-md hover:bg-green-700">Add Template</button>
                         </form>
                         <h5 className="font-bold mt-4 mb-2">Saved Templates</h5>
                         {templates.length > 0 ? (
                             <ul className="space-y-2">
                                 {templates.map(t => (
                                     <li key={t.id} className="bg-white p-2 rounded-md border flex justify-between items-center">
                                         <div>
                                            <p className="font-semibold">{t.name}</p>
                                            <p className="text-xs">Ports: {t.portRange}, VLAN: {t.settings.vlan || 'N/A'}</p>
                                         </div>
                                         <div className="flex space-x-1">
                                             <button onClick={() => handleApplyTemplateToDevice(t)} className="text-xs bg-blue-500 text-white px-2 py-1 rounded-md hover:bg-blue-600">Apply</button>
                                             <button onClick={() => handleDeleteTemplate(t.id!)} className="text-xs bg-red-500 text-white px-2 py-1 rounded-md hover:bg-red-600">Del</button>
                                         </div>
                                     </li>
                                 ))}
                             </ul>
                         ) : <p className="text-sm text-center py-4">No templates saved.</p>}
                     </div>
                );
            default:
                return null;
        }
    };
    
    return (
        <aside className="hidden md:flex w-full md:w-2/5 lg:w-[450px] bg-[var(--color-surface-subtle)] border-l border-[var(--color-border-primary)] flex-col overflow-hidden">
            {portStats && activePortDetails && (
                <div className="p-4 border-b-2 border-[var(--color-primary)] bg-white animate-fade-in">
                    <h3 className="font-bold text-lg">Port Analysis: {activePortDetails.device.name}</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">Showing stats for port(s): <span className="font-semibold text-[var(--color-text-primary)]">{activePortDetails.portId}</span></p>
                    <PortStatsChart stats={portStats} sentLabel="Total Sent" receivedLabel="Total Received" />
                </div>
            )}
            
            <div className="flex border-b border-[var(--color-border-primary)] bg-white/50">
                <TabButton label="Status" isActive={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>} />
                <TabButton label="Offline" isActive={activeTab === 'offline'} onClick={() => setActiveTab('offline')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a9 9 0 100 18 9 9 0 000-18zM5.707 5.707a1 1 0 00-1.414 1.414l1.414-1.414zM12.9 14.3a1 1 0 001.414-1.414l-1.414 1.414zM5.707 7.121a1 1 0 000 1.414l4.95 4.95a1 1 0 001.414 0l4.95-4.95a1 1 0 10-1.414-1.414L11.45 10.364 7.12 5.707a1 1 0 00-1.414 0z" clipRule="evenodd" /></svg>} />
                <TabButton label="VPN" isActive={activeTab === 'vpn'} onClick={() => setActiveTab('vpn')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>} />
                <TabButton label="Logs" isActive={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>} />
                <TabButton label="Changes" isActive={activeTab === 'changes'} onClick={() => setActiveTab('changes')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>} />
                <TabButton label="Claim" isActive={activeTab === 'claim'} onClick={() => setActiveTab('claim')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>} />
                <TabButton label="Templates" isActive={activeTab === 'templates'} onClick={() => setActiveTab('templates')} icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm4 4a1 1 0 001-1V5a1 1 0 10-2 0v1a1 1 0 001 1zm5 0a1 1 0 001-1V5a1 1 0 10-2 0v1a1 1 0 001 1z" clipRule="evenodd" /></svg>} />
            </div>
            
            <div className="flex-1 overflow-y-auto">
                {renderContent()}
            </div>
        </aside>
    );
};

export default DevicePanel;
