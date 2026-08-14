/**
 * ortho.device — Fabric plane
 * hardware.reset requires elevated scope: hardware.reset
 * default scope cannot self-escalate
 */

import { z } from "zod";
import type { DeviceOutput, CycleNumber } from "../types.js";
import { assertIsCycleCount } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const DeviceInputSchema = z.object({
  deviceId: z.string().min(1).describe("Device ID, e.g. ortho0"),
  operation: z.enum(["read", "reset"]).describe("Operation: read or reset (reset requires hardware.reset scope)"),
  cycles: z.number().int().nonnegative().optional().describe("Cycle budget for reset (integer, never ms)"),
});

export type DeviceInput = z.infer<typeof DeviceInputSchema>;

export async function handleDevice(
  input: DeviceInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<DeviceOutput> {
  if (input.operation === "reset") {
    // Elevated scope required — no self-escalation
    caps.requireHardwareReset();
    const cycles = (input.cycles ?? 1) as CycleNumber;
    assertIsCycleCount(cycles, "cycles");
    const res = await client.deviceReset({ deviceId: input.deviceId, cycles });
    const output: DeviceOutput = {
      success: res.status === "resetting" || res.status === "online",
      plane: "Fabric",
      deviceId: res.deviceId,
      status: res.status as DeviceOutput["status"],
      cycles,
      route: `ortho://hardware/device/${input.deviceId}`,
    };
    return output;
  }

  caps.requireScope("device.read");
  const res = await client.device({ deviceId: input.deviceId });
  const output: DeviceOutput = {
    success: res.status === "online",
    plane: "Fabric",
    deviceId: res.deviceId,
    status: res.status as DeviceOutput["status"],
    cycles: (res.cycles ?? 0) as CycleNumber,
    route: `ortho://hardware/device/${input.deviceId}`,
  };
  // Ensure cycles is integer
  assertIsCycleCount(output.cycles, "cycles");
  return output;
}

export const deviceTool = {
  name: "ortho_device",
  description: "Device access via ORTHOServiceClient (Fabric plane). reset requires elevated scope hardware.reset, default scope cannot self-escalate.",
  inputSchema: DeviceInputSchema,
  handler: handleDevice,
};
