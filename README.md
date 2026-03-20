# swagger-mcp-toolkit

An MCP server for Swagger/OpenAPI definitions: connects to a Swagger spec and helps AI/clients quickly explore endpoints/models and generate MCP tool definition code.

This project is adapted from the upstream project: https://github.com/Vizioz/Swagger-MCP

## Changes in this fork

- Enhanced Swagger 2.0 definition support (while retaining the original swagger-mcp capabilities)
- Added Knife4j / KnifeHeader handling: supports custom `headers`, plus `gatewayHeader` / `gatewayCode` passthrough
- Added `swagger-resources` support: new `listSwaggerResources` and `saveSwaggerResources` tools

## Features

- Downloads a Swagger specification and stores it locally for faster reference.
- Fetches Knife4j `swagger-resources` and supports saving them locally for module selection.
- Returns a list of all the endpoints and their HTTP Methods and descriptions
- Returns a list of all the models
- Returns a model
- Returns service to connect to the end point
- Returns MCP function definitions
- Generates complete MCP tool definitions with full schema information
- Includes AI-specific instructions in tool descriptions

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:

```
git clone https://github.com/ZTrainWilliams/swagger-mcp-toolkit.git
cd swagger-mcp-toolkit
```

2. Install dependencies:

```
npm install
```

3. Create a `.env` file based on the `.env.example` file:

```
cp .env.example .env
```

4. Update the `.env` file.

## Configuration

Edit the `.env` file to configure the application:

- `PORT`: The port on which the server will run (default: 3000)
- `NODE_ENV`: The environment (development, production, test)
- `LOG_LEVEL`: Logging level (info, error, debug)

## Usage

### Building the application

Build the application:

```
npm run build
```

This will compile the TypeScript code ready to be used as an MCP Server

### Running as an MCP Server

To run as an MCP server for integration with Cursor and other applications:

```
node build/index.js
```

You can also provide a Swagger URL via CLI argument:

```
node build/index.js --swagger-url="https://petstore.swagger.io/v2/swagger.json"
```

Or using the alternative format:

```
node build/index.js --swaggerUrl="https://petstore.swagger.io/v2/swagger.json"
```

**Note**: The CLI `--swagger-url` argument takes priority over the `swaggerFilePath` parameter in tool calls. If both are provided, the CLI argument will be used.

### Running via npm (npx)

If you publish this project as an npm package named `swagger-mcp-toolkit`, you can run it without cloning:

```
npx -y swagger-mcp-toolkit@latest --swagger-url="https://petstore.swagger.io/v2/swagger.json"
```

### Using the MCP Inspector

To run the MCP inspector for debugging:

```
npm run inspector
```

### Adding to Cursor

To add this MCP server to Cursor:

1. Open Cursor Settings > Features > MCP
2. Click "+ Add New MCP Server"
3. Enter a name for the server (e.g., "Swagger MCP Toolkit")
4. Select "stdio" as the transport type
5. Enter the command to run the server:
   - Basic: `node path/to/swagger-mcp-toolkit/build/index.js`
   - With Swagger URL: `node path/to/swagger-mcp-toolkit/build/index.js --swagger-url="https://your-api-url/swagger.json"`
6. Click "Add"

The Swagger MCP tools will now be available to the Cursor Agent in Composer.

**Tip**: If you provide the `--swagger-url` CLI argument when configuring the server, you won't need to provide `swaggerFilePath` in tool calls, making the tools easier to use.

### Custom MCP config examples

Local build usage:

```json
{
  "mcpServers": {
    "get-swagger": {
      "command": "node",
      "args": [
        "C:/projects/swagger-mcp-toolkit/build/index.js",
        "--swagger-url=http://xxx.xx.xx.xx:xxxxxx"
      ],
      "env": {}
    }
  }
}
```

npm (npx) usage:

```json
{
  "mcpServers": {
    "get-swagger": {
      "command": "npx",
      "args": [
        "-y",
        "swagger-mcp-toolkit@latest",
        "--swagger-url=http://xxx.xx.xx.xx:xxxxxx"
      ],
      "env": {}
    }
  }
}
```

### Available Swagger MCP Tools

The following tools are available through the MCP server:

- `getSwaggerDefinition`: Downloads a Swagger definition from a URL
- `listSwaggerResources`: Fetches Knife4j `swagger-resources` for module selection
- `saveSwaggerResources`: Fetches Knife4j `swagger-resources` and saves them as a JSON file
- `listEndpoints`: Lists all endpoints from the Swagger definition (optional `swaggerFilePath`)
- `listEndpointModels`: Lists all models used by a specific endpoint (optional `swaggerFilePath`)
- `generateModelCode`: Generates TypeScript code for a model (optional `swaggerFilePath`)
- `generateEndpointToolCode`: Generates TypeScript code for an MCP tool definition (optional `swaggerFilePath`)

**Swagger Definition Priority**: The tools determine which Swagger definition to use based on this priority:
1. CLI `--swagger-url` argument (if provided when starting the server)
2. `swaggerFilePath` parameter (if provided in the tool call)
3. Error if neither is available

If you start the server with `--swagger-url`, you can omit the `swaggerFilePath` parameter in tool calls for convenience.




## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## MCP Prompts for AI Assistants

To help AI assistants use the Swagger MCP tools effectively, we've created a collection of prompts that guide them through common tasks. These prompts provide step-by-step instructions for processes like adding new endpoints, using generated models, and more.

Check out the [PROMPTS.md](./PROMPTS.md) file for the full collection of prompts.

Example use case: When asking an AI assistant to add a new endpoint to your project, you can reference the "Adding a New Endpoint" prompt to ensure the assistant follows the correct process in the right order.
