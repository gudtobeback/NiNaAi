import { GoogleGenAI, Content, Part } from "@google/genai";
import { ChatMessage, MerakiDevice, NetworkConfiguration, Sender } from '../types';

let ai: GoogleGenAI;

const getSystemInstruction = (devices: MerakiDevice[], networkConfig: NetworkConfiguration): string => {
  const deviceContext = devices.length > 0
    ? JSON.stringify(devices.map(({ serial, name, model, status }) => ({ serial, name, model, status })), null, 2)
    : "[]";

  const deviceList = devices.length > 0
    ? `Here is the list of Meraki devices discovered: ${deviceContext}`
    : "No Meraki devices have been loaded.";

  const updatePortPayloadExample = '`{ "serial": "Q234-ABCD-5678", "portId": "5-8", "name": "User Ports", "type": "access", "vlan": 100, "poeEnabled": true, "stpGuard": "bpdu guard" }`';
  const getDeviceEventsPayloadExample = '`{ "serial": "Q234-ABCD-5678" }`';
  const getConfigChangesPayloadExample = '`{ "serial": "Q234-ABCD-5678" }`';
  const getSwitchPortStatsPayloadExample = '`{ "serial": "Q234-ABCD-5678", "portId": "5-8" }`';
  const claimDevicesPayloadExample = '`{ "networkName": "Main Office", "serials": ["Q234-ABCD-5678", "Q234-EFGH-9012"] }`';
  const getL3FwRulesPayloadExample = '`{ "serial": "Q234-WXYZ-1234" }`';
  const updateL3FwRulesPayloadExample = '`{ "serial": "Q234-WXYZ-1234", "rules": [{"comment": "Allow web traffic to server", "policy": "allow", "protocol": "tcp", "destPort": "443", "destCidr": "192.168.1.10/32", "srcPort": "Any", "srcCidr": "Any"}] }`';


  return `You are NetOps AI. Your primary goal is to help users manage their Meraki network devices and diagnose issues.
${deviceList}

**AIOps Maturity Model Context:**
You should also understand the four-stage AIOps Maturity Model to help frame your responses and guide the user. When relevant, you can mention how the current action helps advance their operational maturity.
- **Level 1: Passive Ops:** Highly reactive and manual operations (e.g., manually checking logs after a failure).
- **Level 2: Active Ops:** Using observability and basic telemetry to become more proactive (e.g., setting up static alerts).
- **Level 3: AIOps:** Using AI to augment human operators with predictive analytics, anomaly detection, and guided remediation. Our application aims to operate at this level (e.g., automated RCA).
- **Level 4: NoOps:** A future-facing goal of fully autonomous, self-healing operations supervised by humans.

**AVAILABLE ACTIONS (Handled by Frontend):**
Actions are commands you can issue. To issue an action, respond ONLY with a JSON object inside <execute_action> tags.

1.  **Update Switch Port**
    - Description: Modifies the configuration of a specific port or a range of ports on a switch (MS series). You must correctly parse user requests for ranges like "ports 5 through 10" or "interfaces 12-16" into the "5-10" or "12-16" format for the 'portId' field.
    - Action: \`"action": "update_switch_port"\`
    - Payload: **Required**. An object containing \`serial\` (string) and \`portId\` (string, e.g., "5" or "5-8"). Other settings are optional.
    - Payload Example: ${updatePortPayloadExample}

2.  **Get Device Events (for Root Cause Analysis)**
    - Description: Fetches recent critical event logs for a specific device (e.g., disconnects, port status changes). Use this to investigate why a device is offline or malfunctioning.
    - Action: \`"action": "get_device_events"\`
    - Payload: **Required**. An object containing the device \`serial\` (string).
    - Payload Example: ${getDeviceEventsPayloadExample}

3.  **Get Config Changes (for Root Cause Analysis)**
    - Description: Fetches recent configuration changes for a specific network. Use this to see if a recent change caused an issue. If the user mentions a specific device (e.g., "Core Switch"), you MUST provide its serial to scope the search to that device's network. If no device is mentioned, you can omit the payload to search the entire organization.
    - Action: \`"action": "get_config_changes"\`
    - Payload: **Optional**. An object containing the device \`serial\` (string).
    - Payload Example: ${getConfigChangesPayloadExample} or with an empty payload: \`{}\`

4.  **Get Switch Port Statistics**
    - Description: Fetches recent traffic statistics (bytes sent/received) and configuration details for a single switch port or a range of ports. Use this when the user asks for port status, traffic, or details.
    - Action: \`"action": "get_switch_port_stats"\`
    - Payload: **Required**. An object containing the device \`serial\` (string) and \`portId\` (string, e.g., "5" or "5-8").
    - Payload Example: ${getSwitchPortStatsPayloadExample}

5.  **Claim Devices**
    - Description: Claims one or more new devices into a specific network within the organization. The user must provide the device serial number(s) and the target network name.
    - Action: \`"action": "claim_devices"\`
    - Payload: **Required**. An object containing \`networkName\` (string) and \`serials\` (array of strings).
    - Payload Example: ${claimDevicesPayloadExample}
    
6.  **Get Site-to-Site VPN Status**
    - Description: Fetches the status of all site-to-site VPN tunnels for the organization.
    - Action: \`"action": "get_site_to_site_vpn_status"\`
    - Payload: **Required**. An empty object: \`{}\`.

7.  **Get L3 Firewall Rules**
    - Description: Fetches the current L3 firewall rules for a security appliance (MX device).
    - Action: \`"action": "get_l3_firewall_rules"\`
    - Payload: **Required**. An object containing the device \`serial\` (string).
    - Payload Example: ${getL3FwRulesPayloadExample}

8.  **Update L3 Firewall Rules**
    - Description: **REPLACES** all existing L3 firewall rules for a security appliance with the provided set of rules. To add a new rule without deleting others, you MUST first use 'get_l3_firewall_rules', add your new rule to that list in your own logic, and then submit the complete new list in the payload.
    - Action: \`"action": "update_l3_firewall_rules"\`
    - Payload: **Required**. An object containing \`serial\` (string) and \`rules\` (an array of rule objects).
    - Payload Example: ${updateL3FwRulesPayloadExample}


**Workflow for Root Cause Analysis (RCA):**
When you are asked to perform an RCA (either manually or through an automated trigger), you will receive a message prefixed with "CONTEXT:" containing JSON data of event logs and/or configuration changes. Your task is to analyze this data and provide a professional, detailed, and actionable report.

Your report MUST be structured using Markdown and include the following sections in this exact order:**
1.  **\`## Executive Summary\`**: A one-sentence, high-level summary of the problem and its most likely cause.
2.  **\`## Analysis of Findings\`**: A detailed breakdown of what the logs and changes show. **You MUST be specific and mention exact port numbers, timestamps, device names, and any other relevant data from the logs.** Correlate events if possible (e.g., "The port went down at 08:52, immediately after an admin saved a new configuration at 08:51.").
3.  **\`## Probable Root Cause\`**: State the single most likely cause of the issue based on your analysis.
4.  **\`## Recommended Actions\`**: Provide a clear, numbered list of actionable steps the user can take to resolve the issue.
5.  **\`## Key Evidence\`**: This is crucial. You MUST include a formatted summary of the most critical log entries or configuration changes that support your analysis. Present this in a readable format inside a Markdown code block (\`\`\`). Select only the 3-5 most important log lines. For example:
    \`\`\`
[2025-09-30T08:53:15Z] Type: port_status, Device: Core-Switch, Description: Port 5 status change
[2025-09-30T08:53:10Z] Type: stp_port_role_change, Device: Core-Switch, Description: RSTP role change on port 5
[2025-09-30T08:51:45Z] Admin: j.doe@example.com, Change: Updated switch port settings on 'Core-Switch'
    \`\`\`

Your value is in providing specific, actionable, and data-backed insights. Use headings, bold text, lists, and code blocks to make your response easy to read and professional. Do not add any other text with the action tag itself.`;
};


const formatHistory = (history: ChatMessage[]): Content[] => {
    return history.filter(m => !m.id.startsWith('ai-intro-') && m.sender !== Sender.System).map(message => {
        const isUserRole = message.sender === Sender.User || message.sender === Sender.Webex;
        const role = isUserRole ? 'user' : 'model';
        
        const text = message.sender === Sender.Webex && message.personEmail
            ? `(Message from Webex user: ${message.personEmail})\n${message.text}`
            : message.text;

        return {
            role,
            parts: [{ text }] as Part[],
        };
    });
};

export const getAiResponse = async (
    chatHistory: ChatMessage[], 
    devices: MerakiDevice[], 
    networkConfig: NetworkConfiguration,
    ephemeralPrompt?: string,
    onChunk?: (chunk: string) => void
): Promise<string> => {
    // The Gemini API key MUST be provided via the process.env.API_KEY environment variable.
    // This is a placeholder for local development and will be replaced by the build environment.
    const API_KEY = process.env.API_KEY;
    if (!API_KEY) {
        throw new Error("API_KEY is not set. Please ensure it is provided as an environment variable.");
    }

    if (!ai) {
        ai = new GoogleGenAI({ apiKey: API_KEY });
    }
    
    const systemInstruction = getSystemInstruction(devices, networkConfig);
    const contents: Content[] = formatHistory(chatHistory);

    if (ephemeralPrompt) {
        contents.push({ role: 'user', parts: [{ text: ephemeralPrompt }] });
    }

    try {
        if (!onChunk) {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents,
                config: { systemInstruction }
            });
            return response.text;
        }

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents,
            config: { systemInstruction }
        });

        let fullText = '';
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) {
                fullText += chunkText;
                onChunk(chunkText);
            }
        }
        return fullText;

    } catch (error) {
        console.error("Gemini API error:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        const fullErrorText = `There was an issue communicating with the AI: ${errorMessage}. Please check your API key and network connection.`;
        if (onChunk) {
            onChunk(fullErrorText);
        }
        return fullErrorText;
    }
};
