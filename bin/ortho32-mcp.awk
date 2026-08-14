#!/usr/bin/env awk -f
# Deterministic stdio MCP server in AWK.
# stdout is protocol only. Diagnostics go to stderr.

BEGIN {
  server_name = "ortho32-mcp-awk"
  server_version = "0.1.0"
  initialized = 0
}

{
  line = $0
  sub(/\r$/, "", line)
  handle(line)
  fflush()
}

function handle(line, id, method, tool) {
  if (!looks_json(line)) {
    print error_json("null", -32700, "Parse error: malformed JSON object")
    return
  }

  id = json_id(line)
  method = json_string(line, "method")

  if (method == "") {
    # JSON-RPC responses are ignored by servers. Invalid requests with ids fail.
    if (id != "" && index(line, "\"result\"") == 0 && index(line, "\"error\"") == 0)
      print error_json(id, -32600, "Invalid Request: missing method")
    return
  }

  if (id == "" && method !~ /^notifications\//) {
    print error_json("null", -32600, "Invalid Request: missing request id")
    return
  }

  if (method == "notifications/initialized") {
    initialized = 1
    print_log("initialized notification received")
    return
  }

  if (method == "initialize") {
    initialized = 1
    print initialize_response(id)
  } else if (method == "tools/list") {
    print tools_list_response(id)
  } else if (method == "tools/call") {
    tool = json_string(line, "name")
    if (tool == "") print error_json(id, -32602, "Invalid params: missing tool name")
    else dispatch_tool(id, tool, line)
  } else {
    print error_json(id, -32601, "Method not found: " method)
  }
}

function dispatch_tool(id, tool, line) {
  if (tool == "awk_count") call_count(id, line)
  else if (tool == "awk_fields") call_fields(id, line)
  else if (tool == "awk_filter") call_filter(id, line)
  else if (tool == "awk_regex") call_regex(id, line)
  else if (tool == "awk_transform") call_transform(id, line)
  else print error_json(id, -32602, "Unknown tool: " tool)
}

function call_count(id, line, input, n, i, rows, nonempty, chars, arr) {
  input = json_string(line, "input")
  if (!json_has(line, "input")) {
    print error_json(id, -32602, "Invalid tool arguments: input required")
    return
  }
  chars = length(input)
  n = split(input, arr, "\n")
  rows = (input == "" ? 0 : n)
  nonempty = 0
  for (i = 1; i <= n; i++) if (arr[i] !~ /^[ \t]*$/) nonempty++
  print tool_result(id, "{\"tool\":\"awk_count\",\"lines\":" rows ",\"nonEmptyLines\":" nonempty ",\"characters\":" chars "}")
}

function call_fields(id, line, input, sep, header, n, i, j, nf, rows, arr, fields, obj, out) {
  input = json_string(line, "input")
  if (!json_has(line, "input")) {
    print error_json(id, -32602, "Invalid tool arguments: input required")
    return
  }
  sep = json_string(line, "separator")
  if (sep == "") sep = ","
  header = json_bool(line, "header")
  n = split(input, arr, "\n")
  rows = 0
  out = "{\"tool\":\"awk_fields\",\"separator\":\"" esc(sep) "\",\"records\":["
  for (i = 1; i <= n; i++) {
    if (arr[i] == "") continue
    nf = split(arr[i], fields, sep)
    if (header && i == 1) {
      for (j = 1; j <= nf; j++) hdr[j] = fields[j]
      continue
    }
    rows++
    if (rows > 1) out = out ","
    obj = "{"
    for (j = 1; j <= nf; j++) {
      if (j > 1) obj = obj ","
      obj = obj "\"" esc(header ? hdr[j] : "field" j) "\":\"" esc(fields[j]) "\""
    }
    obj = obj "}"
    out = out obj
  }
  out = out "],\"count\":" rows "}"
  delete hdr
  print tool_result(id, out)
}

function call_filter(id, line, input, pattern, invert, n, i, kept, arr, out, hit) {
  input = json_string(line, "input")
  pattern = json_string(line, "pattern")
  if (!json_has(line, "input") || pattern == "") {
    print error_json(id, -32602, "Invalid tool arguments: input and pattern required")
    return
  }
  invert = json_bool(line, "invert")
  n = split(input, arr, "\n")
  out = "{\"tool\":\"awk_filter\",\"lines\":["
  kept = 0
  for (i = 1; i <= n; i++) {
    hit = (arr[i] ~ pattern)
    if ((hit && !invert) || (!hit && invert)) {
      kept++
      if (kept > 1) out = out ","
      out = out "\"" esc(arr[i]) "\""
    }
  }
  out = out "],\"count\":" kept "}"
  print tool_result(id, out)
}

function call_regex(id, line, input, pattern, n, i, matches, arr) {
  input = json_string(line, "input")
  pattern = json_string(line, "pattern")
  if (!json_has(line, "input") || pattern == "") {
    print error_json(id, -32602, "Invalid tool arguments: input and pattern required")
    return
  }
  n = split(input, arr, "\n")
  matches = 0
  for (i = 1; i <= n; i++) if (arr[i] ~ pattern) matches++
  print tool_result(id, "{\"tool\":\"awk_regex\",\"pattern\":\"" esc(pattern) "\",\"matchingLines\":" matches ",\"totalLines\":" (input == "" ? 0 : n) "}")
}

function call_transform(id, line, input, operation, out, n, i, arr) {
  input = json_string(line, "input")
  operation = json_string(line, "operation")
  if (!json_has(line, "input") || operation == "") {
    print error_json(id, -32602, "Invalid tool arguments: input and operation required")
    return
  }
  if (operation == "upper") out = toupper(input)
  else if (operation == "lower") out = tolower(input)
  else if (operation == "trim") {
    n = split(input, arr, "\n")
    out = ""
    for (i = 1; i <= n; i++) {
      gsub(/^[ \t]+|[ \t]+$/, "", arr[i])
      out = out (i == 1 ? "" : "\n") arr[i]
    }
  } else {
    print error_json(id, -32602, "Unsupported operation: " operation)
    return
  }
  print tool_result(id, "{\"tool\":\"awk_transform\",\"operation\":\"" esc(operation) "\",\"output\":\"" esc(out) "\"}")
}

function initialize_response(id) {
  return "{\"jsonrpc\":\"2.0\",\"id\":" id ",\"result\":{\"protocolVersion\":\"2024-11-05\",\"capabilities\":{\"tools\":{}},\"serverInfo\":{\"name\":\"" server_name "\",\"version\":\"" server_version "\"}}}"
}

function tools_list_response(id) {
  return "{\"jsonrpc\":\"2.0\",\"id\":" id ",\"result\":{\"tools\":[" tool_schema_count() "," tool_schema_fields() "," tool_schema_filter() "," tool_schema_regex() "," tool_schema_transform() "]}}"
}

function tool_schema_count() {
  return "{\"name\":\"awk_count\",\"description\":\"Count lines, non-empty lines, and characters deterministically.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"input\":{\"type\":\"string\"}},\"required\":[\"input\"]}}"
}

function tool_schema_fields() {
  return "{\"name\":\"awk_fields\",\"description\":\"Split records into fields using an explicit separator.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"input\":{\"type\":\"string\"},\"separator\":{\"type\":\"string\"},\"header\":{\"type\":\"boolean\"}},\"required\":[\"input\"]}}"
}

function tool_schema_filter() {
  return "{\"name\":\"awk_filter\",\"description\":\"Return lines matching an AWK regular expression.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"input\":{\"type\":\"string\"},\"pattern\":{\"type\":\"string\"},\"invert\":{\"type\":\"boolean\"}},\"required\":[\"input\",\"pattern\"]}}"
}

function tool_schema_regex() {
  return "{\"name\":\"awk_regex\",\"description\":\"Count lines matching an AWK regular expression.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"input\":{\"type\":\"string\"},\"pattern\":{\"type\":\"string\"}},\"required\":[\"input\",\"pattern\"]}}"
}

function tool_schema_transform() {
  return "{\"name\":\"awk_transform\",\"description\":\"Apply deterministic upper, lower, or trim transformation.\",\"inputSchema\":{\"type\":\"object\",\"properties\":{\"input\":{\"type\":\"string\"},\"operation\":{\"type\":\"string\",\"enum\":[\"upper\",\"lower\",\"trim\"]}},\"required\":[\"input\",\"operation\"]}}"
}

function tool_result(id, structured, text) {
  text = structured
  return "{\"jsonrpc\":\"2.0\",\"id\":" id ",\"result\":{\"content\":[{\"type\":\"text\",\"text\":\"" esc(text) "\"}],\"structuredContent\":" structured "}}"
}

function error_json(id, code, msg) {
  return "{\"jsonrpc\":\"2.0\",\"id\":" id ",\"error\":{\"code\":" code ",\"message\":\"" esc(msg) "\"}}"
}

function looks_json(s, t) {
  t = s
  gsub(/^[ \t]+|[ \t]+$/, "", t)
  return (substr(t, 1, 1) == "{" && substr(t, length(t), 1) == "}")
}

function json_has(s, key) {
  return index(s, "\"" key "\"") > 0
}

function json_id(s, pos, rest, token) {
  pos = index(s, "\"id\"")
  if (!pos) return ""
  rest = substr(s, pos + 4)
  pos = index(rest, ":")
  if (!pos) return ""
  rest = trim(substr(rest, pos + 1))
  if (substr(rest, 1, 1) == "\"") return "\"" esc(parse_string(rest)) "\""
  if (substr(rest, 1, 4) == "null") return "null"
  if (match(rest, /^-?[0-9]+/)) return substr(rest, RSTART, RLENGTH)
  return ""
}

function json_string(s, key, pos, rest) {
  pos = index(s, "\"" key "\"")
  if (!pos) return ""
  rest = substr(s, pos + length(key) + 2)
  pos = index(rest, ":")
  if (!pos) return ""
  rest = trim(substr(rest, pos + 1))
  if (substr(rest, 1, 1) != "\"") return ""
  return parse_string(rest)
}

function json_bool(s, key, pos, rest) {
  pos = index(s, "\"" key "\"")
  if (!pos) return 0
  rest = substr(s, pos + length(key) + 2)
  pos = index(rest, ":")
  if (!pos) return 0
  rest = trim(substr(rest, pos + 1))
  return substr(rest, 1, 4) == "true"
}

function parse_string(s, i, c, out, escp, n) {
  out = ""
  escp = 0
  n = length(s)
  for (i = 2; i <= n; i++) {
    c = substr(s, i, 1)
    if (escp) {
      if (c == "n") out = out "\n"
      else if (c == "t") out = out "\t"
      else if (c == "r") out = out "\r"
      else out = out c
      escp = 0
    } else if (c == "\\") {
      escp = 1
    } else if (c == "\"") {
      return out
    } else {
      out = out c
    }
  }
  return ""
}

function trim(s) {
  gsub(/^[ \t\r\n]+|[ \t\r\n]+$/, "", s)
  return s
}

function esc(s) {
  gsub(/\\/, "\\\\", s)
  gsub(/"/, "\\\"", s)
  gsub(/\r/, "\\r", s)
  gsub(/\n/, "\\n", s)
  gsub(/\t/, "\\t", s)
  return s
}

function print_log(msg) {
  print "[ortho32-mcp-awk] " msg > "/dev/stderr"
}
