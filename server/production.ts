import { createProductionApp } from './productionApp.ts';

const port = Number(process.env.PORT) || Number(process.env.SPARRING_PORT) || 8788;
const host = process.env.SPARRING_HOST || '0.0.0.0';

const server = createProductionApp();
server.listen(port, host, () => {
  console.info(`Sparring producción: escuchando en ${host}:${port}`);
});
server.on('error', error => {
  console.error('No se pudo iniciar el servidor de producción de Sparring.', error);
  process.exitCode = 1;
});

function stop(): void {
  server.close();
  server.closeAllConnections();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
