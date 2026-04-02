import 'dotenv/config';
import { buildApp } from './app';
import { config } from './config';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.node.port, host: config.node.host });
    console.log(`Server running on ${config.node.host}:${config.node.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
