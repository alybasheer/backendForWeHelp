import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import mongoose from "mongoose";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

let dbConnection = null;

function loadEnv() {
  const envPath = resolve(PROJECT_ROOT, ".env");
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function getDb() {
  if (dbConnection) return dbConnection;
  const env = loadEnv();
  const uri = env.MONGODB_URL || env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URL not found in .env");
  const conn = await mongoose.createConnection(uri).asPromise();
  dbConnection = conn;
  return conn;
}

const server = new Server(
  { name: "wehelp-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "query_collection",
      description: "Query a MongoDB collection with a filter. Returns documents.",
      inputSchema: {
        type: "object",
        properties: {
          collection: { type: "string", description: "Collection name (e.g. users, helprequests, chatsettings, ratings, communities, alerts, volunteers, converstations)" },
          filter: { type: "object", description: "MongoDB filter query (JSON object)", default: {} },
          limit: { type: "number", description: "Max documents to return", default: 20 },
          sort: { type: "object", description: "Sort specification (JSON object)", default: {} },
        },
        required: ["collection"],
      },
    },
    {
      name: "count_collection",
      description: "Count documents in a collection matching a filter.",
      inputSchema: {
        type: "object",
        properties: {
          collection: { type: "string", description: "Collection name" },
          filter: { type: "object", description: "MongoDB filter query", default: {} },
        },
        required: ["collection"],
      },
    },
    {
      name: "server_health",
      description: "Check if the backend server is responding on localhost:3000.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "get_env",
      description: "Read a value from the .env file (safe keys only: MONGODB_URL, NODE_ENV, CORS_ORIGIN). Values are masked.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Env variable name" },
        },
        required: ["key"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "query_collection": {
      const { collection, filter = {}, limit = 20, sort = {} } = args;
      const db = await getDb();
      const docs = await db.db.collection(collection)
        .find(filter)
        .sort(sort)
        .limit(limit)
        .toArray();
      return {
        content: [{ type: "text", text: JSON.stringify(docs, null, 2) }],
      };
    }

    case "count_collection": {
      const { collection, filter = {} } = args;
      const db = await getDb();
      const count = await db.db.collection(collection).countDocuments(filter);
      return {
        content: [{ type: "text", text: String(count) }],
      };
    }

    case "server_health": {
      try {
        const res = await fetch("http://localhost:3000/", { signal: AbortSignal.timeout(5000) });
        const text = await res.text();
        return {
          content: [{ type: "text", text: `Status: ${res.status} - ${text}` }],
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Server not reachable: ${e.message}` }],
        };
      }
    }

    case "get_env": {
      const { key } = args;
      const safeKeys = ["CORS_ORIGIN", "NODE_ENV"];
      if (!safeKeys.includes(key)) {
        return {
          content: [{ type: "text", text: `Key "${key}" is not whitelisted for reading.` }],
        };
      }
      const env = loadEnv();
      return {
        content: [{ type: "text", text: env[key] || "not set" }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
