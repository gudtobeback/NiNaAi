import React, { useState, useEffect, useRef } from 'react';
import { User, NetworkConfiguration, ChatMessage, Sender, MerakiDevice, MerakiEvent, MerakiDeviceDetails, MerakiConfigChange, MerakiSwitchPortStats, MerakiNetwork, DefaultTemplate, MerakiVpnStatus, MerakiFirewallRule } from './types';
import * as auth from './services/authService';
import * as db from './services/dbService';
import { getAiResponse } from './services/geminiService';
import { getOrgDevices, updateSwitchPort, getDeviceEvents, getConfigChanges, getDeviceDetails, getSwitchPortDetails, getSwitchPortStats, getOrgNetworks, claimDevices, getOrgVpnStatuses, getNetworkL3FirewallRules, updateNetworkL3FirewallRules, sendWebexMessage, getWebexMessages, getWebexMe } from './services/merakiService';

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
    const [isEasterEggVisible, setIsEasterEggVisible] = useState(false);
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
                setPortStats(null);
                setActivePortDetails(null);
                setBotEmail(null);
                lastWebexMessageTimestamp.current = null;
                isExecutingAction.current = false;

                const activeNetwork = networks.find(n => n.id === activeNetworkId);

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

    const loadMerakiDevices = async () => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return;

        await addSystemMessage("Fetching Meraki device list...");
        try {
            const devices = await getOrgDevices(activeNetwork.apiKey, activeNetwork.orgId);
            setMerakiDevices(devices);
            await addSystemMessage(`Successfully discovered ${devices.length} devices.`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`Error fetching devices: ${errorMessage}`, true);
            setMerakiDevices([]);
        }
    };

    const loadMerakiNetworks = async () => {
        const activeNetwork = networks.find(n => n.id === activeNetworkId);
        if (!activeNetwork) return;
        try {
            const merakiNets = await getOrgNetworks(activeNetwork.apiKey, activeNetwork.orgId);
            setMerakiNetworksList(merakiNets);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`Error fetching network list: ${errorMessage}`, true);
            setMerakiNetworksList([]);
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
            if (match) {
                await handleFrontendAction(finalResponseText);
            } else {
                setLoadingState('idle');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            await addSystemMessage(`Error communicating with AI: ${errorMessage}`, true);
            setLoadingState('idle');
        }
    };

    const handleFrontendAction = async (aiResponse: string) => {
        if (!user || !activeNetworkId || isExecutingAction.current) {
            if(isExecutingAction.current) console.warn("Action already in progress. Ignoring duplicate call.");
            return;
        }

        isExecutingAction.current = true;

        const actionRegex = /<execute_action>([\s\S]*?)<\/execute_action>/;
        const match = aiResponse.match(actionRegex);
        if (!match || !match[1]) {
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
            const action = JSON.parse(match[1]);

            if (action.action === 'update_switch_port') {
                if (!action.payload || !action.payload.serial || !action.payload.portId) {
                    throw new Error("Action 'update_switch_port' is missing required payload parameters (serial, portId).");
                }
                setLoadingState('thinking');
                const { serial, portId, ...settings } = action.payload;
                await addSystemMessage(`Executing action: Updating port(s) ${portId} on device ${serial}...`, true);
                await updateSwitchPort(activeNetwork.apiKey, serial, portId, settings);
                await addSystemMessage(`✅ Success! Port(s) ${portId} on ${serial} have been updated.`, true);
                setLoadingState('idle');
            
            } else if (action.action === 'claim_devices') {
                if (!action.payload || !action.payload.networkName || !action.payload.serials) {
                    throw new Error("Action 'claim_devices' is missing required payload parameters (networkName, serials).");
                }
                const { networkName, serials } = action.payload;
                const targetNetwork = merakiNetworksList.find(n => n.name.toLowerCase() === networkName.toLowerCase());

                if (!targetNetwork) {
                    await addSystemMessage(`❌ Error: Could not find a network named "${networkName}". Please check the name and try again. Available networks: ${merakiNetworksList.map(n => n.name).join(', ')}`, true);
                    setLoadingState('idle');
                    return;
                }
                await handleClaimDevices(targetNetwork.id, serials);

            } else if (action.action === 'get_device_events' || action.action === 'get_config_changes') {
                 setLoadingState('rca');
                rcaAbortController.current = new AbortController();
                const signal = rcaAbortController.current.signal;

                let analysisData;
                let analysisTopic: string;

                if (action.action === 'get_device_events') {
                    const { serial } = action.payload;
                    const device = merakiDevices.find(d => d.serial === serial);
                    analysisTopic = `event logs for device ${device?.name || serial}`;
                    await addSystemMessage(`Fetching ${analysisTopic}...`, true);
                    const productType = getProductTypeFromModel(device?.model || '');
                    analysisData = await getDeviceEvents(activeNetwork.apiKey, device?.networkId || '', serial, productType, signal);
                } else {
                    analysisTopic = `configuration changes`;
                    await addSystemMessage(`Fetching ${analysisTopic}...`, true);
                    analysisData = await getConfigChanges(activeNetwork.apiKey, activeNetwork.orgId, action.payload?.serial, signal);
                }

                if (!analysisData || analysisData.length === 0) {
                    await addSystemMessage(`No relevant ${analysisTopic} found.`, true);
                    setLoadingState('idle');
                    return;
                }

                await addSystemMessage(`Found ${analysisData.length} items. Sending to AI for analysis...`, true);
                const analysisPrompt = `CONTEXT: Here are the ${analysisTopic} you requested. Please analyze them, provide a summary, and determine the probable root cause of the issue discussed.\n\nDATA:\n${JSON.stringify(analysisData, null, 2)}`;
                
                await handleSendMessage(analysisPrompt);


            } else if (action.action === 'get_switch_port_stats') {
                if (!action.payload || !action.payload.serial || !action.payload.portId) {
                    throw new Error("Action 'get_switch_port_stats' is missing required payload parameters (serial, portId).");
                }
                setLoadingState('rca');
                rcaAbortController.current = new AbortController();
                const signal = rcaAbortController.current.signal;

                const { serial, portId } = action.payload;
                const device = merakiDevices.find(d => d.serial === serial);
                if (!device) throw new Error(`Device with serial ${serial} not found.`);

                await addSystemMessage(`Fetching details and traffic stats for port(s) ${portId} on device ${device.name}...`, true);
                const details = await getSwitchPortDetails(activeNetwork.apiKey, serial, portId, signal);
                const statsByPort = await getSwitchPortStats(activeNetwork.apiKey, serial, portId, signal);


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
                setLoadingState('thinking');
                await addSystemMessage('Fetching site-to-site VPN statuses for the organization...', true);
                const statuses = await getOrgVpnStatuses(activeNetwork.apiKey, activeNetwork.orgId);
                setVpnStatuses(statuses);
                await addSystemMessage(`Found VPN status for ${statuses.length} networks. Sending to AI for summary...`, true);
                const analysisPrompt = `CONTEXT: Here is the site-to-site VPN status information you requested. Please analyze this data and provide a concise, user-friendly summary. Mention how many networks are participating in the VPN and a high-level overview of their connection status. \n\nVPN STATUS DATA: ${JSON.stringify(statuses, null, 2)}`;
                await handleSendMessage(analysisPrompt);

            } else if (action.action === 'get_l3_firewall_rules') {
                const { serial } = action.payload;
                const device = merakiDevices.find(d => d.serial === serial);
                if (!device) throw new Error(`Device with serial ${serial} not found.`);

                setLoadingState('thinking');
                await addSystemMessage(`Fetching L3 firewall rules for ${device.name}...`, true);
                const rules = await getNetworkL3FirewallRules(activeNetwork.apiKey, device.networkId);
                await addSystemMessage(`Found ${rules.length} rules. Sending to AI for summary...`, true);

                const analysisPrompt = `CONTEXT: Here are the current L3 firewall rules for the network containing device "${device.name}". Please summarize them for the user.\n\nFIREWALL RULES:${JSON.stringify(rules, null, 2)}`;
                await handleSendMessage(analysisPrompt);
            
            } else if (action.action === 'update_l3_firewall_rules') {
                const { serial, rules } = action.payload;
                const device = merakiDevices.find(d => d.serial === serial);
                if (!device) throw new Error(`Device with serial ${serial} not found.`);
                
                setLoadingState('thinking');
                await addSystemMessage(`Executing action: Updating L3 firewall rules for network containing ${device.name}...`, true);
                await updateNetworkL3FirewallRules(activeNetwork.apiKey, device.networkId, rules);
                await addSystemMessage(`✅ Success! L3 firewall rules have been updated.`, true);
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