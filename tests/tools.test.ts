import { describe, it, expect, vi } from "vitest";
import { assertIsCycleNumber, assertIsCycleCount } from "../src/types.js";
import { Capabilities } from "../src/auth/capabilities.js";
import { handleVerify } from "../src/tools/verify.js";
import { handleTrace } from "../src/tools/trace.js";
import { handleDevice } from "../src/tools/device.js";
import { handleAgent } from "../src/tools/agent.js";
import type { ORTHOServiceClient } from "../src/protocol/client.js";

function mockClient(overrides: Partial<ORTHOServiceClient> = {}): ORTHOServiceClient {
  return {
    verifyTheorem: vi.fn(async () => ({ status: "proved", theorem: "rtl_deterministic", elapsedCycles: 10, output: "proved" })),
    trace: vi.fn(async () => ({ signals: { clk: 1 }, vcdPath: "/tmp/a.vcd" })),
    device: vi.fn(async () => ({ deviceId: "ortho0", status: "online", cycles: 100 })),
    deviceReset: vi.fn(async () => ({ deviceId: "ortho0", status: "resetting", cycles: 0 })),
    intentDispatch: vi.fn(async () => ({ handled: true, route: "ortho://agent/verify", result: { ok: true } })),
    build: vi.fn(async () => ({ buildId: "b1", status: "succeeded", logs: "" })),
    test: vi.fn(async () => ({ testId: "t1", status: "passed", passed: 1, failed: 0, total: 1 })),
    tensor: vi.fn(async () => ({ jobId: "j1", status: "completed" })),
    fabric: vi.fn(async () => ({ blockId: "b0", result: {} })),
    marketplace: vi.fn(async () => ({ packageId: "foo", version: "1.0.0", manifest: {} })),
    workspace: vi.fn(async () => ({ workspaceId: "w1", routes: ["ortho://app/ide"], activeRoute: "ortho://app/ide" })),
    workspaceUpdate: vi.fn(async () => ({ workspaceId: "w1", routes: ["ortho://app/ide"] })),
    request: vi.fn(),
  } as unknown as ORTHOServiceClient;
}

describe("cycles are always integer never wall-clock ms", () => {
  it("rejects non-integer cycleNumber", () => {
    expect(() => assertIsCycleNumber(10.5)).toThrow(/integer/);
    expect(() => assertIsCycleNumber(-1)).toThrow(/integer/);
  });
  it("rejects non-integer cycles", () => {
    expect(() => assertIsCycleCount(3.14)).toThrow(/integer/);
  });
  it("trace handler rejects float cycleNumber", async () => {
    const client = mockClient();
    const caps = new Capabilities(["trace.read"]);
    await expect(handleTrace({ cycleNumber: 1.5, cycles: 1 }, client, caps)).rejects.toThrow();
  });
});

describe("verify_theorem status comes only from actual checker output", () => {
  it("uses checkerOutput.status verbatim, never string inference", async () => {
    const client = mockClient({
      verifyTheorem: vi.fn(async () => ({ status: "failed", theorem: "rtl_deterministic", elapsedCycles: 5, output: "some string containing proved but actually failed" })),
    } as never);
    const caps = new Capabilities(["verify.execute"]);
    const out = await handleVerify({ theorem: "rtl_deterministic", cycles: 100 }, client as ORTHOServiceClient, caps);
    expect(out.status).toBe("failed");
    expect(out.checkerOutput.status).toBe("failed");
    // Even though output string contains 'proved', status is failed from checker
    expect(out.success).toBe(false);
  });
  it("proved maps to success true", async () => {
    const client = mockClient();
    const caps = new Capabilities(["verify.execute"]);
    const out = await handleVerify({ theorem: "rtl_deterministic", cycles: 10 }, client, caps);
    expect(out.status).toBe("proved");
    expect(out.success).toBe(true);
  });
});

describe("hardware.reset requires elevated scope", () => {
  it("default scope cannot reset", async () => {
    const client = mockClient();
    const caps = new Capabilities(["device.read"]); // no hardware.reset
    await expect(handleDevice({ deviceId: "ortho0", operation: "reset", cycles: 1 }, client, caps)).rejects.toThrow(/hardware\.reset/);
    expect(client.deviceReset).not.toHaveBeenCalled();
  });
  it("elevated scope can reset", async () => {
    const client = mockClient();
    const caps = new Capabilities(["device.read", "hardware.reset"]);
    const out = await handleDevice({ deviceId: "ortho0", operation: "reset", cycles: 1 }, client, caps);
    expect(out.status).toBe("resetting");
    expect(client.deviceReset).toHaveBeenCalled();
  });
  it("cannot self-escalate — Capabilities without scope throws", () => {
    const caps = new Capabilities(["device.read"]);
    expect(() => caps.requireHardwareReset()).toThrow(/cannot be self-escalated/);
  });
});

describe("All tool outputs are typed from src/types.ts, no raw string", () => {
  it("trace output is typed with cycleNumber integer and plane Fabric", async () => {
    const client = mockClient();
    const caps = new Capabilities(["trace.read"]);
    const out = await handleTrace({ cycleNumber: 420, cycles: 1 }, client, caps);
    expect(out.plane).toBe("Fabric");
    expect(out.cycleNumber).toBe(420);
    expect(Number.isInteger(out.cycleNumber)).toBe(true);
    expect(out.route).toBe("ortho://trace/cycle/420");
    expect(typeof out).toBe("object");
    expect(typeof (out as unknown as string)).not.toBe("string");
  });
});

describe("CLIENT via ORTHOServiceClient and IntentRouter", () => {
  it("agent_dispatch uses IntentRouter path via client.intentDispatch", async () => {
    const client = mockClient();
    const caps = new Capabilities(["agent.dispatch"]);
    const out = await handleAgent({ agentId: "verify", intent: "verify", params: {} }, client, caps);
    expect(client.intentDispatch).toHaveBeenCalledWith(expect.objectContaining({ agentId: "verify" }));
    expect(out.via).toBe("IntentRouter");
    expect(out.plane).toBe("Intent");
  });
  it("agent output never mutates UI state — plane is Intent not UI", async () => {
    const client = mockClient();
    const caps = new Capabilities(["agent.dispatch"]);
    const out = await handleAgent({ agentId: "verify", intent: "analyze", params: { theorem: "x" } }, client, caps);
    expect(out.plane).not.toBe("UI");
  });
});
