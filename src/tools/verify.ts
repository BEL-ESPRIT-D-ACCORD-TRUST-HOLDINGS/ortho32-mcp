/**
 * ortho.verify_theorem — status comes ONLY from actual checker output, never string inference
 * cycles: integer never ms
 */

import { z } from "zod";
import type { VerifyOutput, CycleNumber } from "../types.js";
import { assertIsCycleCount, checkerStatusFromOutput } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const VerifyInputSchema = z.object({
  theorem: z.string().min(1).describe("Theorem name, e.g. rtl_deterministic"),
  cycles: z.number().int().nonnegative().describe("Cycle budget (integer cycles, never wall-clock ms)"),
});

export type VerifyInput = z.infer<typeof VerifyInputSchema>;

export async function handleVerify(
  input: VerifyInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<VerifyOutput> {
  caps.requireScope("verify.execute");
  assertIsCycleCount(input.cycles, "cycles");

  const cycles = input.cycles as CycleNumber;

  // Actual checker output — sole source of truth
  const checkerOutput = await client.verifyTheorem({ theorem: input.theorem, cycles });

  // CRITICAL: status comes only from checkerOutput.status, never string inference
  const status = checkerStatusFromOutput(checkerOutput);

  const output: VerifyOutput = {
    success: status === "proved",
    plane: "Service",
    theorem: input.theorem,
    status,
    checkerOutput,
    cycles,
  };
  return output;
}

export const verifyTool = {
  name: "ortho_verify_theorem",
  description:
    "Verify theorem via checker. Status is taken ONLY from checker output (proved/failed/unknown/timeout/error), never inferred from strings. Cycles is integer cycles.",
  inputSchema: VerifyInputSchema,
  handler: handleVerify,
};
