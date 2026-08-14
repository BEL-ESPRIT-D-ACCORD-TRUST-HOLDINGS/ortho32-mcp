/**
 * ortho.fabric — Fabric plane via ORTHOServiceClient
 * cycles integer never ms
 */

import { z } from "zod";
import type { FabricOutput, CycleNumber } from "../types.js";
import { assertIsCycleCount } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const FabricInputSchema = z.object({
  operation: z.string().min(1).describe("Fabric operation, e.g. route, arbiter_step"),
  blockId: z.string().optional().describe("Hardware block ID"),
  cycles: z.number().int().nonnegative().describe("Cycle budget (integer cycles, never wall-clock ms)"),
});

export type FabricInput = z.infer<typeof FabricInputSchema>;

export async function handleFabric(
  input: FabricInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<FabricOutput> {
  caps.requireScope("fabric.execute");
  assertIsCycleCount(input.cycles, "cycles");

  const cycles = input.cycles as CycleNumber;
  const res = await client.fabric({ operation: input.operation, blockId: input.blockId, cycles });

  const output: FabricOutput = {
    success: true,
    plane: "Fabric",
    operation: input.operation,
    cycles,
    blockId: res.blockId ?? input.blockId,
    result: res.result,
  };
  return output;
}

export const fabricTool = {
  name: "ortho_fabric",
  description: "Execute fabric operation via ORTHOServiceClient (Fabric plane). cycles is integer cycles, never ms.",
  inputSchema: FabricInputSchema,
  handler: handleFabric,
};
