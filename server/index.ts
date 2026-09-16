import { createApp } from './app.ts';

const server = createApp();
server.listen(8787, '127.0.0.1', () => {
  console.info('Sparring local: http://127.0.0.1:8787 (cuotas y sesiones sólo en este proceso)');
});
server.on('error', () => {
  console.error('No se pudo iniciar el servidor local de Sparring.');
  process.exitCode = 1;
});

function stop(): void {
  server.close();
  server.closeAllConnections();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
