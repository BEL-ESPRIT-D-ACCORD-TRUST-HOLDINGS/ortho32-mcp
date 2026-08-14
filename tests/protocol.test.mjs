import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const script = join(root, "bin", "ortho32-mcp.awk");
const awk = process.env.AWK || [
  "awk",
  "gawk",
  "C:\\Program Files\\Git\\usr\\bin\\awk.exe",
  "C:\\Program Files\\Git\\usr\\bin\\gawk.exe",
].find((candidate) => {
  if (candidate.includes(":")) return existsSync(candidate);
  const probe = spawnSync(candidate, ["--version"], { encoding: "utf8" });
  return probe.status === 0 || probe.stderr || probe.stdout;
});

if (!awk) {
  console.error("FAIL: no awk executable found. Set AWK=/path/to/awk.");
  process.exit(1);
}

function request(id, method, params) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });
}

function notification(method, params) {
  return JSON.stringify({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
}

function call(id, name, args) {
  return request(id, "tools/call", { name, arguments: args });
}

function run(lines) {
  const input = `${lines.join("\n")}\n`;
  const res = spawnSync(awk, ["-f", script], { input, encoding: "utf8" });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`awk exited ${res.status}\nstdout=${res.stdout}\nstderr=${res.stderr}`);
  }
  const out = res.stdout.trim() ? res.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line)) : [];
  return { out, stderr: res.stderr };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const session = run([
  request(1, "initialize", { protocolVersion: "2024-11-05" }),
  notification("notifications/initialized"),
  request(2, "tools/list"),
  call(3, "awk_count", { input: "a\n\nb" }),
  call(4, "awk_fields", { input: "name,age\nAlice,30\nBob,42", separator: ",", header: true }),
  call(5, "awk_filter", { input: "alpha\nbeta\ngamma", pattern: "^a" }),
  call(6, "awk_regex", { input: "alpha\nbeta\ngamma", pattern: "a" }),
  call(7, "awk_transform", { input: " Hello\nWorld ", operation: "trim" }),
  request(8, "unknown/method"),
  call(9, "missing_tool", {}),
  call(10, "awk_count", {}),
  "{not-json",
]);

assert(session.out.length === 11, `expected 11 responses, got ${session.out.length}`);
assert(session.out[0].result.serverInfo.name === "ortho32-mcp-awk", "initialize server name mismatch");
assert(session.out[1].result.tools.length === 5, "tools/list should expose 5 tools");
assert(session.out[2].result.structuredContent.lines === 3, "awk_count line count mismatch");
assert(session.out[3].result.structuredContent.records[0].name === "Alice", "awk_fields header mapping mismatch");
assert(session.out[4].result.structuredContent.lines[0] === "alpha", "awk_filter mismatch");
assert(session.out[5].result.structuredContent.matchingLines === 3, "awk_regex mismatch");
assert(session.out[6].result.structuredContent.output === "Hello\nWorld", "awk_transform trim mismatch");
assert(session.out[7].error.code === -32601, "unknown method should be -32601");
assert(session.out[8].error.message.includes("Unknown tool"), "unknown tool error mismatch");
assert(session.out[9].error.message.includes("input required"), "invalid args error mismatch");
assert(session.out[10].error.code === -32700, "malformed JSON should be parse error");

const replayA = run([call(11, "awk_count", { input: "one\ntwo" })]).out[0];
const replayB = run([call(11, "awk_count", { input: "one\ntwo" })]).out[0];
assert(JSON.stringify(replayA) === JSON.stringify(replayB), "deterministic replay mismatch");

for (const msg of session.out) {
  assert(msg.jsonrpc === "2.0", "stdout contained non JSON-RPC payload");
}

console.log(`AWK=${awk}`);
console.log("initialize: ok");
console.log("tools/list: ok");
console.log("tools/call: ok");
console.log("unknown method/tool/errors: ok");
console.log("notifications: ok");
console.log("malformed JSON: ok");
console.log("deterministic replay: ok");
