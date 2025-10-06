import { MerakiDevice, MerakiEvent, MerakiConfigChange, MerakiDeviceDetails, MerakiSwitchPortStats, MerakiNetwork, MerakiVpnStatus, MerakiFirewallRule } from '../types';

const MERAKI_BASE_URL = 'https://api.meraki.com/api/v1';
const WEBEX_BASE_URL = 'https://webexapis.com/v1';

// A proxy is needed to bypass CORS issues when calling the Meraki API from a browser.
const PROXY_URL = 'https://cors-anywhere.herokuapp.com/';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 2000;

// --- Webex API Functions ---
const fetchWithWebexApi = async (
  botToken: string,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body: Record<string, any> | null = null,
  returnText: boolean = false
): Promise<any> => {
  const headers = {
    'Authorization': `Bearer ${botToken}`,
    'Content-Type': 'application/json'
  };
  
  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const fullUrl = `${PROXY_URL}${WEBEX_BASE_URL}${endpoint}`;
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
          const response = await fetch(fullUrl, options);
          
          if (response.status === 429) {
              throw new Error("Too Many Requests"); // Standardize error for retry logic
          }

          if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: response.statusText }));
              const errorMessages = errorData.message ? errorData.message : `HTTP error! status: ${response.status}`;
              if (response.status === 401) throw new Error("Invalid Bot Token.");
              if (response.status === 404 && endpoint.startsWith('/messages')) throw new Error("Invalid Space ID or bot is not in the space.");
              throw new Error(`Webex API Error: ${errorMessages}`);
          }
          if (returnText) return response.text();
          return response.json();
      } catch (error) {
          if (error instanceof Error && error.message.includes('Too Many Requests') && attempt < MAX_RETRIES) {
              const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
              console.warn(`Webex API rate limited. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
          }
          throw error;
      }
  }
};


const MAX_WEBEX_MESSAGE_LENGTH = 7400; // A bit less than the 7439 limit for safety

/**
 * Splits a long message into chunks that are safe for the Webex API character limit.
 * It tries to split along newlines to preserve formatting.
 * @param message The full markdown message string.
 * @param maxLength The maximum length of each chunk.
 * @returns An array of message chunks.
 */
function splitMessageIntoChunks(message: string, maxLength: number): string[] {
    if (message.length <= maxLength) {
        return [message];
    }

    const chunks: string[] = [];
    let currentChunk = "";

    const lines = message.split('\n');

    for (const line of lines) {
        // If a single line itself is longer than the max length, we must split it forcefully.
        if (line.length > maxLength) {
            // First, push whatever we have in the current chunk.
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }
            // Then, split the very long line.
            let remainingLine = line;
            while (remainingLine.length > maxLength) {
                chunks.push(remainingLine.substring(0, maxLength));
                remainingLine = remainingLine.substring(maxLength);
            }
            // The rest of the long line becomes the new current chunk.
            currentChunk = remainingLine;
            continue; // Move to the next line
        }

        // If adding the new line would make the chunk too long, push the current chunk and start a new one.
        if (currentChunk.length + line.length + 1 > maxLength) {
            chunks.push(currentChunk);
            currentChunk = line;
        } else {
            // Otherwise, add the line to the current chunk.
            currentChunk += (currentChunk.length > 0 ? '\n' : '') + line;
        }
    }

    // Don't forget the last chunk!
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }

    return chunks;
}


export const sendWebexMessage = async (botToken: string, spaceId: string, markdown: string): Promise<any> => {
    console.log("Sending message to Webex space:", spaceId);
    
    const chunks = splitMessageIntoChunks(markdown, MAX_WEBEX_MESSAGE_LENGTH);

    // If there's only one chunk (or the message was short), send it directly.
    if (chunks.length <= 1) {
        // Ensure we don't send an empty string if the input was empty.
        const messageToSend = chunks[0] || '';
        if (messageToSend) {
            return fetchWithWebexApi(botToken, '/messages', 'POST', { roomId: spaceId, markdown: messageToSend });
        }
        return Promise.resolve(); // Do nothing for empty messages
    }
    
    console.log(`Message is too long. Sending in ${chunks.length} parts.`);

    let lastResult;
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue; // Skip empty chunks

        // Add a header to each part for context in the Webex space.
        const header = `_(Part ${i + 1}/${chunks.length})_\n\n`;
        let messageToSend = header + chunk;

        // In the rare case the header makes the chunk too long, send the chunk without it.
        if (messageToSend.length > MAX_WEBEX_MESSAGE_LENGTH) {
            messageToSend = chunk;
        }
        
        lastResult = await fetchWithWebexApi(botToken, '/messages', 'POST', { roomId: spaceId, markdown: messageToSend });
        // Add a small delay between sending messages to avoid rate limiting and ensure they appear in order.
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return lastResult; // Return the result of the last message sent
};

export const getWebexMessages = async (botToken: string, spaceId: string, max: number = 10): Promise<any[]> => {
    console.log("Fetching messages from Webex space:", spaceId);
    const data = await fetchWithWebexApi(botToken, `/messages?roomId=${spaceId}&max=${max}`);
    return data.items || [];
};

export const getWebexMe = async (botToken: string): Promise<any> => {
    console.log("Fetching bot details...");
    return await fetchWithWebexApi(botToken, '/people/me');
};

export const verifyWebexConnection = async (botToken: string, spaceId: string): Promise<{success: boolean}> => {
    console.log("Verifying Webex connection...");
    try {
        // 1. Verify the token is valid by fetching bot's own details
        console.log("Step 1: Verifying bot token...");
        await getWebexMe(botToken);
        console.log("Token is valid.");

        // 2. Verify the spaceId and bot membership by sending a message
        console.log("Step 2: Sending test message to space...");
        await sendWebexMessage(botToken, spaceId, "✅ Your NetOps AI Assistant has been successfully connected to this space.");
        console.log("Test message sent successfully.");
        
        return { success: true };
    } catch (error) {
        console.error("Webex verification failed:", error);
        // Re-throw the specific error from fetchWithWebexApi
        if (error instanceof Error) {
           throw error;
        }
        throw new Error("An unknown error occurred during verification.");
    }
};


// --- Meraki API Functions ---
const fetchWithMerakiApi = async (
  apiKey: string,
  endpoint: string,
  method: 'GET' | 'PUT' | 'POST' = 'GET',
  body: Record<string, any> | null = null,
  signal?: AbortSignal
): Promise<any> => {
  const headers: Record<string, string> = {
    'X-Cisco-Meraki-API-Key': apiKey,
  };
  
  const options: RequestInit = {
    method,
    headers,
    signal,
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const fullUrl = `${PROXY_URL}${MERAKI_BASE_URL}${endpoint}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
          const response = await fetch(fullUrl, options);

          if (response.status === 429) {
              throw new Error(`HTTP error! status: 429`);
          }

          if (!response.ok) {
              if (response.status === 403 && fullUrl.includes('cors-anywhere')) {
                  throw new Error(
                      `Request was blocked by the public CORS proxy. This is common. Please visit ${PROXY_URL}, click the 'Request temporary access' button, and then try connecting again.`
                  );
              }
              const errorData = await response.json().catch(() => ({}));
              const errorMessages = errorData.errors ? errorData.errors.join(', ') : `HTTP error! status: ${response.status}`;
              throw new Error(errorMessages);
          }
          if (response.status === 204) {
              return { success: true };
          }
          return response.json();
      } catch (error) {
           if (error instanceof Error) {
              if (error.name === 'AbortError' || error.message.startsWith('Request was blocked by the public CORS proxy')) {
                throw error;
              }

              if (error.message.includes('429') && attempt < MAX_RETRIES) {
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
                console.warn(`Meraki API rate limited. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              }

              throw new Error(`Failed to fetch ${endpoint}: ${error.message}`);
           }
           throw new Error(`An unknown error occurred while fetching ${endpoint}`);
      }
  }
};

export const getOrgNetworks = async (
  apiKey: string,
  orgId: string
): Promise<MerakiNetwork[]> => {
  console.log(`Fetching networks for organization: ${orgId}`);
  const networks = await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/networks`);
  if (!networks || !Array.isArray(networks) || networks.length === 0) {
    return [];
  }
  return networks.map((n: any) => ({
      id: n.id,
      name: n.name,
      organizationId: n.organizationId,
  }));
};

export const claimDevices = async (
    apiKey: string,
    networkId: string,
    serials: string[]
): Promise<any> => {
    console.log(`Claiming devices ${serials.join(', ')} into network ${networkId}`);
    const endpoint = `/networks/${networkId}/devices/claim`;
    const body = { serials };
    return await fetchWithMerakiApi(apiKey, endpoint, 'POST', body);
};

export const getOrgDevices = async (
  apiKey: string,
  orgId: string
): Promise<MerakiDevice[]> => {
  console.log(`Fetching all organization devices and statuses for orgId: ${orgId}`);

  const [allDevices, statuses] = await Promise.all([
    fetchWithMerakiApi(apiKey, `/organizations/${orgId}/devices`).catch(e => {
        console.error('Fatal: Could not fetch organization devices.', e);
        throw e;
    }),
    fetchWithMerakiApi(apiKey, `/organizations/${orgId}/devices/statuses`).catch(e => {
      console.error('Could not fetch device statuses, proceeding without them.', e);
      return [];
    })
  ]);

  if (!allDevices || !Array.isArray(allDevices)) {
      console.warn('No devices found in the specified organization.');
      return [];
  }

  const statusMap = new Map<string, string>(statuses.map((s: any) => [s.serial, s.status]));

  const formattedDevices: MerakiDevice[] = allDevices.map((device: any) => ({
      serial: device.serial,
      name: device.name || 'Unnamed Device',
      model: device.model,
      networkId: device.networkId,
      status: statusMap.get(device.serial) || 'unknown',
  }));
  
  console.log(`Total devices found: ${formattedDevices.length}`);
  return formattedDevices;
};

export interface SwitchPortSettings {
    name?: string;
    enabled?: boolean;
    type?: 'access' | 'trunk';
    vlan?: number;
    voiceVlan?: number | null;
    nativeVlan?: number;
    allowedVlans?: string;
    poeEnabled?: boolean;
    stpGuard?: 'disabled' | 'root guard' | 'bpdu guard' | 'loop guard';
    linkNegotiation?: 'Auto negotiate' | '10 Megabit half duplex' | '10 Megabit full duplex' | '100 Megabit half duplex' | '100 Megabit full duplex' | '1 Gigabit full duplex';
}

export const getSwitchPortDetails = async (
  apiKey: string,
  serial: string,
  portId: string,
  signal?: AbortSignal
): Promise<any> => { // Returns SwitchPortSettings or SwitchPortSettings[]
    console.log(`Fetching details for all ports on device ${serial} to filter for port(s) ${portId}`);
    const endpoint = `/devices/${serial}/switch/ports`;
    const allPorts = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);

    if (!Array.isArray(allPorts)) {
        throw new Error("Failed to fetch switch ports or unexpected API response format.");
    }
    
    if (portId.includes('-')) {
        const [startStr, endStr] = portId.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end) || start > end) {
            throw new Error(`Invalid port range: ${portId}`);
        }
        
        return allPorts.filter(p => {
            const pId = parseInt(p.portId, 10);
            return pId >= start && pId <= end;
        });
    } else {
        const singlePort = allPorts.find(p => p.portId === portId);
        if (!singlePort) {
            throw new Error(`Port ${portId} not found on device ${serial}.`);
        }
        return singlePort;
    }
}

export const updateSwitchPort = async (
  apiKey: string,
  serial: string,
  portId: string,
  settings: SwitchPortSettings
): Promise<any> => {
    const body: Record<string, any> = {};
    if (settings.name !== undefined) body.name = settings.name;
    if (settings.enabled !== undefined) body.enabled = settings.enabled;
    if (settings.type) body.type = settings.type;
    if (settings.vlan) body.vlan = settings.vlan;
    if (settings.voiceVlan !== undefined) body.voiceVlan = settings.voiceVlan;
    if (settings.nativeVlan) body.nativeVlan = settings.nativeVlan;
    if (settings.allowedVlans) body.allowedVlans = settings.allowedVlans;
    if (settings.poeEnabled !== undefined) body.poeEnabled = settings.poeEnabled;
    if (settings.stpGuard) body.stpGuard = settings.stpGuard;
    if (settings.linkNegotiation) body.linkNegotiation = settings.linkNegotiation;

    const portIdsToUpdate: string[] = [];
    if (portId.includes('-')) {
        const [startStr, endStr] = portId.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end) || start > end) {
            throw new Error(`Invalid port range: ${portId}`);
        }
        
        console.log(`Queueing updates for port range ${start}-${end} on device ${serial}.`);
        for (let i = start; i <= end; i++) {
            portIdsToUpdate.push(i.toString());
        }
    } else {
        portIdsToUpdate.push(portId);
    }

    const results = [];
    for (const currentPortId of portIdsToUpdate) {
        console.log(`Updating port ${currentPortId} on device ${serial} with settings:`, settings);
        const endpoint = `/devices/${serial}/switch/ports/${currentPortId}`;
        const result = await fetchWithMerakiApi(apiKey, endpoint, 'PUT', body);
        results.push(result);
    }
    
    return portIdsToUpdate.length > 1 ? results : results[0];
};

export const getDeviceDetails = async (
    apiKey: string,
    serial: string,
    signal?: AbortSignal
): Promise<MerakiDeviceDetails> => {
    console.log(`Fetching details for device ${serial}`);
    const endpoint = `/devices/${serial}`;
    
    const data = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);

    return {
        lanIp: data.lanIp,
        firmware: data.firmware,
    };
};

export const getDeviceEvents = async (
    apiKey: string,
    networkId: string,
    deviceSerial: string,
    productType: string,
    signal?: AbortSignal
): Promise<MerakiEvent[]> => {
    console.log(`Fetching up to 100 events for device ${deviceSerial} (type: ${productType}) in network ${networkId}`);
    const timespan = 3600; 
    const perPage = 100;
    
    const endpoint = `/networks/${networkId}/events?productType=${productType}&deviceSerial=${deviceSerial}&timespan=${timespan}&perPage=${perPage}`;
    
    const data = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);

    if (!data || !data.events) {
        return [];
    }

    return data.events.map((e: any) => ({
        occurredAt: e.occurredAt,
        type: e.type,
        description: e.description,
        clientDescription: e.clientDescription,
        deviceSerial: e.deviceSerial,
        deviceName: e.deviceName,
    }));
};

export const getConfigChanges = async (
    apiKey: string,
    orgId: string,
    networkId?: string,
    signal?: AbortSignal
): Promise<MerakiConfigChange[]> => {
    console.log(`Fetching config changes for network ${networkId || `organization ${orgId}`}`);
    const timespan = 3600;
    let endpoint = `/organizations/${orgId}/configurationChanges?timespan=${timespan}`;
    if (networkId) {
        endpoint += `&networkId=${networkId}`;
    }

    const data = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
    return data.map((c: any) => ({
        ts: c.ts,
        adminName: c.adminName,
        oldValue: JSON.stringify(c.oldValue),
        newValue: JSON.stringify(c.newValue),
    }));
};

export const getSwitchPortStats = async (
    apiKey: string,
    serial: string,
    portId: string,
    signal?: AbortSignal
): Promise<Record<string, MerakiSwitchPortStats[]>> => {
    const statsByPort: Record<string, MerakiSwitchPortStats[]> = {};

    const fetchStatsForPort = async (pId: string) => {
        const endpoint = `/devices/${serial}/switch/ports/${pId}/stats?timespan=3600`;
        const data = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
        return (data || []).map((stat: any) => ({
            ts: stat.ts,
            sent: stat.sent,
            received: stat.received,
        }));
    };

    const portIdsToFetch: string[] = [];

    if (portId.includes('-')) {
        const [startStr, endStr] = portId.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (isNaN(start) || isNaN(end) || start > end) {
            throw new Error(`Invalid port range: ${portId}`);
        }
        
        console.log(`Queueing stats fetch for port range ${start}-${end} on device ${serial}.`);
        for (let i = start; i <= end; i++) {
            portIdsToFetch.push(i.toString());
        }
    } else {
        console.log(`Queueing stats fetch for single port ${portId} on device ${serial}.`);
        portIdsToFetch.push(portId);
    }
    
    for (const currentPortId of portIdsToFetch) {
        if (signal?.aborted) {
            const error = new Error('The operation was aborted.');
            error.name = 'AbortError';
            throw error;
        }
        try {
            console.log(`Fetching stats for port ${currentPortId}...`);
            statsByPort[currentPortId] = await fetchStatsForPort(currentPortId);
        } catch (error) {
            console.error(`Failed to fetch stats for port ${currentPortId}:`, error);
            statsByPort[currentPortId] = [];
        }
    }
    
    return statsByPort;
};

export const getOrgVpnStatuses = async (
    apiKey: string,
    orgId: string,
    signal?: AbortSignal
): Promise<MerakiVpnStatus[]> => {
    console.log(`Fetching VPN statuses for organization ${orgId}`);
    const endpoint = `/organizations/${orgId}/appliance/vpn/statuses`;
    const data = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
    return data || [];
}

export const getNetworkL3FirewallRules = async (
    apiKey: string,
    networkId: string,
    signal?: AbortSignal
): Promise<MerakiFirewallRule[]> => {
    console.log(`Fetching L3 firewall rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/firewall/l3FirewallRules`;
    const data = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
    return data.rules || [];
}

export const updateNetworkL3FirewallRules = async (
    apiKey: string,
    networkId: string,
    rules: MerakiFirewallRule[],
    signal?: AbortSignal
): Promise<any> => {
    console.log(`Updating L3 firewall rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/firewall/l3FirewallRules`;
    const body = { rules };
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', body, signal);
}