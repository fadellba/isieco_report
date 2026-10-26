import { buildApp } from './app.js';
import { config } from './config.js';

async function startServer() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`[ISI-Eco Report] API REST active et à l'écoute sur http://localhost:${config.port}`);
    console.log(`[ISI-Eco Report] Base de données : PostgreSQL (${config.pg.host}:${config.pg.port}/${config.pg.database})`);
  } catch (err) {
    console.error('Erreur au démarrage du serveur API :', err);
    process.exit(1);
  }
}

startServer();
