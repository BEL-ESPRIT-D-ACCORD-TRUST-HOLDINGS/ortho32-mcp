/**
 * Token handling for ORTHO32 MCP
 * Tokens carry scopes; validation is done via Capabilities.
 * No self-escalation — elevated scopes must be issued out-of-band.
 */

import type { CapabilityScope } from "../types.js";
import { Capabilities } from "./capabilities.js";

export interface OrthoTokenPayload {
  sub: string;
  scopes: CapabilityScope[];
  exp?: number;
  iat?: number;
}

export class TokenManager {
  private token: string | null = null;
  private payload: OrthoTokenPayload | null = null;

  constructor(initialToken?: string) {
    if (initialToken) this.setToken(initialToken);
  }

  setToken(token: string): void {
    this.token = token;
    this.payload = this.decode(token);
  }

  getToken(): string {
    if (!this.token) throw new Error("No token set. Set ORTHO32_TOKEN or ORTHO_TOKEN env.");
    return this.token;
  }

  getCapabilities(): Capabilities {
    if (!this.payload) throw new Error("No token payload. Call setToken first.");
    return Capabilities.fromTokenScopes(this.payload.scopes);
  }

  getPayload(): OrthoTokenPayload {
    if (!this.payload) throw new Error("No token payload decoded.");
    return this.payload;
  }

  static fromEnv(): TokenManager {
    const token = process.env["ORTHO32_TOKEN"] ?? process.env["ORTHO_TOKEN"] ?? "";
    if (!token) throw new Error("Missing ORTHO32_TOKEN env var");
    return new TokenManager(token);
  }

  private decode(token: string): OrthoTokenPayload {
    // Try JWT decode without verification (verification is server-side)
    // Fallback to opaque token with default scopes
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const json = Buffer.from(parts[1]!, "base64url").toString("utf-8");
        const parsed = JSON.parse(json) as OrthoTokenPayload;
        if (Array.isArray(parsed.scopes)) return parsed;
      }
    } catch {
      // fall through
    }
    // Opaque token fallback: treat as default scopes (no elevated)
    // Explicitly does NOT include hardware.reset — cannot self-escalate
    return {
      sub: "unknown",
      scopes: ["build.execute", "test.execute", "verify.execute", "trace.read", "device.read", "tensor.execute", "fabric.execute", "marketplace.read", "workspace.read", "workspace.write", "agent.dispatch"] as CapabilityScope[],
    };
  }
}
