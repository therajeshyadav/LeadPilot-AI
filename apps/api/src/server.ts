import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { createRuntimeDependencies } from "./config/runtime-dependencies.js";

const config = loadConfig();
const runtime = createRuntimeDependencies(config);
const app = createApp(config, runtime.services);

const server = app.listen(config.PORT, () => {
  console.info(`LeadPilot API listening on port ${config.PORT}`);
});

async function shutdown(signal: string) {
  console.info({ signal }, "Stopping LeadPilot API");
  server.close((error) => {
    if (error) {
      console.error(error, "Graceful shutdown failed");
      process.exitCode = 1;
    }
  });
  await runtime.disconnect();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
