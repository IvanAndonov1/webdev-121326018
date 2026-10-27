
const readline = require('node:readline');


const fs = require('node:fs');
const path = require('node:path');

const lectures = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'lectures.json'), 'utf8')
);


const SERVER_INFO = {
  name: 'lectures',
  version: '0.1.0',
};

function send(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}


function getTools() {
  return [
    {
      name: 'find_lecture',
      description: 'Retrieves information about course content from locally stored data.',
      inputSchema: {
        type: 'object',
        properties: {
          number: {
            type: 'integer',
            description: 'Lecture number from 1 to 10.',
          },
        },
        required: ['number'],
      },
    },
    {
      name: 'count_lectures',
      description: 'Count all available lectures. Use this to check how many lectures exist. Returns the total number of lectures.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}



function toolResponse(id, text, isError = false) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text }],
      isError,
    },
  };
}


function rpcError(id, code, message) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
    },
  };
}



function callTool(id, name, args = {}) {
  switch (name) {
    case 'find_lecture': {
      const lecture = lectures.find(
        (item) => item.number === args.number
      );

      if (!lecture) {
        return toolResponse(
          id,
          `Lecture ${args.number} was not found.`,
          true
        );
      }

      const text = `Lecture ${lecture.number}: ${lecture.title}. Topics: ${lecture.topics}`;

      return toolResponse(id, text);
    }

    case 'count_lectures': {
      return toolResponse(
        id,
        `Total lectures: ${lectures.length}`
      );
    }

    default:
        return rpcError(id, -32602, `Unknown tool: ${name}`);
  }
}



function handle(message) {
  switch (message.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: message.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: getTools(),
        },
      };

    case 'tools/call':
        return callTool(
            message.id,
            message.params.name,
            message.params.arguments
        );

    case 'notifications/initialized':
      return null;


    default:
    if (message.id !== undefined) {
        return rpcError(
        message.id,
        -32601,
        `Unknown method: ${message.method}`
        );
    }

    return null;

  }
}


const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  console.error(`got: ${line}`);

  try {
    const message = JSON.parse(line);
    const response = handle(message);

    if (response !== null) {
      send(response);
    }
  } catch (error) {
    console.error(`Error processing message: ${error.message}`);
  }
});
