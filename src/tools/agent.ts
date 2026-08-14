/**
 * ortho.agent_dispatch — uses IntentRouter path. Never mutates UI state.
 * This is Intent plane routing, not UI plane.
 */

import { z } from "zod";
import type { AgentOutput } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const AgentInputSchema = z.object({
  agentId: z.string().min(1).describe("Agent ID, e.g. verify"),
  intent: z.string().min(1).describe("Intent to dispatch, e.g. verify, analyze"),
  params: z.record(z.unknown()).default({}).describe("Intent params"),
});

export type AgentInput = z.infer<typeof AgentInputSchema>;

export async function handleAgent(
  input: AgentInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<AgentOutput> {
  caps.requireScope("agent.dispatch");

  // MUST go via IntentRouter — never direct UI mutation
  const res = await client.intentDispatch({
    agentId: input.agentId,
    intent: input.intent,
    params: input.params,
  });

  const output: AgentOutput = {
    success: res.handled,
    plane: "Intent",
    agentId: input.agentId,
    intent: input.intent,
    via: "IntentRouter",
    result: res.result,
  };
  return output;
}

export const agentTool = {
  name: "ortho_agent_dispatch",
  description:
    "Dispatch to agent via IntentRouter (Intent plane). Never mutates UI state. Uses ORTHOServiceClient intentDispatch.",
  inputSchema: AgentInputSchema,
  handler: handleAgent,
};
