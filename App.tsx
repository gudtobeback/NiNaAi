import React, { useState, useEffect, useRef } from 'react';
import { User, NetworkConfiguration, ChatMessage, Sender, MerakiDevice, MerakiEvent, MerakiDeviceDetails, MerakiConfigChange, MerakiSwitchPortStats, MerakiNetwork, DefaultTemplate, MerakiVpnStatus, MerakiL3FirewallRule, MerakiOrganization } from './types';
import * as auth from './services/authService';
import * as db from './services/dbService';
import { getAiResponse } from './services/geminiService';
import { 
    getOrganizations, getOrgDevices, updateSwitchPort, getDeviceEvents, getConfigChanges, getDeviceDetails, 
    getSwitchPortDetails, getSwitchPortStats, getOrgNetworks, claimDevices, getOrgVpnStatuses, 
    getNetworkL3FirewallRules, updateNetworkL3FirewallRules, sendWebexMessage, getWebexMessages, getWebexMe, 
    getNetworkDevices, getNetworkClients, cycleSwitchPort, createActionBatch, updateNetworkStpSettings,
    getNetworkSsids, updateNetworkSsid, provisionNetworkClients, updateDeviceWirelessRadioSettings,
    getNetworkL7FirewallRules, updateNetworkL7FirewallRules, getNetworkContentFiltering, updateNetworkContentFiltering,
    getNetworkTrafficShapingRules, updateNetworkTrafficShapingRules, getNetworkSiteToSiteVpn, updateNetworkSiteToSiteVpn,
    getNetworkApplianceVlans, createNetworkApplianceVlan, updateNetworkApplianceVlan, getDeviceUplink, getOrgUplinksLossAndLatency,
    rebootDevice, blinkDeviceLeds, getNetworkFirmwareUpgrades, updateNetworkFirmwareUpgrades, getNetworkAlertSettings,
    updateNetworkAlertSettings, getNetworkSyslogServers, updateNetworkSyslogServers, getOrgSnmpSettings, updateOrgSnmpSettings,
    getOrgConfigTemplates, bindNetworkToTemplate, getOrgAdmins, createOrgAdmin, updateOrgAdmin, deleteOrgAdmin,
    generateCameraSnapshot, getCameraMotionAnalytics, getSensorAlerts, updateSensorAlerts, getCellularStatus,
    getCellularUsageHistory, updateApplianceUplinkSettings, getNetworkTraffic, getOrgAuditLogs, getNetworkFloorPlans,
    updateWirelessBluetoothSettings, getOrgLicenseOverview, getOrgLicenses
} from './services/merakiService';

import LoginScreen from './components/LoginScreen';
import Header from './components/Header';
import ChatWindow from './components/ChatWindow';
import MessageInput from './components/MessageInput';
import SettingsModal from './components/SettingsModal';
import UsageStats from './components/UsageStats';
import HelpModal from './components/HelpModal';
import DevicePanel from './components/DevicePanel';
import MaturityModal from './components/MaturityModal';
import EasterEggModal from './components/EasterEggModal';

// Helper to map Meraki model prefix to the API's productType parameter
const getProductTypeFromModel = (model: string): string => {
    const upperModel = model.toUpperCase();

    if (upperModel.startsWith('MS')) {
        return 'switch';
    }
    if (upperModel.startsWith('MR') || upperModel.startsWith('CW')) {
        return 'wireless';
    }
    if (upperModel.startsWith('MX') || upperModel.startsWith('Z')) {
        return 'appliance';
    }
    if (upperModel.startsWith('MV')) {
        return 'camera';
    }
    if (upperModel.startsWith('MG')) {
        return 'cellularGateway';
    }
    if (upperModel.startsWith('MT')) {
        return 'sensor';
    }

    // Default fallback if no prefix matches.
    console.warn(`Unknown model prefix for model '${model}'. Defaulting productType to 'appliance'. This may cause errors.`);
    return 'appliance'; 
};

type LoadingState = 'idle' | 'thinking' | 'rca';

const App: React.FC = () => {
    // Component State
    const [user, setUser] = useState<User | null>(null);
    const [networks, setNetworks] = useState<NetworkConfiguration[]>([]);
    const [activeNetworkId, setActiveNetworkId] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isMaturityOpen, setIsMaturityOpen] = useState(false);
    const [isDevicePanelOpen, setIsDevicePanelOpen] = useState(false);
    const [isEasterEggVisible, setIsEasterEggVisible] = useState(false);
    const [merakiOrgs, setMerakiOrgs] = useState<MerakiOrganization[]>([]);
    const [merakiDevices, setMerakiDevices] = useState<MerakiDevice[]>([]);
    const [merakiNetworksList, setMerakiNetworksList] = useState<MerakiNetwork[]>([]);
    const [portStats, setPortStats] = useState<MerakiSwitchPortStats[] | null>(null);
    const [activePortDetails, setActivePortDetails] = useState<{device: MerakiDevice, portId: string, settings: any} | null>(null);
    const [vpnStatuses, setVpnStatuses] = useState<MerakiVpnStatus[] | null>(null);
    const [isInitialDeviceLoad, setIsInitialDeviceLoad] = useState(false);
    const [botEmail, setBotEmail] = useState<string | null>(null);
    
    // Usage Stats - Dummy values for now
    const [lastTokensUsed, setLastTokensUsed] = useState(0);
    const [lastCost, setLastCost] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    
    // Ref for polling callback to avoid stale state in setInterval
    const pollCallback = useRef<(() => void) | null>(null);
    const webexPollCallback = useRef<(() => void) | null>(null);
    const rcaAbortController = useRef<AbortController | null>(null);
    const lastWebexMessageTimestamp = useRef<string | null>(null);
    const isExecutingAction = useRef(false);
    
    // --- Effects ---
    
    // Easter Egg Listener
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    const keySequence = useRef<string[]>([]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keySequence.current.push(e.key);
            if (keySequence.current.length > konamiCode.length) {
                keySequence.current.shift();
            }
            if (keySequence.current.join('') === konamiCode.join('')) {
                setIsEasterEggVisible(true);
                keySequence.current = []; // Reset after activation
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    // Initialize DB and check for logged in user
    useEffect(() => {
        const initialize = async () => {
            await db.initDB();
            const currentUser = auth.getCurrentUser();
            if (currentUser) {
                await handleLogin(currentUser);
            }
        };
        initialize();
    }, []);
    
    // Fetch networks when user logs in
    useEffect(() => {
        if (user) {
            loadNetworks();
        }
    }, [user]);

    // Initial load and setup polling when active network changes
    useEffect(() => {
        let deviceIntervalId: number;
        let webexIntervalId: number;

        const initializeNetwork = async () => {
            if (activeNetworkId && user) {
                setIsInitialDeviceLoad(true);
                setMessages([]);
                setMerakiDevices([]);
                setMerakiOrgs([]);
                setPortStats(null);
                setActivePortDetails(null);
                setBotEmail(null);
                lastWebexMessageTimestamp.current = null;
                isExecutingAction.current = false;

                const activeNetwork = networks.find(n => n.id === activeNetworkId);
                if (!activeNetwork) {
                    setIsInitialDeviceLoad(false);
                    return;
                }

                try {
                    const orgs = await getOrganizations(activeNetwork.apiKey);
                    setMerakiOrgs(orgs);
                } catch (error) {
                    console.error("Failed to load organizations:", error);
                    await addSystemMessage(`❌ Error fetching organizations: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your Meraki API Key.`, true);
                }

                if (activeNetwork?.webexVerified) {
                    try {
                        const me = await getWebexMe(activeNetwork.webexBotToken!);
                        if (me.emails && me.emails.length > 0) {
                            setBotEmail(me.emails[0]);
                            const initialMessages = await getWebexMessages(activeNetwork.webexBotToken!, activeNetwork.webexSpaceId!);
                            if (initialMessages.length > 0) {
                                lastWebexMessageTimestamp.current = initialMessages[0].created;
                            }
                        }
                    } catch (error) {
                         console.error("Failed to initialize Webex connection:", error);
                         await addSystemMessage(`❌ Failed to initialize Webex: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
                    }
                }

                await loadChatHistory(user.id, activeNetworkId);
                await loadMerakiDevices(); 
                await loadMerakiNetworks();
                await loadVpnStatuses();

                setIsInitialDeviceLoad(false);

                deviceIntervalId = window.setInterval(() => {
                    if (loadingState === 'idle' && !isSettingsOpen && pollCallback.current) {
                        pollCallback.current();
                    }
                }, 60000); 

                webexIntervalId = window.setInterval(() => {
                    if (loadingState === 'idle' && !isSettingsOpen && webexPollCallback.current) {
                        webexPollCallback.current();
                    }
                }, 7000);

            } else {
                setMessages([]);
                setMerakiDevices([]);
                setMerakiOrgs([]);
                setMerakiNetworksList([]);
                setVpnStatuses(null);
            }
        };
        
        initializeNetwork();

        return () => {
            clearInterval(deviceIntervalId);
            clearInterval(webexIntervalId);
        }
    }, [activeNetworkId, user]);


    // --- Core Functions ---
    const addSystemMessage = async (text: string, sendToWebex: boolean = false) => {
        if (!user || !activeNetworkId) return;

        const sysMessage: ChatMessage = {
            id: `system-${Date.now()}-${Math.random()}`,
            sender: Sender.System,
            text,
            timestamp: new Date().toLocaleTimeString(),
            userId: user.id,
            networkId: activeNetworkId,
        };
        setMessages(prev => [...prev, sysMessage]);
        await db.addMessage(sysMessage);

        if (sendToWebex) {
            const activeNetwork = networks.find(n => n.id === activeNetworkId);
            if (activeNetwork?.webexVerified && activeNetwork.webexBotToken && activeNetwork.webexSpaceId) {
                const webexMessage = `*System: ${text}*`;
                 try {
                    await sendWebexMessage(activeNetwork.webexBotToken, activeNetwork.webexSpaceId, webexMessage);
                } catch (error) {
                    console.error("Failed to send system message to Webex:", error);
                }
            }
        }
    };


    const handleLogin = async (loggedInUser: User) => {
        auth.login(loggedInUser);
        if (loggedInUser.username === 'admin') {
            try {
                const adminNetworks = await db.getNetworksForUser(loggedInUser.id);
                let dmtNetwork = adminNetworks.find(net => net.name === 'DMT');
                if (!dmtNetwork) {
                    dmtNetwork = {
                        userId: loggedInUser.id,
                        name: 'DMT',
                        apiKey: '08e94a41b2f5e33968903f5642d774c79713dfdd',
                        orgId: '804042',
                        // Hardcode Webex details as requested
                        webexBotToken: 'ODI4ZGNjZjUtNzVlNi00MGI1LThiNTEtNWFjM2ZkOTFhNmRkMTMwNTFlMGItMTYy_PF84_3b5eac1b-7ee0-44e0-bc14-614b2116a8da',
                        webexSpaceId: 'Y2lzY29zcGFyazovL3VzL1JPT00vZGMwNDBhZTAtYTA0Ny0xMWYwLTk1ODktZTViYTk0NmIwNTE1',
                        webexVerified: true,
                    };
                    await db.saveNetwork(dmtNetwork);
                }
            } catch (error) {
                console.error("Failed to add/check for the hardcoded DMT network:", error);
            }
        }
        setUser(loggedInUser);
    };

    const handleLogout = () => {
        auth.logout();
        setUser(null);
        setNetworks([]);
        setActiveNetworkId(null);
        setMessages([]);
    };
    
    const loadNetworks = async () => {
        if (!user) return;
        const userNetworks = await db.getNetworksForUser(user.id);
        setNetworks(userNetworks);
        if (userNetworks.length > 0) {
            setActiveNetworkId(userNetworks[0].id!);
        } else {
            setActiveNetworkId(null);
            setIsSettingsOpen(true);
        }
    };
    
    const loadChatHistory = async (userId: number, networkId: number) => {
        const history = await db.getMessages(userId, networkId);
        if (history.length === 0) {
            const introMessage: ChatMessage = {
                id: `ai-intro-${Date.now()}`,
                sender: Sender.AI,
                text: "Hello! I'm your NetOps AI Assistant. How can I help you manage your Meraki network today?",
                timestamp: new Date().toLocaleTimeString(),
                userId,
                networkId
            };
            setMessages([introMessage]);
            await db.addMessage(introMessage);
        } else {
            setMessages(history);
        }
    };

    const loadMerakiDevices = async (name?: string) => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return;

        await addSystemMessage("Fetching Meraki device list...");
        try {
            const devices = await getOrgDevices(activeNetwork.apiKey, activeNetwork.orgId, name);
            setMerakiDevices(devices);
            await addSystemMessage(`Successfully discovered ${devices.length} devices.`);
            return devices;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`Error fetching devices: ${errorMessage}`, true);
            setMerakiDevices([]);
            return [];
        }
    };

    const loadMerakiNetworks = async (tags?: string[]) => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return;
        try {
            const merakiNets = await getOrgNetworks(activeNetwork.apiKey, activeNetwork.orgId, tags);
            setMerakiNetworksList(merakiNets);
            return merakiNets;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`Error fetching network list: ${errorMessage}`, true);
            setMerakiNetworksList([]);
            return [];
        }
    };
    
    const loadVpnStatuses = async () => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return;
        try {
            const statuses = await getOrgVpnStatuses(activeNetwork.apiKey, activeNetwork.orgId);
            setVpnStatuses(statuses);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            console.error(`Error fetching VPN statuses: ${errorMessage}`);
            await addSystemMessage(`Error fetching VPN statuses: ${errorMessage}`, true);
            setVpnStatuses(null);
        }
    };

    const handleClaimDevices = async (networkId: string, serials: string[]) => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) {
            await addSystemMessage("❌ Error claiming devices: No active network configuration found.", true);
            return;
        }
        setLoadingState('thinking');
        await addSystemMessage(`Executing action: Claiming ${serials.length} device(s)...`, true);
        try {
            await claimDevices(activeNetwork.apiKey, networkId, serials);
            await addSystemMessage(`✅ Success! ${serials.length} device(s) have been claimed. It may take a few minutes for them to appear.`, true);
            setTimeout(() => {
                loadMerakiDevices();
            }, 5000);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`❌ Error claiming devices: ${errorMessage}`, true);
        } finally {
            setLoadingState('idle');
        }
    };

    const handleApplyTemplate = async (device: MerakiDevice, template: DefaultTemplate) => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) {
            await addSystemMessage("❌ Error applying template: No active network configuration found.", true);
            return;
        }
        if (!device.model.toUpperCase().startsWith('MS')) {
            await addSystemMessage(`❌ Error: Templates can only be applied to switches. ${device.name} is a ${device.model}.`, true);
            return;
        }
    
        setLoadingState('thinking');
        await addSystemMessage(`Applying template "${template.name}" to device ${device.name} (ports ${template.portRange})...`, true);
        try {
            await updateSwitchPort(activeNetwork.apiKey, device.serial, template.portRange, template.settings);
            await addSystemMessage(`✅ Success! Template "${template.name}" applied to ports ${template.portRange} on ${device.name}.`, true);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`❌ Error applying template: ${errorMessage}`, true);
        } finally {
            setLoadingState('idle');
        }
    };

    const handleClearChat = async () => {
        if (!user || !activeNetworkId) return;

        if (!window.confirm("Are you sure you want to clear the chat history for this network? This action cannot be undone.")) {
            return;
        }

        setLoadingState('thinking');
        try {
            await db.clearMessages(user.id, activeNetworkId);
            // Reloading chat history will find an empty DB, create the intro message,
            // and update the state, effectively resetting the chat window.
            await loadChatHistory(user.id, activeNetworkId); 
        } catch (error) {
            console.error("Failed to clear chat history:", error);
            addSystemMessage("❌ Error: Could not clear chat history.", true);
        } finally {
            setLoadingState('idle');
        }
    };

    // --- Chat & Action Logic ---
    const handleSendMessage = async (text: string, isFromWebex = false, personEmail?: string) => {
        if (!activeNetworkId || !user) return;
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return;

        if (activeNetwork.webexBotToken && activeNetwork.webexSpaceId && activeNetwork.webexVerified && !isFromWebex) {
            const webexMessage = `**[From UI - ${user.username}]**: ${text}`;
            await sendWebexMessage(activeNetwork.webexBotToken, activeNetwork.webexSpaceId, webexMessage);
        }
    
        const userMessage: ChatMessage = {
            id: `${isFromWebex ? 'webex' : 'user'}-${Date.now()}`,
            sender: isFromWebex ? Sender.Webex : Sender.User,
            text,
            timestamp: new Date().toLocaleTimeString(),
            userId: user.id,
            networkId: activeNetworkId,
            personEmail: personEmail,
        };
        
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        await db.addMessage(userMessage);
        setLoadingState('thinking');

        try {
            const aiMessageId = `ai-${Date.now()}`;
            const aiMessagePlaceholder: ChatMessage = {
                id: aiMessageId,
                sender: Sender.AI,
                text: '',
                timestamp: new Date().toLocaleTimeString(),
                userId: user.id,
                networkId: activeNetworkId,
            };
            setMessages(prev => [...prev, aiMessagePlaceholder]);

            const finalResponseText = await getAiResponse(
                updatedMessages,
                merakiDevices,
                merakiOrgs,
                merakiNetworksList,
                activeNetwork,
                undefined, // No ephemeral prompt here, it's part of history
                (chunk) => {
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === aiMessageId
                                ? { ...msg, text: msg.text + chunk }
                                : msg
                        )
                    );
                }
            );
            
            const finalAiMessage: ChatMessage = {
                ...aiMessagePlaceholder,
                text: finalResponseText,
            };

            await db.addMessage(finalAiMessage);
            setMessages(prev => prev.map(msg => msg.id === aiMessageId ? finalAiMessage : msg));

             // Send AI response to Webex
            if (activeNetwork.webexBotToken && activeNetwork.webexSpaceId && activeNetwork.webexVerified) {
                const cleanResponseText = finalAiMessage.text.replace(/<execute_action>[\s\S]*?<\/execute_action>/g, '').trim();
                if (cleanResponseText) { // Only send if there's a visible text response
                    const prefix = isFromWebex ? `**[AI Reply to ${personEmail}]**:` : '**[From AI]:**';
                    const webexResponse = `${prefix}\n\n${cleanResponseText}`;
                    await sendWebexMessage(activeNetwork.webexBotToken, activeNetwork.webexSpaceId, webexResponse);
                }
            }

            const match = finalResponseText.match(/<execute_action>([\s\S]*?)<\/execute_action>/);
            if (match && match[1]) {
                await handleFrontendAction(match[1].trim());
            } else {
                setLoadingState('idle');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`Error communicating with AI: ${errorMessage}`, true);
            setLoadingState('idle');
        }
    };

    const handleFrontendAction = async (actionJson: string) => {
        if (!user || !activeNetworkId || isExecutingAction.current) {
            if(isExecutingAction.current) console.warn("Action already in progress. Ignoring duplicate call.");
            return;
        }

        isExecutingAction.current = true;
        
        if (!actionJson) {
             isExecutingAction.current = false;
             return;
        }
        
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) {
            await addSystemMessage("❌ Error executing action: No active network configuration found.", true);
            isExecutingAction.current = false;
            return;
        }
        
        try {
            const action = JSON.parse(actionJson);
            // Use the payload if it exists, otherwise use the action object itself.
            // This provides a fallback for when the AI forgets to nest arguments.
            const payload = action.payload || action;

            // --- Start of action handling ---
            setLoadingState('thinking'); // Default to thinking, can be overridden

            if (action.action === 'update_switch_port') {
                const { serial, portId, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating port(s) ${portId} on device ${serial}...`, true);
                await updateSwitchPort(activeNetwork.apiKey, serial, portId, settings);
                await addSystemMessage(`✅ Success! Port(s) ${portId} on ${serial} have been updated.`, true);
            
            } else if (action.action === 'claim_devices') {
                const { networkName, serials } = payload;
                const targetNetwork = merakiNetworksList.find(n => n.name.toLowerCase() === networkName.toLowerCase());
                if (!targetNetwork) throw new Error(`Could not find a network named "${networkName}".`);
                await handleClaimDevices(targetNetwork.id, serials);

            } else if (action.action === 'list_organizations') {
                await addSystemMessage('Fetching Meraki organizations...', true);
                const orgs = await getOrganizations(activeNetwork.apiKey);
                setMerakiOrgs(orgs);
                await addSystemMessage(`Found ${orgs.length} organizations. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here is the list of organizations. Please present this to the user in a readable format.\n\nDATA: ${JSON.stringify(orgs, null, 2)}`);

            } else if (action.action === 'list_devices') {
                const { networkId } = payload;
                const topic = networkId ? `devices in network ${networkId}` : 'all devices in the organization';
                await addSystemMessage(`Fetching ${topic}...`, true);
                const devices = networkId
                    ? await getNetworkDevices(activeNetwork.apiKey, networkId)
                    : await getOrgDevices(activeNetwork.apiKey, activeNetwork.orgId);
                setMerakiDevices(devices); // Update main device list
                await addSystemMessage(`Found ${devices.length} devices. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here is the list of devices you requested. Please present this to the user in a readable format.\n\nDATA: ${JSON.stringify(devices, null, 2)}`);

            } else if (action.action === 'get_client_inventory') {
                setLoadingState('rca');
                rcaAbortController.current = new AbortController();
                const { networkId, timespan } = payload;
                const network = merakiNetworksList.find(n => n.id === networkId);
                await addSystemMessage(`Fetching client inventory for network "${network?.name || networkId}"...`, true);
                const clients = await getNetworkClients(activeNetwork.apiKey, networkId, timespan, rcaAbortController.current.signal);
                await addSystemMessage(`Found ${clients.length} clients. Sending to AI for analysis...`, true);
                await handleSendMessage(`CONTEXT: Here is the client inventory you requested for network "${network?.name || networkId}". Please summarize the key findings, such as top clients by usage.\n\nDATA: ${JSON.stringify(clients, null, 2)}`);

            } else if (action.action === 'cycle_switch_port') {
                const { serial, portId } = payload;
                await addSystemMessage(`Executing action: Cycling PoE on port(s) ${portId} on device ${serial}...`, true);
                await cycleSwitchPort(activeNetwork.apiKey, serial, portId);
                await addSystemMessage(`✅ Success! Port(s) ${portId} on ${serial} have been power-cycled.`, true);

            } else if (action.action === 'update_stp_settings') {
                const { networkId, ...settings } = payload;
                const network = merakiNetworksList.find(n => n.id === networkId);
                await addSystemMessage(`Executing action: Updating STP settings for network "${network?.name || networkId}"...`, true);
                await updateNetworkStpSettings(activeNetwork.apiKey, networkId, settings);
                await addSystemMessage(`✅ Success! STP settings have been updated.`, true);

            } else if (action.action === 'create_action_batch') {
                const { actions } = payload;
                await addSystemMessage(`Executing action: Creating an action batch with ${actions.length} operation(s)...`, true);
                const result = await createActionBatch(activeNetwork.apiKey, activeNetwork.orgId, actions);
                if (result.status?.completed) {
                    await addSystemMessage(`✅ Success! Action batch completed.`, true);
                } else {
                    await addSystemMessage(`⚠️ Action batch finished. Status: ${JSON.stringify(result.status)}`, true);
                }
            
            // --- WIRELESS ACTIONS ---
            } else if (action.action === 'list_ssids') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching SSIDs for network ${networkId}...`, true);
                const ssids = await getNetworkSsids(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found ${ssids.length} SSIDs. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here is the list of SSIDs. Please summarize them for the user.\n\nDATA: ${JSON.stringify(ssids, null, 2)}`);

            } else if (action.action === 'update_ssid') {
                const { networkId, ssidNumber, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating SSID ${ssidNumber} in network ${networkId}...`, true);
                await updateNetworkSsid(activeNetwork.apiKey, networkId, ssidNumber, settings);
                await addSystemMessage(`✅ Success! SSID ${ssidNumber} has been updated.`, true);

            } else if (action.action === 'provision_client') {
                const { networkId, ...provisionPayload } = payload;
                await addSystemMessage(`Executing action: Applying device policy in network ${networkId}...`, true);
                await provisionNetworkClients(activeNetwork.apiKey, networkId, provisionPayload);
                await addSystemMessage(`✅ Success! Policy applied to ${provisionPayload.macs.length} client(s).`, true);

            } else if (action.action === 'update_device_radio_settings') {
                const { serial, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating radio settings for AP ${serial}...`, true);
                await updateDeviceWirelessRadioSettings(activeNetwork.apiKey, serial, settings);
                await addSystemMessage(`✅ Success! Radio settings for ${serial} have been updated.`, true);

            // --- SECURITY & SD-WAN ACTIONS ---
            } else if (action.action === 'get_l7_firewall_rules') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching L7 firewall rules for network ${networkId}...`, true);
                const data = await getNetworkL7FirewallRules(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found ${data.rules?.length || 0} rules. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the L7 firewall rules. Please summarize them.\n\nDATA: ${JSON.stringify(data.rules, null, 2)}`);

            } else if (action.action === 'update_l7_firewall_rules') {
                const { networkId, rules } = payload;
                await addSystemMessage(`Executing action: Updating L7 firewall rules for network ${networkId}...`, true);
                await updateNetworkL7FirewallRules(activeNetwork.apiKey, networkId, rules);
                await addSystemMessage(`✅ Success! L7 firewall rules have been updated.`, true);

            } else if (action.action === 'get_content_filtering') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching content filtering settings for network ${networkId}...`, true);
                const settings = await getNetworkContentFiltering(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found settings. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the content filtering settings. Please summarize them.\n\nDATA: ${JSON.stringify(settings, null, 2)}`);
            
            } else if (action.action === 'update_content_filtering') {
                const { networkId, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating content filtering for network ${networkId}...`, true);
                await updateNetworkContentFiltering(activeNetwork.apiKey, networkId, settings);
                await addSystemMessage(`✅ Success! Content filtering settings updated.`, true);

            } else if (action.action === 'get_traffic_shaping_rules') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching traffic shaping rules for network ${networkId}...`, true);
                const data = await getNetworkTrafficShapingRules(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found ${data.rules?.length || 0} rules. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the traffic shaping rules. Please summarize them.\n\nDATA: ${JSON.stringify(data.rules, null, 2)}`);

            } else if (action.action === 'update_traffic_shaping_rules') {
                const { networkId, rules } = payload;
                await addSystemMessage(`Executing action: Updating traffic shaping rules for network ${networkId}...`, true);
                await updateNetworkTrafficShapingRules(activeNetwork.apiKey, networkId, rules);
                await addSystemMessage(`✅ Success! Traffic shaping rules updated.`, true);
            
            } else if (action.action === 'get_s2s_vpn_settings') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching site-to-site VPN settings for network ${networkId}...`, true);
                const settings = await getNetworkSiteToSiteVpn(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found settings. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the S2S VPN settings. Please summarize them.\n\nDATA: ${JSON.stringify(settings, null, 2)}`);

            } else if (action.action === 'update_s2s_vpn_settings') {
                const { networkId, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating site-to-site VPN for network ${networkId}...`, true);
                await updateNetworkSiteToSiteVpn(activeNetwork.apiKey, networkId, settings);
                await addSystemMessage(`✅ Success! Site-to-site VPN settings updated.`, true);

            } else if (action.action === 'list_appliance_vlans') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching appliance VLANs for network ${networkId}...`, true);
                const vlans = await getNetworkApplianceVlans(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found ${vlans.length} VLANs. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the appliance VLANs. Please summarize them.\n\nDATA: ${JSON.stringify(vlans, null, 2)}`);

            } else if (action.action === 'create_appliance_vlan') {
                const { networkId, ...vlanData } = payload;
                await addSystemMessage(`Executing action: Creating VLAN ${vlanData.id} in network ${networkId}...`, true);
                await createNetworkApplianceVlan(activeNetwork.apiKey, networkId, vlanData);
                await addSystemMessage(`✅ Success! VLAN ${vlanData.id} has been created.`, true);

            } else if (action.action === 'update_appliance_vlan') {
                const { networkId, vlanId, ...vlanData } = payload;
                await addSystemMessage(`Executing action: Updating VLAN ${vlanId} in network ${networkId}...`, true);
                await updateNetworkApplianceVlan(activeNetwork.apiKey, networkId, vlanId, vlanData);
                await addSystemMessage(`✅ Success! VLAN ${vlanId} has been updated.`, true);

            // --- OPERATIONS & HEALTH ---
            } else if (action.action === 'get_device_uplink') {
                const { serial } = payload;
                await addSystemMessage(`Fetching uplink status for device ${serial}...`, true);
                const data = await getDeviceUplink(activeNetwork.apiKey, serial);
                await addSystemMessage(`Found uplink data. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here is the uplink status. Please summarize it.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'get_uplinks_loss_and_latency') {
                const { ip, timespan } = payload;
                await addSystemMessage(`Fetching uplink loss/latency to ${ip}...`, true);
                const data = await getOrgUplinksLossAndLatency(activeNetwork.apiKey, activeNetwork.orgId, ip, timespan);
                await addSystemMessage(`Found ${data.length} devices with data. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here is the uplink performance data. Please summarize it.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'reboot_device') {
                const { serial } = payload;
                await addSystemMessage(`Executing action: Rebooting device ${serial}...`, true);
                await rebootDevice(activeNetwork.apiKey, serial);
                await addSystemMessage(`✅ Success! Device ${serial} is rebooting.`, true);

            } else if (action.action === 'blink_device_leds') {
                const { serial, duration } = payload;
                await addSystemMessage(`Executing action: Blinking LEDs on ${serial} for ${duration}s...`, true);
                await blinkDeviceLeds(activeNetwork.apiKey, serial, duration);
                await addSystemMessage(`✅ Success! LEDs on device ${serial} are blinking.`, true);

            } else if (action.action === 'get_firmware_upgrades') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching firmware upgrade info for network ${networkId}...`, true);
                const data = await getNetworkFirmwareUpgrades(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found firmware data. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here is the firmware upgrade info. Please summarize it.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'update_firmware_upgrades') {
                const { networkId, ...fwPayload } = payload;
                await addSystemMessage(`Executing action: Scheduling firmware upgrade for network ${networkId}...`, true);
                await updateNetworkFirmwareUpgrades(activeNetwork.apiKey, networkId, fwPayload);
                await addSystemMessage(`✅ Success! Firmware upgrade has been scheduled.`, true);

            } else if (action.action === 'get_alert_settings') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching alert settings for network ${networkId}...`, true);
                const data = await getNetworkAlertSettings(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found settings. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the alert settings. Please summarize them.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'update_alert_settings') {
                const { networkId, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating alert settings for network ${networkId}...`, true);
                await updateNetworkAlertSettings(activeNetwork.apiKey, networkId, settings);
                await addSystemMessage(`✅ Success! Alert settings have been updated.`, true);
            
            } else if (action.action === 'get_syslog_servers') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching syslog servers for network ${networkId}...`, true);
                const data = await getNetworkSyslogServers(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found ${data.servers?.length || 0} servers. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here are the syslog servers. Please list them.\n\nDATA: ${JSON.stringify(data.servers, null, 2)}`);

            } else if (action.action === 'update_syslog_servers') {
                const { networkId, servers } = payload;
                await addSystemMessage(`Executing action: Updating syslog servers for network ${networkId}...`, true);
                await updateNetworkSyslogServers(activeNetwork.apiKey, networkId, servers);
                await addSystemMessage(`✅ Success! Syslog servers have been updated.`, true);

            } else if (action.action === 'get_snmp_settings') {
                await addSystemMessage(`Fetching SNMP settings for the organization...`, true);
                const data = await getOrgSnmpSettings(activeNetwork.apiKey, activeNetwork.orgId);
                await addSystemMessage(`Found settings. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the SNMP settings. Please summarize them.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'update_snmp_settings') {
                await addSystemMessage(`Executing action: Updating SNMP settings...`, true);
                await updateOrgSnmpSettings(activeNetwork.apiKey, activeNetwork.orgId, payload);
                await addSystemMessage(`✅ Success! SNMP settings have been updated.`, true);

            // --- TEMPLATES & SCALE ---
            } else if (action.action === 'list_config_templates') {
                await addSystemMessage(`Fetching config templates for the organization...`, true);
                const data = await getOrgConfigTemplates(activeNetwork.apiKey, activeNetwork.orgId);
                await addSystemMessage(`Found ${data.length} templates. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here are the config templates. Please list them.\n\nDATA: ${JSON.stringify(data, null, 2)}`);
            
            } else if (action.action === 'bind_network_to_template') {
                const { networkId, ...bindPayload } = payload;
                await addSystemMessage(`Executing action: Binding network ${networkId} to template ${bindPayload.configTemplateId}...`, true);
                await bindNetworkToTemplate(activeNetwork.apiKey, networkId, bindPayload);
                await addSystemMessage(`✅ Success! Network has been bound to the template.`, true);

            // --- SECURITY & ACCESS ---
            } else if (action.action === 'list_org_admins') {
                await addSystemMessage('Fetching organization administrators...', true);
                const data = await getOrgAdmins(activeNetwork.apiKey, activeNetwork.orgId);
                await addSystemMessage(`Found ${data.length} admins. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here are the organization admins. Please list them.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'create_org_admin') {
                await addSystemMessage(`Executing action: Creating new admin...`, true);
                await createOrgAdmin(activeNetwork.apiKey, activeNetwork.orgId, payload);
                await addSystemMessage(`✅ Success! Admin "${payload.email}" has been created.`, true);
            
            // --- CAMERAS & SENSORS ---
            } else if (action.action === 'generate_camera_snapshot') {
                const { serial } = payload;
                await addSystemMessage(`Generating snapshot for camera ${serial}...`, true);
                const data = await generateCameraSnapshot(activeNetwork.apiKey, serial);
                if (data.url) {
                    await handleSendMessage(`CONTEXT: A snapshot was generated. Please show this link to the user in markdown format: ${data.url}`);
                } else {
                    await addSystemMessage(`❌ Error generating snapshot: ${data.error || 'Unknown error'}.`, true);
                }

            } else if (action.action === 'get_motion_analytics') {
                const { serial, timespan } = payload;
                await addSystemMessage(`Fetching motion analytics for camera ${serial}...`, true);
                const data = await getCameraMotionAnalytics(activeNetwork.apiKey, serial, timespan);
                await addSystemMessage(`Found analytics data. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here is the motion analytics data. Please summarize it.\n\nDATA: ${JSON.stringify(data, null, 2)}`);
            
            } else if (action.action === 'get_sensor_alerts') {
                const { serial } = payload;
                await addSystemMessage(`Fetching sensor alert settings for ${serial}...`, true);
                const data = await getSensorAlerts(activeNetwork.apiKey, serial);
                await addSystemMessage(`Found settings. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here are the sensor alert settings. Please summarize them.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'update_sensor_alerts') {
                const { serial, profiles } = payload;
                await addSystemMessage(`Executing action: Updating sensor alerts for ${serial}...`, true);
                await updateSensorAlerts(activeNetwork.apiKey, serial, profiles);
                await addSystemMessage(`✅ Success! Sensor alert settings have been updated.`, true);

            // --- WAN & CELLULAR ---
            } else if (action.action === 'get_cellular_status') {
                const { serial } = payload;
                await addSystemMessage(`Fetching cellular status for ${serial}...`, true);
                const data = await getCellularStatus(activeNetwork.apiKey, serial);
                await addSystemMessage(`Found status. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here is the cellular status. Please summarize it.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'get_cellular_usage_history') {
                const { serial, timespan } = payload;
                await addSystemMessage(`Fetching cellular usage history for ${serial}...`, true);
                const data = await getCellularUsageHistory(activeNetwork.apiKey, serial, timespan);
                await addSystemMessage(`Found ${data.length} data points. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here is the cellular usage history. Please summarize it.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'update_uplink_settings') {
                const { networkId, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating uplink settings for network ${networkId}...`, true);
                await updateApplianceUplinkSettings(activeNetwork.apiKey, networkId, settings);
                await addSystemMessage(`✅ Success! Uplink settings have been updated.`, true);

            // --- ADVANCED ANALYTICS ---
            } else if (action.action === 'get_network_traffic') {
                const { networkId, timespan } = payload;
                await addSystemMessage(`Fetching network traffic analytics for network ${networkId}...`, true);
                const data = await getNetworkTraffic(activeNetwork.apiKey, networkId, timespan);
                await addSystemMessage(`Found traffic data. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here is the network traffic data. Please summarize the top applications by usage.\n\nDATA: ${JSON.stringify(data, null, 2)}`);
            
            } else if (action.action === 'get_org_audit_logs') {
                const { timespan } = payload;
                await addSystemMessage(`Fetching organization audit logs for the last ${timespan} seconds...`, true);
                const data = await getOrgAuditLogs(activeNetwork.apiKey, activeNetwork.orgId, timespan);
                await addSystemMessage(`Found ${data.length} audit log entries. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here are the audit logs. Please summarize the key changes.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            // --- LOCATION SERVICES ---
            } else if (action.action === 'list_floor_plans') {
                const { networkId } = payload;
                await addSystemMessage(`Fetching floor plans for network ${networkId}...`, true);
                const data = await getNetworkFloorPlans(activeNetwork.apiKey, networkId);
                await addSystemMessage(`Found ${data.length} floor plans. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here are the floor plans. Please list them.\n\nDATA: ${JSON.stringify(data, null, 2)}`);
            
            } else if (action.action === 'update_bluetooth_settings') {
                const { serial, ...settings } = payload;
                await addSystemMessage(`Executing action: Updating Bluetooth settings for ${serial}...`, true);
                await updateWirelessBluetoothSettings(activeNetwork.apiKey, serial, settings);
                await addSystemMessage(`✅ Success! Bluetooth settings have been updated.`, true);

            // --- LICENSING & COMPLIANCE ---
            } else if (action.action === 'get_license_overview') {
                await addSystemMessage(`Fetching license overview...`, true);
                const data = await getOrgLicenseOverview(activeNetwork.apiKey, activeNetwork.orgId);
                await addSystemMessage(`Found license overview. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here is the license overview. Please summarize the status.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            } else if (action.action === 'list_licenses') {
                await addSystemMessage(`Fetching all licenses...`, true);
                const data = await getOrgLicenses(activeNetwork.apiKey, activeNetwork.orgId);
                await addSystemMessage(`Found ${data.length} licenses. Sending to AI...`, true);
                await handleSendMessage(`CONTEXT: Here is the list of all licenses. Please summarize them, highlighting any that are expiring soon.\n\nDATA: ${JSON.stringify(data, null, 2)}`);

            // --- RCA & DIAGNOSTICS (EXISTING) ---
            } else if (action.action === 'get_device_events' || action.action === 'get_config_changes') {
                 setLoadingState('rca');
                rcaAbortController.current = new AbortController();
                const signal = rcaAbortController.current.signal;

                let analysisData;
                let analysisTopic: string;

                if (action.action === 'get_device_events') {
                    const { serial } = payload;
                    const device = merakiDevices.find(d => d.serial === serial);
                    analysisTopic = `event logs for device ${device?.name || serial}`;
                    await addSystemMessage(`Fetching ${analysisTopic}...`, true);
                    const productType = getProductTypeFromModel(device?.model || '');
                    analysisData = await getDeviceEvents(activeNetwork.apiKey, device?.networkId || '', serial, productType, signal);
                } else {
                    analysisTopic = `configuration changes`;
                    await addSystemMessage(`Fetching ${analysisTopic}...`, true);
                    analysisData = await getConfigChanges(activeNetwork.apiKey, activeNetwork.orgId, payload?.networkId, signal);
                }

                if (!analysisData || analysisData.length === 0) {
                    await addSystemMessage(`No relevant ${analysisTopic} found.`, true);
                    setLoadingState('idle');
                } else {
                    await addSystemMessage(`Found ${analysisData.length} items. Sending to AI for analysis...`, true);
                    const analysisPrompt = `CONTEXT: Here are the ${analysisTopic} you requested. Please analyze them, provide a summary, and determine the probable root cause of the issue discussed.\n\nDATA:\n${JSON.stringify(analysisData, null, 2)}`;
                    await handleSendMessage(analysisPrompt);
                }

            } else if (action.action === 'get_switch_port_stats') {
                setLoadingState('rca');
                rcaAbortController.current = new AbortController();
                const { serial, portId } = payload;
                const device = merakiDevices.find(d => d.serial === serial);
                if (!device) throw new Error(`Device with serial ${serial} not found.`);

                await addSystemMessage(`Fetching details and traffic stats for port(s) ${portId} on device ${device.name}...`, true);
                const details = await getSwitchPortDetails(activeNetwork.apiKey, serial, portId, rcaAbortController.current.signal);
                const statsByPort = await getSwitchPortStats(activeNetwork.apiKey, serial, portId, rcaAbortController.current.signal);


                let aggregatedStats: MerakiSwitchPortStats[] = [];
                const portIds = Object.keys(statsByPort);
                if (portIds.length > 0) {
                    const baseStats = Object.values(statsByPort).reduce((a, b) => a.length > b.length ? a : b);
                    aggregatedStats = baseStats.map((statPoint, index) => {
                        let totalSent = 0, totalReceived = 0;
                        portIds.forEach(id => {
                            if (statsByPort[id]?.[index]) {
                                totalSent += statsByPort[id][index].sent;
                                totalReceived += statsByPort[id][index].received;
                            }
                        });
                        return { ts: statPoint.ts, sent: totalSent, received: totalReceived };
                    });
                }

                setActivePortDetails({ device, portId, settings: details });
                setPortStats(aggregatedStats);
                await addSystemMessage(`Found data. Sending to AI for summary...`, true);
                const isRange = portId.includes('-');
                const analysisPrompt = `CONTEXT: Here is the configuration and recent traffic statistics for the requested switch port(s). Please analyze and provide a user-friendly summary. ${isRange ? 'This is a range of ports. Summarize the configuration (e.g., if VLANs are consistent) and provide aggregate traffic stats.' : 'Mention the port\'s name, enabled status, VLAN config, and a summary of the traffic (e.g., total data transferred).'} \n\nPORT CONFIGURATION(S): ${JSON.stringify(details, null, 2)} \n\nPORT TRAFFIC (last hour, bytes sent/received per port): ${JSON.stringify(statsByPort, null, 2)}`;
                await handleSendMessage(analysisPrompt);

            } else if (action.action === 'get_site_to_site_vpn_status') {
                await addSystemMessage('Fetching site-to-site VPN statuses for the organization...', true);
                const statuses = await getOrgVpnStatuses(activeNetwork.apiKey, activeNetwork.orgId);
                setVpnStatuses(statuses);
                await addSystemMessage(`Found VPN status for ${statuses.length} networks. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here is the site-to-site VPN status information you requested. Please analyze this data and provide a concise, user-friendly summary. Mention how many networks are participating in the VPN and a high-level overview of their connection status. \n\nVPN STATUS DATA: ${JSON.stringify(statuses, null, 2)}`);

            } else if (action.action === 'get_l3_firewall_rules') {
                const { serial } = payload;
                const device = merakiDevices.find(d => d.serial === serial);
                if (!device) throw new Error(`Device with serial ${serial} not found.`);

                await addSystemMessage(`Fetching L3 firewall rules for ${device.name}...`, true);
                const rules = await getNetworkL3FirewallRules(activeNetwork.apiKey, device.networkId);
                await addSystemMessage(`Found ${rules.length} rules. Sending to AI for summary...`, true);
                await handleSendMessage(`CONTEXT: Here are the current L3 firewall rules for the network containing device "${device.name}". Please summarize them for the user.\n\nFIREWALL RULES:${JSON.stringify(rules, null, 2)}`);
            
            } else if (action.action === 'update_l3_firewall_rules') {
                const { serial, rules } = payload;
                const device = merakiDevices.find(d => d.serial === serial);
                if (!device) throw new Error(`Device with serial ${serial} not found.`);
                
                await addSystemMessage(`Executing action: Updating L3 firewall rules for network containing ${device.name}...`, true);
                await updateNetworkL3FirewallRules(activeNetwork.apiKey, device.networkId, rules);
                await addSystemMessage(`✅ Success! L3 firewall rules have been updated.`, true);
            
            } else {
                await addSystemMessage(`⚠️ Unknown action requested by AI: '${action.action}'`, true);
            }

            // If the action was not one that spins off another AI message, stop loading.
            const isChainedAction = ['get_device_events', 'get_config_changes', 'get_switch_port_stats', 'get_client_inventory'].includes(action.action)
                || action.action.startsWith('list_')
                || action.action.startsWith('get_');
            
            if (!isChainedAction) {
                setLoadingState('idle');
            }

        } catch (error) {
             if (error instanceof Error && error.name === 'AbortError') {
                await addSystemMessage('Root Cause Analysis cancelled by user.', true);
            } else {
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                await addSystemMessage(`❌ Error executing action: ${errorMessage}`, true);
            }
            setLoadingState('idle');
        } finally {
            rcaAbortController.current = null;
            isExecutingAction.current = false;
        }
    };
    
    const triggerRcaForDevice = async (device: MerakiDevice) => {
        if (!user || !activeNetworkId) return;
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return;
    
        setLoadingState('rca');
        rcaAbortController.current = new AbortController();
        const signal = rcaAbortController.current.signal;
        await addSystemMessage(`Device ${device.name} (${device.serial}) has a new status: '${device.status}'. Starting Root Cause Analysis...`, true);
    
        try {
            await addSystemMessage(`Fetching event logs for ${device.name} and recent network configuration changes...`, true);
            const productType = getProductTypeFromModel(device.model);
            const [events, configChanges] = await Promise.all([
                getDeviceEvents(activeNetwork.apiKey, device.networkId, device.serial, productType, signal),
                getConfigChanges(activeNetwork.apiKey, activeNetwork.orgId, device.networkId, signal)
            ]);
    
            if (events.length === 0 && configChanges.length === 0) {
                await addSystemMessage(`No recent events or configuration changes found for ${device.name}. Unable to determine cause.`, true);
                setLoadingState('idle');
                return;
            }
    
            await addSystemMessage(`Found ${events.length} relevant events and ${configChanges.length} configuration changes. Sending to AI for analysis...`, true);
    
            const analysisPrompt = `CONTEXT: The device "${device.name}" (${device.serial}) has just entered a problematic state: "${device.status}". I have automatically retrieved its recent event logs and the network's recent configuration changes for you to analyze. Please provide a summary of these findings and determine the probable root cause for this status change.

DEVICE EVENT LOGS:
${JSON.stringify(events, null, 2)}

NETWORK CONFIGURATION CHANGES:
${JSON.stringify(configChanges, null, 2)}
`;
            await handleSendMessage(analysisPrompt);
    
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                await addSystemMessage('Automated Root Cause Analysis cancelled by user.', true);
            } else {
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                await addSystemMessage(`❌ Error during automated RCA: ${errorMessage}`, true);
            }
             setLoadingState('idle');
        } finally {
            rcaAbortController.current = null;
        }
    };

    const handleManualRca = async (device: MerakiDevice) => {
        const messageText = `I need help. Please run a full diagnostic and root cause analysis on the device "${device.name}" (${device.serial}). Check its event logs and any recent network configuration changes that might affect it.`;
        await handleSendMessage(messageText);
    };

    const handleShowFeatures = async (device: MerakiDevice) => {
        const messageText = `What are the key features and management capabilities of the "${device.name}" device (model: ${device.model})? Give me a concise summary.`;
        await handleSendMessage(messageText);
    };

    const handleFetchDeviceLogs = async (device: MerakiDevice): Promise<MerakiEvent[]> => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return [];
        try {
            const productType = getProductTypeFromModel(device.model);
            return await getDeviceEvents(activeNetwork.apiKey, device.networkId, device.serial, productType);
        } catch (error) {
            await addSystemMessage(`❌ Error fetching logs for ${device.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            return [];
        }
    };
    
    const handleFetchConfigChanges = async (): Promise<MerakiConfigChange[]> => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork || !user) return [];
        try {
            return await getConfigChanges(activeNetwork.apiKey, activeNetwork.orgId);
        } catch (error) {
            await addSystemMessage(`❌ Error fetching config changes: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            return [];
        }
    };


    const handleFetchDeviceDetails = async (device: MerakiDevice): Promise<MerakiDeviceDetails | null> => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return null;
        try {
            return await getDeviceDetails(activeNetwork.apiKey, device.serial);
        } catch (error) {
            await addSystemMessage(`❌ Error fetching details for ${device.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            return null;
        }
    };

    const handleCancelRca = () => {
        if (rcaAbortController.current) {
            rcaAbortController.current.abort();
        }
    };
    
    useEffect(() => {
      pollCallback.current = async () => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork || !user || merakiDevices.length === 0) return;
    
        try {
            const currentDevices = await getOrgDevices(activeNetwork.apiKey, activeNetwork.orgId);
            const previousDeviceStatus = new Map(merakiDevices.map(d => [d.serial, d.status]));
            
            const newlyProblematicDevices = currentDevices.filter(d => {
                const oldStatus = previousDeviceStatus.get(d.serial);
                return (d.status === 'offline' || d.status === 'alerting') && oldStatus === 'online';
            });
            
            setMerakiDevices(currentDevices);
    
            for (const device of newlyProblematicDevices) {
                await triggerRcaForDevice(device);
            }
        } catch (error) {
            console.error("Polling error:", error);
        }
      };

      webexPollCallback.current = async () => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork?.webexVerified || !botEmail || !activeNetwork.webexBotToken || !activeNetwork.webexSpaceId) return;

        try {
            const webexMessages = await getWebexMessages(activeNetwork.webexBotToken, activeNetwork.webexSpaceId);
            
            const newMessages = webexMessages
                .filter((m: any) => 
                    m.personEmail !== botEmail && 
                    (!lastWebexMessageTimestamp.current || m.created > lastWebexMessageTimestamp.current)
                )
                .sort((a: any, b: any) => new Date(a.created).getTime() - new Date(b.created).getTime());

            if (newMessages.length > 0) {
                for (const message of newMessages) {
                    await handleSendMessage(message.text, true, message.personEmail);
                    lastWebexMessageTimestamp.current = message.created;
                }
            }
        } catch (error) {
            console.error("Webex polling error:", error);
        }
      };
    });

    if (!user) {
        return <LoginScreen onLogin={handleLogin} />;
    }
    
    return (
        <div className="flex flex-col h-screen p-4 sm:p-6 lg:p-8 text-[var(--color-text-primary)]">
            <Header 
                user={user}
                networks={networks}
                activeNetworkId={activeNetworkId}
                onNetworkSelect={(id) => setActiveNetworkId(id)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenHelp={() => setIsHelpOpen(true)}
                onOpenMaturity={() => setIsMaturityOpen(true)}
                onLogout={handleLogout}
                isDevicePanelOpen={isDevicePanelOpen}
                onToggleDevicePanel={() => setIsDevicePanelOpen(prev => !prev)}
                onClearChat={handleClearChat}
            />
            <div 
                className="flex-1 flex flex-row overflow-hidden mt-4 bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-xl animate-fade-slide-up border border-[var(--color-border-primary)]"
                style={{ animationDelay: '100ms' }}
            >
                <main className="flex-1 flex flex-col overflow-hidden">
                    <ChatWindow 
                        messages={messages} 
                        loadingState={loadingState}
                        onCancelRca={handleCancelRca}
                    />
                    <UsageStats lastTokensUsed={lastTokensUsed} lastCost={lastCost} totalCost={totalCost} />
                    <div className="p-2 sm:p-4">
                        <MessageInput 
                            onSendMessage={handleSendMessage} 
                            isLoading={loadingState !== 'idle' || isInitialDeviceLoad} 
                            disabled={!activeNetworkId || loadingState !== 'idle' || isInitialDeviceLoad}
                        />
                    </div>
                </main>
                <DevicePanel 
                    isOpen={isDevicePanelOpen}
                    devices={merakiDevices}
                    merakiNetworks={merakiNetworksList}
                    vpnStatuses={vpnStatuses}
                    onClaimDevices={handleClaimDevices}
                    onManualRca={handleManualRca}
                    onShowFeatures={handleShowFeatures}
                    onFetchLogs={handleFetchDeviceLogs}
                    onFetchDetails={handleFetchDeviceDetails}
                    onFetchConfigChanges={handleFetchConfigChanges}
                    portStats={portStats}
                    activePortDetails={activePortDetails}
                    onApplyTemplate={handleApplyTemplate}
                    userId={user.id}
                />
            </div>
            {isSettingsOpen && (
                <SettingsModal 
                    isOpen={isSettingsOpen}
                    onClose={() => setIsSettingsOpen(false)}
                    userId={user.id}
                    onNetworksUpdate={loadNetworks}
                />
            )}
            {isHelpOpen && (
                <HelpModal
                    isOpen={isHelpOpen}
                    onClose={() => setIsHelpOpen(false)}
                />
            )}
            {isMaturityOpen && (
                <MaturityModal
                    isOpen={isMaturityOpen}
                    onClose={() => setIsMaturityOpen(false)}
                />
            )}
            {isEasterEggVisible && (
                <EasterEggModal onClose={() => setIsEasterEggVisible(false)} />
            )}
        </div>
    );
};

export default App;