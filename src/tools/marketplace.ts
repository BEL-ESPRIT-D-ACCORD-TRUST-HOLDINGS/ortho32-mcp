/**
 * ortho.marketplace — Service plane via ORTHOServiceClient
 */

import { z } from "zod";
import type { MarketplaceOutput } from "../types.js";
import type { ORTHOServiceClient } from "../protocol/client.js";
import type { Capabilities } from "../auth/capabilities.js";

export const MarketplaceInputSchema = z.object({
  packageId: z.string().min(1).describe("Package ID, e.g. foo"),
  version: z.string().optional(),
  operation: z.enum(["read", "install"]).default("read"),
});

export type MarketplaceInput = z.infer<typeof MarketplaceInputSchema>;

export async function handleMarketplace(
  input: MarketplaceInput,
  client: ORTHOServiceClient,
  caps: Capabilities
): Promise<MarketplaceOutput> {
  if (input.operation === "install") caps.requireScope("marketplace.write");
  else caps.requireScope("marketplace.read");

  const res = await client.marketplace({ packageId: input.packageId });

  const output: MarketplaceOutput = {
    success: true,
    plane: "Service",
    packageId: res.packageId,
    version: res.version ?? input.version,
    route: `ortho://marketplace/package/${input.packageId}`,
    manifest: res.manifest,
  };
  return output;
}

export const marketplaceTool = {
  name: "ortho_marketplace",
  description: "Marketplace lookup/install via ORTHOServiceClient (Service plane).",
  inputSchema: MarketplaceInputSchema,
  handler: handleMarketplace,
};
