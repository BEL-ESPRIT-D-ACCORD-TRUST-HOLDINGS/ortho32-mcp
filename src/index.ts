#!/usr/bin/env node
/**
 * ORTHO32 MCP Server — CLIENT of ORTHO services
 * Routes: UI / Intent / Service / Fabric
 * All tool outputs typed from src/types.ts, no raw strings
 * cycles integer never ms, verify status from checker, hardware.reset elevated, agent via IntentRouter
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { ORTHOServiceClient } from "./protocol/client.js";
import { TokenManager } from "./auth/token.js";
import { Capabilities } from "./auth/capabilities.js";

import { buildTool, handleBuild } from "./tools/build.js";
import { testTool, handleTest } from "./tools/test.js";
import { verifyTool, handleVerify } from "./tools/verify.js";
import { traceTool, handleTrace } from "./tools/trace.js";
import { deviceTool, handleDevice } from "./tools/device.js";
import { tensorTool, handleTensor } from "./tools/tensor.js";
import { fabricTool, handleFabric } from "./tools/fabric.js";
import { marketplaceTool, handleMarketplace } from "./tools/marketplace.js";
import { agentTool, handleAgent } from "./tools/agent.js";
import { workspaceTool, handleWorkspace } from "./tools/workspace.js";

import { listResources, readResource } from "./resources/index.js";
import { listPrompts, getPrompt } from "./prompts/index.js";

const server = new Server({ name: "ortho32-mcp", version: "0.1.0" }, { capabilities: { tools: {}, resources: {}, prompts: {} } });

function getClientAndCaps(): { client: ORTHOServiceClient; caps: Capabilities } {
  const tm = TokenManager.fromEnv();
  const token = tm.getToken();
  const caps = tm.getCapabilities();
  const client = ORTHOServiceClient.fromEnv(token);
  return { client, caps };
}

const tools = [buildTool, testTool, verifyTool, traceTool, deviceTool, tensorTool, fabricTool, marketplaceTool, agentTool, workspaceTool];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: (z as unknown as { toJSONSchema: (s: z.ZodTypeAny) => unknown }).toJSONSchema
      ? (z as unknown as { toJSONSchema: (s: z.ZodTypeAny) => unknown }).toJSONSchema(t.inputSchema as z.ZodTypeAny)
      : { type: "object", additionalProperties: true },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const { client, caps } = getClientAndCaps();

  try {
    let output: unknown;
    switch (name) {
      case buildTool.name:
        output = await handleBuild(buildTool.inputSchema.parse(args), client, caps);
        break;
      case testTool.name:
        output = await handleTest(testTool.inputSchema.parse(args), client, caps);
        break;
      case verifyTool.name:
        output = await handleVerify(verifyTool.inputSchema.parse(args), client, caps);
        break;
      case traceTool.name:
        output = await handleTrace(traceTool.inputSchema.parse(args), client, caps);
        break;
      case deviceTool.name:
        output = await handleDevice(deviceTool.inputSchema.parse(args), client, caps);
        break;
      case tensorTool.name:
        output = await handleTensor(tensorTool.inputSchema.parse(args), client, caps);
        break;
      case fabricTool.name:
        output = await handleFabric(fabricTool.inputSchema.parse(args), client, caps);
        break;
      case marketplaceTool.name:
        output = await handleMarketplace(marketplaceTool.inputSchema.parse(args), client, caps);
        break;
      case agentTool.name:
        output = await handleAgent(agentTool.inputSchema.parse(args), client, caps);
        break;
      case workspaceTool.name:
        output = await handleWorkspace(workspaceTool.inputSchema.parse(args), client, caps);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    // All tool outputs are typed from src/types.ts — structuredContent carries typed output, no raw string
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output as Record<string, unknown>,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: listResources().map((r) => ({ uri: r.uri, name: r.name, mimeType: r.mimeType, description: r.description })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { client } = getClientAndCaps();
  return await readResource(request.params.uri, client);
});

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: listPrompts().map((p) => ({ name: p.name, description: p.description, arguments: p.arguments })),
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const result = getPrompt(request.params.name, request.params.arguments as Record<string, string>);
  return { description: request.params.name, messages: result.messages as never };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ortho32-mcp listening on stdio (CLIENT -> ortho32-api)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
