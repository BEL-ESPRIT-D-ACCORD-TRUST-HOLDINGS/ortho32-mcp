/**
 * Capability-based auth — enforces elevated scopes
 * RULE: hardware.reset requires elevated scope: hardware.reset
 * default scope cannot self-escalate
 */

import type { CapabilityScope } from "../types.js";
import { ELEVATED_SCOPES } from "../types.js";

export class Capabilities {
  private scopes: Set<CapabilityScope>;

  constructor(scopes: CapabilityScope[]) {
    this.scopes = new Set(scopes);
  }

  static fromTokenScopes(scopes: string[]): Capabilities {
    return new Capabilities(scopes as CapabilityScope[]);
  }

  hasScope(scope: CapabilityScope): boolean {
    return this.scopes.has(scope);
  }

  requireScope(scope: CapabilityScope): void {
    if (!this.hasScope(scope)) {
      throw new Error(
        `Missing required scope: ${scope}. ` +
          (ELEVATED_SCOPES.includes(scope)
            ? `Elevated scope ${scope} cannot be self-escalated from default scope. Request elevated token.`
            : `Grant scope ${scope} to token.`)
      );
    }
  }

  /**
   * Enforces hardware.reset elevated check — no self-escalation
   */
  requireHardwareReset(): void {
    this.requireScope("hardware.reset");
  }

  assertCanMutateFabric(operation: string): void {
    if (operation === "reset") {
      this.requireHardwareReset();
    }
  }

  list(): CapabilityScope[] {
    return [...this.scopes];
  }

  isElevated(): boolean {
    return ELEVATED_SCOPES.some((s) => this.scopes.has(s));
  }
}
