/**
 * ORTHO32 Shared Types — SINGLE SOURCE OF TRUTH FOR ALL TOOL OUTPUTS
 *
 * INVARIANT RULES (enforced everywhere):
 * 1. cycles / cycleNumber are always number (integer) NEVER wall-clock ms
 * 2. verify_theorem status comes only from actual checker output, never string inference
 * 3. hardware.reset requires elevated scope: hardware.reset -- default scope cannot self-escalate
 * 4. All tool outputs are typed from src/types.ts, no raw string responses
 * 5. This is a CLIENT of ORTHO services (via ORTHOServiceClient -> ortho32-api HTTP). NOT a backend.
 * 6. ortho.agent_dispatch uses IntentRouter path. Never mutates UI state.
 */

// =============================================================================
// PRIMITIVES — Cycles are integers, never wall-clock
// =============================================================================

/**
 * CycleNumber — discrete hardware cycle count. Must be integer >= 0.
 * NEVER wall-clock milliseconds. Wall-clock is a different domain and must not be used.
 */
export type CycleNumber = number;

export type CycleCount = number; // alias for plural form, same constraint

export function assertIsCycleNumber(value: number, field: string = "cycleNumber"): asserts value is CycleNumber {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be an integer >= 0 (cycles, never wall-clock ms). Got: ${value}`);
  }
}

export function assertIsCycleCount(value: number, field: string = "cycles"): asserts value is CycleCount {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be an integer >= 0 (cycles, never wall-clock ms). Got: ${value}`);
  }
}

// =============================================================================
// CHECKER — verify_theorem status comes ONLY from checker
// =============================================================================

export type CheckerStatus = "proved" | "failed" | "unknown" | "timeout" | "error";

export interface CheckerOutput {
  /** Raw output from Lean / proof checker — sole source of truth */
  status: CheckerStatus;
  theorem: string;
  elapsedCycles: CycleNumber;
  output: string;
  diagnostics?: string[];
  kernelOutput?: string;
}

/**
 * Never infer CheckerStatus from string matching on 'error'/'success' etc.
 * Only assignment allowed: status = checkerOutput.status
 */
export function checkerStatusFromOutput(output: CheckerOutput): CheckerStatus {
  return output.status;
}

// =============================================================================
// AUTH — capability scopes
// =============================================================================

export type CapabilityScope =
  | "build.execute"
  | "test.execute"
  | "verify.execute"
  | "trace.read"
  | "device.read"
  | "device.write"
  | "hardware.reset"
  | "tensor.execute"
  | "fabric.execute"
  | "marketplace.read"
  | "marketplace.write"
  | "agent.dispatch"
  | "workspace.read"
  | "workspace.write";

export const ELEVATED_SCOPES: CapabilityScope[] = ["hardware.reset"];

// =============================================================================
// ORTHO ROUTING — Four planes
// =============================================================================

export type OrthoRoute =
  | `ortho://app/${string}`
  | `ortho://ide/file/${string}`
  | `ortho://settings/${string}`
  | `ortho://hardware/device/${string}`
  | `ortho://proof/${string}`
  | `ortho://trace/cycle/${number}`
  | `ortho://marketplace/package/${string}`
  | `ortho://agent/${string}`
  | `ortho://workspace/${string}`
  | `ortho://terminal/session/${string}`
  | `https://${string}`;

export type RoutingPlane = "UI" | "Intent" | "Service" | "Fabric";

export interface IntentRouterRequest {
  intent: string;
  params: Record<string, unknown>;
  plane: Extract<RoutingPlane, "Intent">;
}

export interface IntentRouterResponse {
  route: OrthoRoute;
  plane: RoutingPlane;
  handled: boolean;
}

// =============================================================================
// SERVICE CLIENT — this MCP is a CLIENT, not a backend
// =============================================================================

export const ORTHO_API_BASE_ENV = "ORTHO32_API_URL";
export const DEFAULT_ORTHO_API_BASE = "https://api.ortho32.local/v1";

export interface ORTHOServiceClientConfig {
  baseUrl: string;
  token: string;
}

// =============================================================================
// TYPED TOOL OUTPUTS — all tools must return these, never raw strings
// =============================================================================

export interface BaseToolOutput {
  success: boolean;
  plane: RoutingPlane;
}

export interface BuildOutput extends BaseToolOutput {
  plane: "Service";
  buildId: string;
  status: "queued" | "building" | "succeeded" | "failed";
  cycles: CycleNumber;
  artifact?: string;
  logs?: string;
}

export interface TestOutput extends BaseToolOutput {
  plane: "Service";
  testId: string;
  status: "passed" | "failed" | "running";
  cycles: CycleNumber;
  passedTests: number;
  failedTests: number;
  totalTests: number;
}

export interface VerifyOutput extends BaseToolOutput {
  plane: "Service";
  theorem: string;
  status: CheckerStatus; // MUST equal checkerOutput.status, no inference
  checkerOutput: CheckerOutput;
  cycles: CycleNumber;
}

export interface TraceOutput extends BaseToolOutput {
  plane: "Fabric";
  cycleNumber: CycleNumber;
  cycles: CycleNumber;
  signals: Record<string, number>;
  vcdPath?: string;
  route: OrthoRoute;
}

export interface DeviceOutput extends BaseToolOutput {
  plane: "Fabric";
  deviceId: string;
  status: "online" | "offline" | "resetting" | "error";
  cycles: CycleNumber;
  route: OrthoRoute;
}

export interface TensorOutput extends BaseToolOutput {
  plane: "Service";
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  cycles: CycleNumber;
  shape?: number[];
  dtype?: string;
}

export interface FabricOutput extends BaseToolOutput {
  plane: "Fabric";
  operation: string;
  cycles: CycleNumber;
  blockId?: string;
  result?: unknown;
}

export interface MarketplaceOutput extends BaseToolOutput {
  plane: "Service";
  packageId: string;
  version?: string;
  route: OrthoRoute;
  manifest?: Record<string, unknown>;
}

export interface AgentOutput extends BaseToolOutput {
  plane: "Intent";
  agentId: string;
  intent: string;
  via: "IntentRouter";
  result: unknown;
  // Never mutates UI state — Intent plane only
}

export interface WorkspaceOutput extends BaseToolOutput {
  plane: "UI";
  workspaceId: string;
  routes: OrthoRoute[];
  activeRoute?: OrthoRoute;
}

export type AnyToolOutput =
  | BuildOutput
  | TestOutput
  | VerifyOutput
  | TraceOutput
  | DeviceOutput
  | TensorOutput
  | FabricOutput
  | MarketplaceOutput
  | AgentOutput
  | WorkspaceOutput;
