import { MerakiDevice, MerakiEvent, MerakiConfigChange, MerakiDeviceDetails, MerakiSwitchPortStats, MerakiNetwork, MerakiVpnStatus, MerakiL3FirewallRule, MerakiOrganization, MerakiClient, SwitchPortSettings, MerakiAction, MerakiStpSettings, WirelessSsid, ClientProvisionPayload, MerakiL7FirewallRule, ContentFilteringSettings, TrafficShapingRule, SiteToSiteVpnSettings, ApplianceVlan, DeviceWirelessRadioSettings, DeviceUplink, UplinksLossAndLatency, FirmwareUpgrade, AlertSettings, HttpServer, SyslogServer, SnmpSettings, ConfigTemplate, BindNetworkPayload, OrganizationAdmin, CameraSnapshot, MotionAnalytics, SensorAlertProfile, CellularStatus, CellularUsageHistory, ApplianceUplinkSettings, NetworkTraffic, AuditLogEntry, FloorPlan, WirelessBluetoothSettings, License, LicenseOverview } from '../types';

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
      const response = await fetch(fullUrl, options);

      if (response.ok) {
          if (returnText) return response.text();
          return response.json();
      }

      // Handle rate limiting
      if (response.status === 429 && attempt < MAX_RETRIES) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
          
          const delay = retryAfterSeconds > 0 
              ? retryAfterSeconds * 1000 
              : INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
              
          console.warn(`Webex API rate limited. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
      }
      
      // Handle other errors
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const errorMessages = errorData.message ? errorData.message : `HTTP error! status: ${response.status}`;
      if (response.status === 401) throw new Error("Invalid Bot Token.");
      if (response.status === 404 && endpoint.startsWith('/messages')) throw new Error("Invalid Space ID or bot is not in the space.");
      throw new Error(`Webex API Error: ${errorMessages}`);
  }

  throw new Error(`Failed to call Webex endpoint ${endpoint} after ${MAX_RETRIES} retries.`);
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
  method: 'GET' | 'PUT' | 'POST' | 'DELETE' = 'GET',
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
      if (signal?.aborted) {
          throw new Error("Operation aborted");
      }
      
      const response = await fetch(fullUrl, options);

      // --- Success Case ---
      if (response.ok) {
          if (response.status === 204) {
              return { success: true };
          }
          return response.json();
      }

      // --- Retryable Rate Limit Error ---
      if (response.status === 429 && attempt < MAX_RETRIES) {
          const retryAfterHeader = response.headers.get('Retry-After');
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 0;
          
          // Use Retry-After if available, otherwise use exponential backoff
          const delay = retryAfterSeconds > 0 
              ? retryAfterSeconds * 1000 
              : INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
              
          console.warn(`Meraki API rate limited. Retrying attempt ${attempt + 1}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry the loop
      }

      // --- Final/Fatal Errors ---
      if (response.status === 403 && fullUrl.includes('cors-anywhere')) {
          throw new Error(
              `Request was blocked by the public CORS proxy. This is common. Please visit ${PROXY_URL}, click the 'Request temporary access' button, and then try connecting again.`
          );
      }
      
      const errorData = await response.json().catch(() => ({}));
      const errorMessages = errorData.errors ? errorData.errors.join(', ') : `HTTP error! status: ${response.status}`;
      throw new Error(errorMessages);
  }

  throw new Error(`Failed to fetch ${endpoint} after ${MAX_RETRIES + 1} attempts.`);
};

export const getOrganizations = async (
  apiKey: string
): Promise<MerakiOrganization[]> => {
  console.log('Fetching Meraki organizations');
  return await fetchWithMerakiApi(apiKey, '/organizations');
};

export const getNetworkDevices = async (
  apiKey: string,
  networkId: string,
): Promise<MerakiDevice[]> => {
  console.log(`Fetching devices for network ${networkId}`);
  const devices = await fetchWithMerakiApi(apiKey, `/networks/${networkId}/devices`);
  return (devices || []).map((d: any) => ({
    serial: d.serial,
    name: d.name || 'Unnamed Device',
    model: d.model,
    networkId: d.networkId,
    lanIp: d.lanIp,
  }));
};

export const getOrgNetworks = async (
  apiKey: string,
  orgId: string,
  tags?: string[]
): Promise<MerakiNetwork[]> => {
  console.log(`Fetching networks for organization: ${orgId}`);
  let endpoint = `/organizations/${orgId}/networks`;
  if (tags && tags.length > 0) {
      const tagsQuery = tags.map(tag => `tags[]=${encodeURIComponent(tag)}`).join('&');
      endpoint += `?${tagsQuery}&perPage=1000`; // Increase page size for tags
  }
  const networks = await fetchWithMerakiApi(apiKey, endpoint);
  if (!networks || !Array.isArray(networks) || networks.length === 0) {
    return [];
  }
  return networks.map((n: any) => ({
      id: n.id,
      name: n.name,
      organizationId: n.organizationId,
      tags: n.tags,
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
  orgId: string,
  name?: string
): Promise<MerakiDevice[]> => {
  console.log(`Fetching all organization devices and statuses for orgId: ${orgId}`);

  let devicesEndpoint = `/organizations/${orgId}/devices?perPage=1000`;
  if (name) {
      devicesEndpoint += `&name=${encodeURIComponent(name)}`;
  }

  // Fetch devices and statuses sequentially to reduce API burst rate
  const allDevices = await fetchWithMerakiApi(apiKey, devicesEndpoint).catch(e => {
      console.error('Fatal: Could not fetch organization devices.', e);
      throw e;
  });

  const statuses = await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/devices/statuses?perPage=1000`).catch(e => {
    console.error('Could not fetch device statuses, proceeding without them.', e);
    return [];
  });
  

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
      lanIp: device.lanIp,
  }));
  
  console.log(`Total devices found: ${formattedDevices.length}`);
  return formattedDevices;
};

export const getNetworkClients = async (
  apiKey: string,
  networkId: string,
  timespan: number = 86400,
  signal?: AbortSignal
): Promise<MerakiClient[]> => {
    console.log(`Fetching clients for network ${networkId} with timespan ${timespan}s`);
    const endpoint = `/networks/${networkId}/clients?timespan=${timespan}&perPage=1000`;
    const clients = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
    return (clients || []).map((c: any) => ({
        id: c.id,
        description: c.description,
        mac: c.mac,
        ip: c.ip,
        usage: c.usage,
        status: c.status,
    }));
};

export const cycleSwitchPort = async (
  apiKey: string,
  serial: string,
  portId: string,
  signal?: AbortSignal
): Promise<any> => {
    console.log(`Cycling port(s) ${portId} on device ${serial}`);
    const portIdsToCycle: string[] = [];
    if (portId.includes('-')) {
        const [start, end] = portId.split('-').map(Number);
        for (let i = start; i <= end; i++) portIdsToCycle.push(i.toString());
    } else {
        portIdsToCycle.push(portId);
    }
    const results = [];
    for (const pId of portIdsToCycle) {
        if (signal?.aborted) throw new Error("Operation aborted");
        const endpoint = `/devices/${serial}/switch/ports/${pId}/cycle`;
        const result = await fetchWithMerakiApi(apiKey, endpoint, 'POST', {}, signal);
        results.push({ portId: pId, ...result });
    }
    return results;
}

export const createActionBatch = async (
  apiKey: string,
  orgId: string,
  actions: MerakiAction[],
  synchronous: boolean = false,
  signal?: AbortSignal
): Promise<any> => {
    console.log(`Creating action batch for org ${orgId}`);
    const endpoint = `/organizations/${orgId}/actionBatches`;
    const body = { actions, confirmed: true, synchronous };
    return await fetchWithMerakiApi(apiKey, endpoint, 'POST', body, signal);
}

export const updateNetworkStpSettings = async (
  apiKey: string,
  networkId: string,
  settings: MerakiStpSettings,
  signal?: AbortSignal
): Promise<any> => {
    console.log(`Updating STP settings for network ${networkId}`);
    const endpoint = `/networks/${networkId}/switch/settings/stp`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', settings, signal);
};

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
    if (settings.isolationEnabled !== undefined) body.isolationEnabled = settings.isolationEnabled;
    if (settings.macAllowList !== undefined) body.macAllowList = settings.macAllowList;
    if (settings.stickyMacAllowList !== undefined) body.stickyMacAllowList = settings.stickyMacAllowList;
    if (settings.stickyMacAllowListLimit !== undefined) body.stickyMacAllowListLimit = settings.stickyMacAllowListLimit;

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

// --- New Wireless (MR) Functions ---

export const getNetworkSsids = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<WirelessSsid[]> => {
    console.log(`Fetching SSIDs for network ${networkId}`);
    const endpoint = `/networks/${networkId}/wireless/ssids`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkSsid = async (apiKey: string, networkId: string, ssidNumber: number, settings: Partial<WirelessSsid>, signal?: AbortSignal): Promise<WirelessSsid> => {
    console.log(`Updating SSID ${ssidNumber} for network ${networkId}`);
    const endpoint = `/networks/${networkId}/wireless/ssids/${ssidNumber}`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', settings, signal);
};

export const updateDeviceWirelessRadioSettings = async (apiKey: string, serial: string, settings: DeviceWirelessRadioSettings, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating radio settings for device ${serial}`);
    const endpoint = `/devices/${serial}/wireless/radio/settings`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', settings, signal);
};

export const provisionNetworkClients = async (apiKey: string, networkId: string, payload: ClientProvisionPayload, signal?: AbortSignal): Promise<any> => {
    console.log(`Provisioning clients in network ${networkId}`);
    const endpoint = `/networks/${networkId}/clients/provision`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'POST', payload, signal);
};

// --- New Security & SD-WAN (MX) Functions ---

export const getNetworkL3FirewallRules = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<MerakiL3FirewallRule[]> => {
    console.log(`Fetching L3 firewall rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/firewall/l3FirewallRules`;
    const data = await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
    return data.rules || [];
};

export const updateNetworkL3FirewallRules = async (apiKey: string, networkId: string, rules: MerakiL3FirewallRule[], signal?: AbortSignal): Promise<any> => {
    console.log(`Updating L3 firewall rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/firewall/l3FirewallRules`;
    const body = { rules };
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', body, signal);
};

export const getNetworkL7FirewallRules = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<{ rules: MerakiL7FirewallRule[] }> => {
    console.log(`Fetching L7 firewall rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/firewall/l7FirewallRules`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkL7FirewallRules = async (apiKey: string, networkId: string, rules: MerakiL7FirewallRule[], signal?: AbortSignal): Promise<any> => {
    console.log(`Updating L7 firewall rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/firewall/l7FirewallRules`;
    const body = { rules };
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', body, signal);
};

export const getNetworkContentFiltering = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<ContentFilteringSettings> => {
    console.log(`Fetching content filtering settings for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/contentFiltering`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkContentFiltering = async (apiKey: string, networkId: string, settings: ContentFilteringSettings, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating content filtering for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/contentFiltering`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', settings, signal);
};

export const getNetworkTrafficShapingRules = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<{ rules: TrafficShapingRule[] }> => {
    console.log(`Fetching traffic shaping rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/trafficShaping/rules`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkTrafficShapingRules = async (apiKey: string, networkId: string, rules: TrafficShapingRule[], signal?: AbortSignal): Promise<any> => {
    console.log(`Updating traffic shaping rules for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/trafficShaping/rules`;
    const body = { rules };
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', body, signal);
};

export const getNetworkSiteToSiteVpn = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<SiteToSiteVpnSettings> => {
    console.log(`Fetching site-to-site VPN settings for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/vpn/siteToSiteVpn`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkSiteToSiteVpn = async (apiKey: string, networkId: string, settings: SiteToSiteVpnSettings, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating site-to-site VPN for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/vpn/siteToSiteVpn`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', settings, signal);
};

export const getNetworkApplianceVlans = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<ApplianceVlan[]> => {
    console.log(`Fetching appliance VLANs for network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/vlans`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const createNetworkApplianceVlan = async (apiKey: string, networkId: string, vlan: ApplianceVlan, signal?: AbortSignal): Promise<any> => {
    console.log(`Creating appliance VLAN in network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/vlans`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'POST', vlan, signal);
};

export const updateNetworkApplianceVlan = async (apiKey: string, networkId: string, vlanId: string, vlan: Partial<ApplianceVlan>, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating appliance VLAN ${vlanId} in network ${networkId}`);
    const endpoint = `/networks/${networkId}/appliance/vlans/${vlanId}`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', vlan, signal);
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
};

// --- New Operations, Health, and Maintenance Functions ---

export const getDeviceUplink = async (apiKey: string, serial: string, signal?: AbortSignal): Promise<DeviceUplink[]> => {
    console.log(`Fetching uplink status for device ${serial}`);
    const endpoint = `/devices/${serial}/uplink`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const getOrgUplinksLossAndLatency = async (apiKey: string, orgId: string, ip: string, timespan?: number, signal?: AbortSignal): Promise<UplinksLossAndLatency[]> => {
    console.log(`Fetching uplink loss and latency for org ${orgId}`);
    let endpoint = `/organizations/${orgId}/devices/uplinksLossAndLatency?ip=${ip}`;
    if (timespan) endpoint += `&timespan=${timespan}`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const rebootDevice = async (apiKey: string, serial: string, signal?: AbortSignal): Promise<any> => {
    console.log(`Rebooting device ${serial}`);
    const endpoint = `/devices/${serial}/reboot`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'POST', {}, signal);
};

export const blinkDeviceLeds = async (apiKey: string, serial: string, duration: number, signal?: AbortSignal): Promise<any> => {
    console.log(`Blinking LEDs for device ${serial}`);
    const endpoint = `/devices/${serial}/blinkLeds`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'POST', { duration }, signal);
};

export const getNetworkFirmwareUpgrades = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<FirmwareUpgrade> => {
    console.log(`Fetching firmware upgrades for network ${networkId}`);
    const endpoint = `/networks/${networkId}/firmwareUpgrades`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkFirmwareUpgrades = async (apiKey: string, networkId: string, payload: FirmwareUpgrade, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating firmware upgrades for network ${networkId}`);
    const endpoint = `/networks/${networkId}/firmwareUpgrades`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', payload, signal);
};

export const getNetworkAlertSettings = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<AlertSettings> => {
    console.log(`Fetching alert settings for network ${networkId}`);
    const endpoint = `/networks/${networkId}/alerts/settings`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkAlertSettings = async (apiKey: string, networkId: string, settings: AlertSettings, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating alert settings for network ${networkId}`);
    const endpoint = `/networks/${networkId}/alerts/settings`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', settings, signal);
};

export const getOrgHttpServers = async (apiKey: string, orgId: string, signal?: AbortSignal): Promise<HttpServer[]> => {
    console.log(`Fetching HTTP servers for org ${orgId}`);
    const endpoint = `/organizations/${orgId}/webhooks/httpServers`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const getNetworkSyslogServers = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<{ servers: SyslogServer[] }> => {
    console.log(`Fetching syslog servers for network ${networkId}`);
    const endpoint = `/networks/${networkId}/syslogServers`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateNetworkSyslogServers = async (apiKey: string, networkId: string, servers: SyslogServer[], signal?: AbortSignal): Promise<any> => {
    console.log(`Updating syslog servers for network ${networkId}`);
    const endpoint = `/networks/${networkId}/syslogServers`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', { servers }, signal);
};

export const getOrgSnmpSettings = async (apiKey: string, orgId: string, signal?: AbortSignal): Promise<SnmpSettings> => {
    console.log(`Fetching SNMP settings for org ${orgId}`);
    const endpoint = `/organizations/${orgId}/snmp`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const updateOrgSnmpSettings = async (apiKey: string, orgId: string, settings: SnmpSettings, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating SNMP settings for org ${orgId}`);
    const endpoint = `/organizations/${orgId}/snmp`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'PUT', settings, signal);
};

// --- New Templates and Scale Functions ---

export const getOrgConfigTemplates = async (apiKey: string, orgId: string, signal?: AbortSignal): Promise<ConfigTemplate[]> => {
    console.log(`Fetching config templates for org ${orgId}`);
    const endpoint = `/organizations/${orgId}/configTemplates`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'GET', null, signal);
};

export const bindNetworkToTemplate = async (apiKey: string, networkId: string, payload: BindNetworkPayload, signal?: AbortSignal): Promise<any> => {
    console.log(`Binding network ${networkId} to template ${payload.configTemplateId}`);
    const endpoint = `/networks/${networkId}/bind`;
    return await fetchWithMerakiApi(apiKey, endpoint, 'POST', payload, signal);
};

// --- New Security and Access Functions ---
export const getOrgAdmins = async (apiKey: string, orgId: string, signal?: AbortSignal): Promise<OrganizationAdmin[]> => {
    console.log(`Fetching admins for org ${orgId}`);
    return await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/admins`, 'GET', null, signal);
};

export const createOrgAdmin = async (apiKey: string, orgId: string, admin: OrganizationAdmin, signal?: AbortSignal): Promise<any> => {
    console.log(`Creating admin in org ${orgId}`);
    return await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/admins`, 'POST', admin, signal);
};

export const updateOrgAdmin = async (apiKey: string, orgId: string, adminId: string, admin: Partial<OrganizationAdmin>, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating admin ${adminId} in org ${orgId}`);
    return await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/admins/${adminId}`, 'PUT', admin, signal);
};

export const deleteOrgAdmin = async (apiKey: string, orgId: string, adminId: string, signal?: AbortSignal): Promise<any> => {
    console.log(`Deleting admin ${adminId} from org ${orgId}`);
    return await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/admins/${adminId}`, 'DELETE', null, signal);
};


// --- New Camera (MV) and Sensor (MT) Functions ---
export const generateCameraSnapshot = async (apiKey: string, serial: string, timestamp?: string, signal?: AbortSignal): Promise<CameraSnapshot> => {
    console.log(`Generating snapshot for camera ${serial}`);
    const body = timestamp ? { timestamp } : {};
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/camera/generateSnapshot`, 'POST', body, signal);
};

export const getCameraMotionAnalytics = async (apiKey: string, serial: string, timespan: number, signal?: AbortSignal): Promise<MotionAnalytics[]> => {
    console.log(`Fetching motion analytics for camera ${serial}`);
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/camera/analytics/motion?timespan=${timespan}`, 'GET', null, signal);
};

export const getSensorAlerts = async (apiKey: string, serial: string, signal?: AbortSignal): Promise<SensorAlertProfile[]> => {
    console.log(`Fetching sensor alerts for device ${serial}`);
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/sensor/alerts`, 'GET', null, signal);
};

export const updateSensorAlerts = async (apiKey: string, serial: string, profiles: SensorAlertProfile[], signal?: AbortSignal): Promise<any> => {
    console.log(`Updating sensor alerts for device ${serial}`);
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/sensor/alerts`, 'PUT', { profiles }, signal);
};


// --- New WAN/Cellular (MG) Functions ---
export const getCellularStatus = async (apiKey: string, serial: string, signal?: AbortSignal): Promise<CellularStatus> => {
    console.log(`Fetching cellular status for MG ${serial}`);
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/cellular/status`, 'GET', null, signal);
};

export const getCellularUsageHistory = async (apiKey: string, serial: string, timespan: number, signal?: AbortSignal): Promise<CellularUsageHistory[]> => {
    console.log(`Fetching cellular usage for MG ${serial}`);
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/cellular/usageHistory?timespan=${timespan}`, 'GET', null, signal);
};

export const getApplianceUplinkSettings = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<ApplianceUplinkSettings> => {
    console.log(`Fetching uplink settings for network ${networkId}`);
    return await fetchWithMerakiApi(apiKey, `/networks/${networkId}/appliance/uplinks/settings`, 'GET', null, signal);
};

export const updateApplianceUplinkSettings = async (apiKey: string, networkId: string, settings: ApplianceUplinkSettings, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating uplink settings for network ${networkId}`);
    return await fetchWithMerakiApi(apiKey, `/networks/${networkId}/appliance/uplinks/settings`, 'PUT', settings, signal);
};


// --- New Advanced Analytics and Reporting Functions ---
export const getNetworkTraffic = async (apiKey: string, networkId: string, timespan: number, signal?: AbortSignal): Promise<NetworkTraffic[]> => {
    console.log(`Fetching network traffic for network ${networkId}`);
    return await fetchWithMerakiApi(apiKey, `/networks/${networkId}/traffic?timespan=${timespan}`, 'GET', null, signal);
};

export const getOrgAuditLogs = async (apiKey: string, orgId: string, timespan: number, signal?: AbortSignal): Promise<AuditLogEntry[]> => {
    console.log(`Fetching audit logs for org ${orgId}`);
    return await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/auditLog?timespan=${timespan}`, 'GET', null, signal);
};


// --- New Location and Maps Functions ---
export const getNetworkFloorPlans = async (apiKey: string, networkId: string, signal?: AbortSignal): Promise<FloorPlan[]> => {
    console.log(`Fetching floor plans for network ${networkId}`);
    return await fetchWithMerakiApi(apiKey, `/networks/${networkId}/floorPlans`, 'GET', null, signal);
};

export const getWirelessBluetoothSettings = async (apiKey: string, serial: string, signal?: AbortSignal): Promise<WirelessBluetoothSettings> => {
    console.log(`Fetching bluetooth settings for device ${serial}`);
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/wireless/bluetooth/settings`, 'GET', null, signal);
};

export const updateWirelessBluetoothSettings = async (apiKey: string, serial: string, settings: WirelessBluetoothSettings, signal?: AbortSignal): Promise<any> => {
    console.log(`Updating bluetooth settings for device ${serial}`);
    return await fetchWithMerakiApi(apiKey, `/devices/${serial}/wireless/bluetooth/settings`, 'PUT', settings, signal);
};


// --- New Licensing and Compliance Functions ---
export const getOrgLicenses = async (apiKey: string, orgId: string, signal?: AbortSignal): Promise<License[]> => {
    console.log(`Fetching licenses for org ${orgId}`);
    return await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/licenses`, 'GET', null, signal);
};

export const getOrgLicenseOverview = async (apiKey: string, orgId: string, signal?: AbortSignal): Promise<LicenseOverview> => {
    console.log(`Fetching license overview for org ${orgId}`);
    return await fetchWithMerakiApi(apiKey, `/organizations/${orgId}/licenses/overview`, 'GET', null, signal);
};