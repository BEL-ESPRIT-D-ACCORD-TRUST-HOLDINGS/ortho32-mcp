/**
 * ORTHOServiceClient — HTTP CLIENT for ortho32-api
 * This MCP server is a CLIENT of ORTHO services. NOT a backend.
 * All operations proxy to ORTHOServiceClient -> ortho32-api HTTP.
 */

import type {
  ORTHOServiceClientConfig,
  CheckerOutput,
  CycleNumber,
  OrthoRoute,
} from "../types.js";

export class ORTHOServiceClient {
  private baseUrl: string;
  private token: string;

  constructor(config: ORTHOServiceClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.token = config.token;
    if (!this.baseUrl.startsWith("http")) {
      throw new Error(`ORTHOServiceClient baseUrl must be http(s). Got: ${this.baseUrl}`);
    }
  }

  static fromEnv(token: string): ORTHOServiceClient {
    const baseUrl = process.env["ORTHO32_API_URL"] ?? "https://api.ortho32.local/v1";
    return new ORTHOServiceClient({ baseUrl, token });
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`ORTHO API ${path} failed ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  // Service plane
  build(params: { target: string; cycles: CycleNumber }) {
    return this.request<{ buildId: string; status: string; logs: string }>(`/build`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  test(params: { suite: string; cycles: CycleNumber }) {
    return this.request<{ testId: string; status: string; passed: number; failed: number; total: number }>(
      `/test`,
      { method: "POST", body: JSON.stringify(params) }
    );
  }

  verifyTheorem(params: { theorem: string; cycles: CycleNumber }): Promise<CheckerOutput> {
    // Returns CheckerOutput directly — status must be used verbatim
    return this.request<CheckerOutput>(`/verify`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  trace(params: { cycleNumber: CycleNumber; cycles: CycleNumber }) {
    return this.request<{ signals: Record<string, number>; vcdPath: string }>(`/trace`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  device(params: { deviceId: string }) {
    return this.request<{ deviceId: string; status: string; cycles: number }>(`/device/${params.deviceId}`);
  }

  deviceReset(params: { deviceId: string; cycles: CycleNumber }) {
    return this.request<{ deviceId: string; status: string; cycles: number }>(`/device/${params.deviceId}/reset`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  tensor(params: { operation: string; shape: number[]; cycles: CycleNumber }) {
    return this.request<{ jobId: string; status: string }>(`/tensor`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  fabric(params: { operation: string; blockId?: string; cycles: CycleNumber }) {
    return this.request<{ blockId: string; result: unknown }>(`/fabric`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  marketplace(params: { packageId: string }) {
    return this.request<{ packageId: string; version: string; manifest: Record<string, unknown> }>(
      `/marketplace/${params.packageId}`
    );
  }

  // Intent plane — agent_dispatch via IntentRouter
  intentDispatch(params: { agentId: string; intent: string; params: Record<string, unknown> }) {
    return this.request<{ handled: boolean; route: OrthoRoute; result: unknown }>(`/intent/dispatch`, {
      method: "POST",
      body: JSON.stringify({ plane: "Intent", ...params }),
    });
  }

  workspace(params: { workspaceId: string }) {
    return this.request<{ workspaceId: string; routes: OrthoRoute[]; activeRoute: OrthoRoute }>(
      `/workspace/${params.workspaceId}`
    );
  }

  workspaceUpdate(params: { workspaceId: string; routes: OrthoRoute[] }) {
    return this.request<{ workspaceId: string; routes: OrthoRoute[] }>(`/workspace/${params.workspaceId}`, {
      method: "PUT",
      body: JSON.stringify(params),
    });
  }
}
