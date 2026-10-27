
# Agent Log

This file records interactions with AI agents during the Web Development course.

## 2026-10-27 · MCP Server Implementation

- **Goal:** Implement a working MCP server using Node.js without an MCP SDK or framework.
- **Delegated:** Asked ChatGPT to explain the JSON-RPC protocol, review the implementation, and help troubleshoot errors.
- **Checkpoints:** Successfully implemented initialization, tool discovery, tool execution, and error handling. The server passed all 12 self-checks.
- **Went wrong:** Initially encountered incorrect file paths and confused the error handling for unknown tools with unknown JSON-RPC methods.
- **Changed by hand:** Corrected the `callTool()` and `handle()` functions, added error handling, and verified the responses using the course checker.

## 2026-10-27 · Gemini CLI Integration

- **Goal:** Connect Gemini CLI to the MCP server and verify that an AI agent can discover and use its tools.
- **Delegated:** Asked ChatGPT for help diagnosing slow responses and interpreting Gemini CLI debug logs.
- **Checkpoints:** Gemini CLI successfully connected to the MCP server named `my-project` and discovered both `find_lecture` and `count_lectures`.
- **Went wrong:** Gemini CLI failed to complete model requests. Debug logs showed repeated HTTP 503 `UNAVAILABLE` errors indicating high demand for the selected model. Even a simple arithmetic question failed to complete.
- **Changed by hand:** Tested different models, enabled debug logging, and inspected the API errors. No changes to the MCP server implementation were necessary.
- **Result:** MCP connection and tool discovery succeeded. Actual tool execution by Gemini remains unverified because of the model API failures.

## 2026-10-27 · npm Start Command

- **Goal:** Configure a standard command for starting the MCP server.
- **Delegated:** Asked ChatGPT to explain the npm configuration and verification steps.
- **Checkpoints:** Created `package.json`, added the `mcp` script, and successfully ran the course self-check through npm.
- **Went wrong:** No issues encountered.
- **Changed by hand:** Added the npm script and verified that `npm run --silent mcp` starts the server correctly.
- **Result:** All 12 self-checks passed.
