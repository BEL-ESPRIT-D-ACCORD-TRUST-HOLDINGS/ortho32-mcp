/**
 * ortho.tensor — Service plane via ORTHOServiceClient
 * cycles integer never ms
 */

import { z } from "zod";
import type { TensorOutput, CycleNumber } from "../types.js";
import { assertIsCycleCount } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const TensorInputSchema = z.object({
  operation: z.string().min(1).describe("Tensor operation, e.g. matmul, conv2d"),
  shape: z.array(z.number().int().positive()).min(1).describe("Tensor shape"),
  cycles: z.number().int().nonnegative().describe("Cycle budget (integer cycles, never wall-clock ms)"),
  dtype: z.string().optional().describe("Data type"),
});

export type TensorInput = z.infer<typeof TensorInputSchema>;

export async function handleTensor(
  input: TensorInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<TensorOutput> {
  caps.requireScope("tensor.execute");
  assertIsCycleCount(input.cycles, "cycles");

  const cycles = input.cycles as CycleNumber;
  const res = await client.tensor({ operation: input.operation, shape: input.shape, cycles });

  const output: TensorOutput = {
    success: res.status === "completed" || res.status === "queued" || res.status === "running",
    plane: "Service",
    jobId: res.jobId,
    status: res.status as TensorOutput["status"],
    cycles,
    shape: input.shape,
    dtype: input.dtype,
  };
  return output;
}

export const tensorTool = {
  name: "ortho_tensor",
  description: "Dispatch tensor job via ORTHOServiceClient (Service plane). cycles is integer cycles, never ms.",
  inputSchema: TensorInputSchema,
  handler: handleTensor,
};
