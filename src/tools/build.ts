/**
 * ortho.build — CLIENT tool via ORTHOServiceClient
 * cycles: number (integer) NEVER wall-clock ms
 */

import { z } from "zod";
import type { BuildOutput, CycleNumber } from "../types.js";
import { assertIsCycleCount } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const BuildInputSchema = z.object({
  target: z.string().min(1).describe("Build target, e.g. org.ortho.terminal"),
  cycles: z.number().int().nonnegative().describe("Cycle budget (integer cycles, never wall-clock ms)"),
});

export type BuildInput = z.infer<typeof BuildInputSchema>;

export async function handleBuild(
  input: BuildInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<BuildOutput> {
  caps.requireScope("build.execute");
  assertIsCycleCount(input.cycles, "cycles");

  const cycles = input.cycles as CycleNumber;
  const res = await client.build({ target: input.target, cycles });

  const output: BuildOutput = {
    success: res.status === "succeeded" || res.status === "building" || res.status === "queued",
    plane: "Service",
    buildId: res.buildId,
    status: res.status as BuildOutput["status"],
    cycles,
    logs: res.logs,
  };
  return output;
}

export const buildTool = {
  name: "ortho_build",
  description: "Build an ORTHO target via ORTHOServiceClient (Service plane). cycles is integer cycle budget, never ms.",
  inputSchema: BuildInputSchema,
  handler: handleBuild,
};
