export enum Sender {
  User = 'user',
  AI = 'ai',
  System = 'system',
  Webex = 'webex',
}

export interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  timestamp: string;
  userId?: number;
  networkId?: number;
  personEmail?: string; // For Webex messages
}

export interface MerakiOrganization {
  id: string;
  name: string;
}

export interface MerakiClient {
  id: string;
  description: string | null;
  mac: string;
  ip: string;
  usage: {
    sent: number;
    recv: number;
  };
  status: 'Online' | 'Offline';
}

export interface ClientProvisionPayload {
    macs: string[];
    devicePolicy: 'Allowed' | 'Blocked' | 'Normal';
    timespan?: number; // In seconds, for temporary policies
}

export interface MerakiAction {
    resource: string;
    operation: string;
    body?: any;
}

export interface MerakiActionBatch {
    id: string;
    organizationId: string;
    status: {
        completed: boolean;
        failed: boolean;
        errors: string[];
    };
    actions: MerakiAction[];
}

export interface MerakiDevice {
  serial: string;
  name: string;
  model: string;
  networkId: string;
  status?: string; // e.g., 'online', 'offline', 'alerting'
  lanIp?: string;
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
    geminiApiKey?: string;
    webexBotToken?: string;
    webexSpaceId?: string;
    webexVerified?: boolean; // To confirm the integration is working
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
    linkNegotiation?: 'Auto negotiate' | '10 Megabit half duplex' | '10 Megabit full duplex' | '100 Megabit half duplex' | '100 Megabit full duplex';
    // Port security fields
    isolationEnabled?: boolean;
    stickyMacAllowList?: string[];
    stickyMacAllowListLimit?: number;
    macAllowList?: string[];
}

export interface MerakiNetwork {
  id: string;
  name: string;
  organizationId: string;
  tags?: string[];
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

export interface MerakiL3FirewallRule {
  comment: string;
  policy: 'allow' | 'deny';
  protocol: 'tcp' | 'udp' | 'icmp' | 'any';
  destPort: string | null;
  destCidr: string;
  srcPort: string | null;
  srcCidr: string;
  syslogEnabled: boolean;
}

export interface MerakiStpSettings {
    rstpEnabled?: boolean;
    stpdBridgePriority?: {
        switchProfileIds?: string[];
        switches?: string[];
        priority: number;
    }[];
}

// --- Wireless (MR) Types ---
export interface RadiusServer {
    host: string;
    port: number;
    secret?: string; // Secret is write-only
}

export interface WirelessSsid {
    number: number;
    name: string;
    enabled: boolean;
    authMode: 'open' | 'psk' | 'open-with-radius' | '8021x-meraki' | '8021x-radius' | 'ipsk-with-radius' | 'ipsk-without-radius';
    encryptionMode?: 'wep' | 'wpa';
    psk?: string;
    vlanId?: number;
    radiusServers?: RadiusServer[];
    splashPage?: 'None' | 'Click-through splash page' | 'Billing' | 'Password-protected with Meraki RADIUS' | 'Password-protected with custom RADIUS' | 'Password-protected with Active Directory' | 'Password-protected with LDAP' | 'SMS authentication' | 'Systems Manager Sentry' | 'Facebook Wi-Fi' | 'Google OAuth' | 'Sponsored guest';
}

export interface DeviceWirelessRadioSettings {
    twoFourGhzSettings?: {
        channel?: number;
        targetPower?: number;
    };
    fiveGhzSettings?: {
        channel?: number;
        targetPower?: number;
    };
}

// --- Security & SD-WAN (MX) Types ---
export interface MerakiL7FirewallRule {
    policy: 'deny';
    type: 'application' | 'applicationCategory' | 'host' | 'port' | 'ipRange';
    value: string | { id: string };
}

export interface ContentFilteringSettings {
    allowedUrlPatterns?: string[];
    blockedUrlPatterns?: string[];
    blockedUrlCategories?: string[];
}

export interface TrafficShapingRule {
    definitions: { type: 'application' | 'applicationCategory' | 'host' | 'port' | 'ipRange', value: string }[];
    perClientBandwidthLimits?: {
        settings: 'ignore' | 'custom',
        bandwidthLimits?: { limitUp: number, limitDown: number }
    };
    dscpTagValue?: number;
    priority?: 'high' | 'normal' | 'low';
}

export interface SiteToSiteVpnSettings {
    mode: 'none' | 'spoke' | 'hub';
    hubs?: { hubId: string, useDefaultRoute: boolean }[];
    subnets?: { localSubnet: string, useVpn: boolean }[];
}

export interface ApplianceVlan {
    id: string; // The VLAN ID
    name: string;
    subnet: string;
    applianceIp: string;
    groupPolicyId?: string;
}

// --- Operations, Health, and Maintenance Types ---
export interface DeviceUplink {
    interface: string;
    status: 'active' | 'ready' | 'failed' | 'not connected';
    ip?: string;
    gateway?: string;
    publicIp?: string;
    dns?: string[];
    usingStaticIp?: boolean;
}

export interface UplinksLossAndLatency {
    networkId: string;
    serial: string;
    uplink: string;
    ip: string;
    timeSeries: {
        ts: string;
        lossPercent: number;
        latencyMs: number;
    }[];
}

export interface FirmwareUpgrade {
    products?: {
        [key: string]: { // e.g., 'switch', 'appliance'
            currentVersion?: { id: string; shortName: string };
            lastUpgrade?: { fromVersion: { id: string }; toVersion: { id: string }; time: string };
            nextUpgrade?: { toVersion: { id: string }; time: string };
            availableVersions?: { id: string; shortName: string; releaseType: string }[];
        };
    };
    timezone?: string;
    upgradeWindow?: { dayOfWeek: string; hourOfDay: string };
}

export interface AlertSettings {
    defaultDestinations: {
        emails: string[];
        allAdmins: boolean;
        snmp: boolean;
        httpServerIds: string[];
    };
    alerts: {
        type: string;
        enabled: boolean;
        alertDestinations: { emails: string[]; allAdmins: boolean; snmp: boolean; httpServerIds: string[] };
        filters: any; // Can be complex, using 'any' for simplicity
    }[];
}

export interface HttpServer {
    id: string;
    name: string;
    url: string;
    sharedSecret?: string;
}

export interface SyslogServer {
    host: string;
    port: number;
    roles: string[];
}

export interface SnmpSettings {
    v2cEnabled?: boolean;
    v3Enabled?: boolean;
    v3AuthMode?: 'MD5' | 'SHA';
    v3PrivMode?: 'DES' | 'AES128';
    peerIps?: string[];
    users?: { username: string; authPassphrase?: string; privPassphrase?: string }[];
}

// --- Templates and Scale Types ---
export interface ConfigTemplate {
    id: string;
    name: string;
    timeZone?: string;
}

export interface BindNetworkPayload {
    configTemplateId: string;
    autoBind: boolean;
}

// --- Security and Access Types ---
export interface OrganizationAdmin {
    id?: string;
    name: string;
    email: string;
    orgAccess: 'full' | 'read-only' | 'none';
    networks?: { id: string; access: string }[];
    tags?: { tag: string; access: string }[];
}

// --- Camera (MV) and Sensor (MT) Types ---
export interface CameraSnapshot {
    url?: string;
    expiry?: string;
    error?: string; // Meraki API returns an error in the body on failure
}

export interface MotionAnalytics {
    ts: string;
    // Other properties based on what Meraki returns for motion analytics
}

export interface SensorAlertProfile {
    // Properties for sensor alert profiles
    // e.g., metric: 'temperature', threshold: { above: 28 }, recipients: string[]
}

// --- WAN/Cellular (MG) Types ---
export interface CellularStatus {
    // Properties for cellular modem status
}

export interface CellularUsageHistory {
    ts: string;
    sent: number;
    received: number;
}

export interface ApplianceUplinkSettings {
    interfaces: {
        wan1?: { enabled: boolean, uplinkSelection: any };
        wan2?: { enabled: boolean, uplinkSelection: any };
        cellular?: { enabled: boolean, uplinkSelection: any };
    }
}

// --- Advanced Analytics and Reporting Types ---
export interface NetworkTraffic {
    application: string;
    destination: string;
    protocol: string;
    port: number;
    sent: number;
    recv: number;
    numClients: number;
}

export interface AuditLogEntry {
    ts: string;
    adminId: string;
    adminName: string;
    adminEmail: string;
    message: string;
    eventData: any;
}

// --- Location and Maps Types ---
export interface FloorPlan {
    floorPlanId: string;
    name: string;
    // other properties from the API
}

export interface WirelessBluetoothSettings {
    scanningEnabled?: boolean;
    advertisingEnabled?: boolean;
    major?: number;
    minor?: number;
    uuid?: string;
}

// --- Licensing and Compliance Types ---
export interface License {
    id: string;
    key: string;
    activationDate: string;
    expirationDate: string;
    status: 'OK' | 'Expired' | 'Unused' | 'Recently Expired';
    // other properties
}

export interface LicenseOverview {
    status: 'OK' | 'Warning' | 'Error';
    expirationDate: string;
    licensedDeviceCounts: Record<string, number>;
}