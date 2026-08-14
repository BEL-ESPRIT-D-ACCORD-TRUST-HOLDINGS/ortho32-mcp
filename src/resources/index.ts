/**
 * MCP Resources — expose ORTHO routes as resources
 * Workspace stores routes not UI objects.
 */

import type { ORTHOServiceClient } from "../protocol/client.js";

export interface ResourceDefinition {
  uri: string;
  name: string;
  mimeType: string;
  description: string;
}

export const orthoResources: ResourceDefinition[] = [
  {
    uri: "ortho://proof/rtl_deterministic",
    name: "Proof: rtl_deterministic",
    mimeType: "application/x-lean",
    description: "Determinism proof for RTL fabric",
  },
  {
    uri: "ortho://trace/cycle/420",
    name: "Trace cycle 420",
    mimeType: "application/json",
    description: "Waveform trace at cycle 420 (integer cycles, never ms)",
  },
  {
    uri: "ortho://hardware/device/ortho0",
    name: "Hardware device ortho0",
    mimeType: "application/json",
    description: "Fabric device ortho0 status",
  },
  {
    uri: "ortho://workspace/fabric",
    name: "Workspace fabric",
    mimeType: "application/json",
    description: "Workspace routes for fabric",
  },
];

export async function readResource(uri: string, client: ORTHOServiceClient): Promise<{ contents: { uri: string; mimeType: string; text: string }[] }> {
  // Route through ORTHOServiceClient — CLIENT not backend
  if (uri.startsWith("ortho://trace/cycle/")) {
    const n = Number(uri.split("/").pop());
    if (!Number.isInteger(n)) throw new Error(`cycleNumber must be integer cycles, never ms. Got: ${n}`);
    const res = await client.trace({ cycleNumber: n, cycles: 1 });
    return {
      contents: [{ uri, mimeType: "application/json", text: JSON.stringify(res, null, 2) }],
    };
  }
  if (uri.startsWith("ortho://hardware/device/")) {
    const deviceId = uri.split("/").pop()!;
    const res = await client.device({ deviceId });
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(res, null, 2) }] };
  }
  if (uri.startsWith("ortho://proof/")) {
    const proof = uri.split("/").pop()!;
    const res = await client.verifyTheorem({ theorem: proof, cycles: 1000 });
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(res, null, 2) }] };
  }
  throw new Error(`Unknown resource: ${uri}`);
}

export function listResources(): ResourceDefinition[] {
  return orthoResources;
}
