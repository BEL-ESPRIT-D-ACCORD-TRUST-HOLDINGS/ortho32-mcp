/**
 * MCP Prompts — guided workflows for ORTHO32
 */

export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: { name: string; description: string; required?: boolean }[];
}

export const orthoPrompts: PromptDefinition[] = [
  {
    name: "verify_rtl",
    description: "Verify RTL determinism theorem via checker. Status comes only from checker output.",
    arguments: [
      { name: "theorem", description: "Theorem name, e.g. rtl_deterministic", required: true },
      { name: "cycles", description: "Cycle budget (integer cycles, never ms)", required: false },
    ],
  },
  {
    name: "trace_waveform",
    description: "Inspect waveform at a specific cycleNumber (integer cycles, never wall-clock ms)",
    arguments: [
      { name: "cycleNumber", description: "Cycle number (integer)", required: true },
      { name: "cycles", description: "Window cycles", required: false },
    ],
  },
  {
    name: "fabric_debug",
    description: "Debug fabric via four routing planes: UI/Intent/Service/Fabric",
    arguments: [{ name: "deviceId", description: "Device ID", required: true }],
  },
];

export function getPrompt(name: string, args: Record<string, string> = {}): { messages: { role: string; content: { type: string; text: string } }[] } {
  switch (name) {
    case "verify_rtl":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Verify theorem ${args["theorem"] ?? "rtl_deterministic"} with cycle budget ${args["cycles"] ?? "1000"} (integer cycles, never ms). Use ortho_verify_theorem; status must come from checker output only.`,
            },
          },
        ],
      };
    case "trace_waveform":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Fetch trace at cycleNumber ${args["cycleNumber"] ?? "420"} (integer, never wall-clock ms). Use ortho_trace with cycles=${args["cycles"] ?? "1"}. Route: ortho://trace/cycle/${args["cycleNumber"] ?? "420"}`,
            },
          },
        ],
      };
    case "fabric_debug":
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Debug fabric device ${args["deviceId"] ?? "ortho0"}. Check device status via ortho_device, then trace via ortho_trace. Remember: hardware.reset requires elevated scope hardware.reset.`,
            },
          },
        ],
      };
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

export function listPrompts(): PromptDefinition[] {
  return orthoPrompts;
}
