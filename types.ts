
export enum Sender {
  User = 'user',
  AI = 'ai',
  System = 'system',
  // Fix: Add Webex to Sender enum to support Webex integration in the backend.
  Webex = 'webex',
}

export interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  timestamp: string;
  // Scoping for DB
  userId?: number;
  networkId?: number;
  personEmail?: string; // For Webex messages
}

export interface MerakiDevice {
  serial: string;
  name: string;
  model: string;
  networkId: string;
  status?: string; // e.g., 'online', 'offline', 'alerting'
}

export interface MerakiDeviceDetails {
  lanIp?: string;
  firmware?: string;
}

export interface User {
    id: number;
    username: string;
}

export interface NetworkConfiguration {
    id?: number; // Optional because it's set by the DB on creation
    userId: number;
    name: string;
    apiKey: string;
    orgId: string;
    // Fix: Add optional properties for backend integrations like Webex and Teams.
    webexBotToken?: string;
    webexSpaceId?: string;
    webexVerified?: boolean; // To confirm the integration is working
    // FIX: Add webexWebhookUrl for backend server integration.
    webexWebhookUrl?: string;
    teamsWebhookUrl?: string;
}

export interface MerakiEvent {
  occurredAt: string;
  type: string;
  description: string;
  clientDescription?: string;
  deviceSerial: string;
  deviceName: string;
}

export interface MerakiConfigChange {
  ts: string;
  adminName: string;
  oldValue: string;
  newValue: string;
}

export interface MerakiSwitchPortStats {
  ts: string;
  sent: number;
  received: number;
}

export interface MerakiNetwork {
  id: string;
  name: string;
  organizationId: string;
}

export interface DefaultTemplate {
    id?: number;
    userId: number;
    name: string;
    portRange: string;
    settings: {
        name?: string;
        enabled?: boolean;
        type?: 'access' | 'trunk';
        vlan?: number;
        voiceVlan?: number | null;
        poeEnabled?: boolean;
        stpGuard?: 'disabled' | 'root guard' | 'bpdu guard' | 'loop guard';
    };
}

export interface MerakiVpnStatus {
  networkName: string;
  networkId: string;
  deviceStatus: string;
  uplinks: {
    interface: string;
    publicIp: string;
    status: string;
  }[];
  vpnMode: string;
  peers: {
    networkName: string;
    networkId: string;
    reachability: string;
    status: string;
  }[];
}

export interface MerakiFirewallRule {
  comment: string;
  policy: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  destPort: string | null;
  destCidr: string;
  srcPort: string | null;
  srcCidr: string;
  syslogEnabled: boolean;
}