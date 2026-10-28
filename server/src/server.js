import { app } from './app.js';
import { config } from './config/env.js';
import { closeDatabase, connectDatabase } from './config/database.js';

let server;
try {
  await connectDatabase();
  server = app.listen(config.port, () => console.log(`Code review API listening on http://localhost:${config.port}`));
} catch (error) {
  console.error(`Startup failed: ${error.message}`);
  process.exitCode = 1;
}
async function shutdown() {
  if (server) await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
