
# Exercise 1 · MCP Server

A simple Model Context Protocol (MCP) server implemented in Node.js without an MCP SDK or framework.

The server communicates with clients using JSON-RPC over standard input and output.

It provides two tools for accessing local course lecture data.

## Project Structure

| File | Description |
|---|---|
| `server.js` | MCP server implementation |
| `lectures.json` | Local course lecture data |
| `messages.jsonl` | Example JSON-RPC messages |
| `check.mjs` | Automated server self-check |

## Available Tools

### find_lecture

Finds a specific course lecture by its number.

**Input:**
- `number`: Required integer identifying the lecture.

**Output:**
- Lecture number
- Lecture title
- Lecture topics

If the requested lecture does not exist, the tool returns a readable error message with `isError: true`.

### count_lectures

Counts the lectures available in the local course data.

**Input:**
- No arguments required.

**Output:**
- Total number of available lectures.

Both tools read information from `lectures.json`.

## Supported JSON-RPC Methods

| Method | Behavior |
|---|---|
| `initialize` | Returns server information and capabilities |
| `notifications/initialized` | Processes the notification without sending a response |
| `tools/list` | Returns descriptions and input schemas for both tools |
| `tools/call` | Executes the requested tool |

## Error Handling

The server distinguishes between tool execution failures and protocol errors.

- A nonexistent lecture returns a normal tool result with `isError: true`.
- An unknown tool returns JSON-RPC error code `-32602`.
- An unknown method returns JSON-RPC error code `-32601`.
- Notifications do not receive responses.

Diagnostic messages are written to stderr. JSON-RPC responses are written to stdout.

## How to Start It

From the repository root, run:

```bash
npm run --silent mcp
```

The `--silent` option prevents npm from printing additional information to stdout.

This is important because MCP clients expect stdout to contain only valid JSON-RPC messages.

## Run the Self-Check

Execute:

```bash
node mcp-server/check.mjs -- npm run --silent mcp
```

Expected result:

```text
ok   initialize answered
ok   notification gets no reply
ok   tools/list returns your tools
ok   find_lecture has an input schema
ok   find_lecture has a real description
ok   a second tool of your own
ok   every tool has a real description
ok   find_lecture returns lecture 5
ok   a lecture that does not exist is a tool error
ok   unknown tool is a protocol error (-32602)
ok   unknown method is a protocol error (-32601)
ok   nothing but protocol on stdout

12/12 checks passed
```

## Session Transcript

The following is a cleaned-up representation of the manually tested JSON-RPC interaction. It demonstrates initialization, tool discovery, successful execution, and error handling.

```text
$ node mcp-server/server.js

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"me","version":"1.0.0"}}}
got: {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"me","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-11-25","capabilities":{"tools":{}},"serverInfo":{"name":"lectures","version":"0.1.0"}}}

{"jsonrpc":"2.0","method":"notifications/initialized"}
got: {"jsonrpc":"2.0","method":"notifications/initialized"}

{"jsonrpc":"2.0","id":2,"method":"tools/list"}
got: {"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"find_lecture","description":"Find a lecture by its number. Use this to look up a specific lecture. Returns the lecture title and topics.","inputSchema":{"type":"object","properties":{"number":{"type":"integer","description":"Lecture number from 1 to 10."}},"required":["number"]}},{"name":"count_lectures","description":"Count all available lectures. Use this to check how many lectures exist. Returns the total number of lectures.","inputSchema":{"type":"object","properties":{}}}]}}

{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"find_lecture","arguments":{"number":5}}}
got: {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"find_lecture","arguments":{"number":5}}}
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"Lecture 5: What the agent built, part 1. Topics: HTTP, REST vs GraphQL, data modeling, ORM, layers"}],"isError":false}}

{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"find_lecture","arguments":{"number":99}}}
got: {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"find_lecture","arguments":{"number":99}}}
{"jsonrpc":"2.0","id":4,"result":{"content":[{"type":"text","text":"Lecture 99 was not found."}],"isError":true}}

^C
```

## Gemini CLI Integration

The server is configured in `.gemini/settings.json` under the name `my-project`.

Running `/mcp` in Gemini CLI confirmed that the server connected successfully and exposed both tools:

```text
my-project - Ready (2 tools)

mcp_my-project_count_lectures
mcp_my-project_find_lecture
```

Gemini also successfully sent initialization and tool-discovery requests to the server.

However, the model API repeatedly returned HTTP 503 `UNAVAILABLE` errors. As a result, no successful model-initiated tool call has yet been observed.



## The Description Experiment

I changed the `find_lecture` description from a detailed explanation of its purpose, input, and output to a more general description: "Retrieves information about course content from locally stored data."

GitHub Copilot selected `find_lecture` in both experiments and successfully called it with `{"number":7}` to retrieve information about lecture 7.

I believe Copilot continued selecting the tool because its name and input schema clearly indicated its purpose, even though the updated description was less specific.


## Conclusion

The MCP server was implemented using Node.js and the built-in `readline` module.

It supports initialization, tool discovery, tool execution, and error handling using JSON-RPC over standard input and output.

The implementation passed all 12 automated checks, including execution through the npm start command.

The connection to Gemini CLI was established successfully. Verification of a model-initiated tool call remains pending.
