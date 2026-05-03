import type { PmsConnector } from "@/lib/unified/connectors/types";

const connectors = new Map<string, PmsConnector>();

function normalizeProviderCode(providerCode: string) {
  return providerCode.trim().toLowerCase();
}

export function registerConnector(connector: PmsConnector) {
  connectors.set(normalizeProviderCode(connector.providerCode), connector);
}

export function getConnector(providerCode: string) {
  return connectors.get(normalizeProviderCode(providerCode));
}

export function getConnectorOrThrow(providerCode: string) {
  const connector = getConnector(providerCode);
  if (!connector) {
    throw new Error(`Connector not registered: ${providerCode}`);
  }
  return connector;
}

export function listRegisteredConnectors() {
  return Array.from(connectors.keys());
}
