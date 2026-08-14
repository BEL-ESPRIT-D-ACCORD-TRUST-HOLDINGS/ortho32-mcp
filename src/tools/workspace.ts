/**
 * ortho.workspace — UI plane routing store
 * Workspace stores routes not UI objects. Routes are ortho://...
 * On login: replay routes -> reconstruct desktop.
 */

import { z } from "zod";
import type { WorkspaceOutput, OrthoRoute } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const WorkspaceInputSchema = z.object({
  workspaceId: z.string().min(1).describe("Workspace ID"),
  operation: z.enum(["read", "update"]).default("read"),
  routes: z.array(z.string()).optional().describe("Routes to store (ortho://...) — stored as routes, not UI objects"),
});

export type WorkspaceInput = z.infer<typeof WorkspaceInputSchema>;

function validateRoutes(routes: string[]): OrthoRoute[] {
  return routes.map((r) => {
    if (!r.startsWith("ortho://") && !r.startsWith("https://")) {
      throw new Error(`Invalid route: ${r}. Must be ortho:// or https://`);
    }
    return r as OrthoRoute;
  });
}

export async function handleWorkspace(
  input: WorkspaceInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<WorkspaceOutput> {
  if (input.operation === "update") {
    caps.requireScope("workspace.write");
    if (!input.routes) throw new Error("routes required for update");
    const routes = validateRoutes(input.routes);
    const res = await client.workspaceUpdate({ workspaceId: input.workspaceId, routes });
    const output: WorkspaceOutput = {
      success: true,
      plane: "UI",
      workspaceId: res.workspaceId,
      routes: res.routes,
      activeRoute: res.routes[0],
    };
    return output;
  }

  caps.requireScope("workspace.read");
  const res = await client.workspace({ workspaceId: input.workspaceId });
  const output: WorkspaceOutput = {
    success: true,
    plane: "UI",
    workspaceId: res.workspaceId,
    routes: res.routes,
    activeRoute: res.activeRoute,
  };
  return output;
}

export const workspaceTool = {
  name: "ortho_workspace",
  description:
    "Workspace route store via ORTHOServiceClient (UI plane). Stores routes not UI objects. Replay on login.",
  inputSchema: WorkspaceInputSchema,
  handler: handleWorkspace,
};
