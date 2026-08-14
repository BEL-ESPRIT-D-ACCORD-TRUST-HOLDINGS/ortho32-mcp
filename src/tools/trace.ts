/**
 * ortho.trace — cycleNumber and cycles are integer cycles, never wall-clock ms
 */

import { z } from "zod";
import type { TraceOutput, CycleNumber } from "../types.js";
import { assertIsCycleNumber, assertIsCycleCount } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const TraceInputSchema = z.object({
  cycleNumber: z.number().int().nonnegative().describe("Cycle number to inspect (integer, never wall-clock ms)"),
  cycles: z.number().int().nonnegative().default(1).describe("Window size in cycles (integer, never ms)"),
});

export type TraceInput = z.infer<typeof TraceInputSchema>;

export async function handleTrace(
  input: TraceInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<TraceOutput> {
  caps.requireScope("trace.read");
  assertIsCycleNumber(input.cycleNumber, "cycleNumber");
  assertIsCycleCount(input.cycles, "cycles");

  const cycleNumber = input.cycleNumber as CycleNumber;
  const cycles = input.cycles as CycleNumber;

  const res = await client.trace({ cycleNumber, cycles });

  const output: TraceOutput = {
    success: true,
    plane: "Fabric",
    cycleNumber,
    cycles,
    signals: res.signals,
    vcdPath: res.vcdPath,
    route: `ortho://trace/cycle/${cycleNumber}`,
  };
  return output;
}

export const traceTool = {
  name: "ortho_trace",
  description: "Fetch waveform trace at cycleNumber via ORTHOServiceClient (Fabric plane). cycleNumber/cycles are integer cycles, never ms.",
  inputSchema: TraceInputSchema,
  handler: handleTrace,
};
