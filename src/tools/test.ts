/**
 * ortho.test — CLIENT tool via ORTHOServiceClient
 * cycles: number (integer) NEVER wall-clock ms
 */

import { z } from "zod";
import type { TestOutput, CycleNumber } from "../types.js";
import { assertIsCycleCount } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const TestInputSchema = z.object({
  suite: z.string().min(1).describe("Test suite name"),
  cycles: z.number().int().nonnegative().describe("Cycle budget (integer cycles, never wall-clock ms)"),
});

export type TestInput = z.infer<typeof TestInputSchema>;

export async function handleTest(
  input: TestInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<TestOutput> {
  caps.requireScope("test.execute");
  assertIsCycleCount(input.cycles, "cycles");

  const cycles = input.cycles as CycleNumber;
  const res = await client.test({ suite: input.suite, cycles });

  const output: TestOutput = {
    success: res.status === "passed",
    plane: "Service",
    testId: res.testId,
    status: res.status as TestOutput["status"],
    cycles,
    passedTests: res.passed,
    failedTests: res.failed,
    totalTests: res.total,
  };
  return output;
}

export const testTool = {
  name: "ortho_test",
  description: "Run test suite via ORTHOServiceClient. cycles is integer cycles, never wall-clock ms.",
  inputSchema: TestInputSchema,
  handler: handleTest,
};
