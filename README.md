# Sparring

[Read this README in English](README.en.md).

Entrena conversaciones difíciles con un cliente simulado por voz. Tres escenarios ficticios, cinco criterios de evaluación, citas de evidencia y coaching al finalizar. Proyecto para AssemblyAI Voice Agent Hackathon, septiembre de 2026.

## Estado

React/TypeScript, audio del navegador, WebSocket directo a AssemblyAI y evaluación determinista en servidor. La interfaz está publicada en [sparring.visitaremota.com](https://sparring.visitaremota.com/). El adaptador Node de producción está construido y probado localmente; su instalación en el hosting y la llamada humana del gate G1 siguen pendientes. Las pruebas automatizadas simulan AssemblyAI y no sustituyen una llamada real. Estado y limitaciones vigentes en [HANDOFF](docs/HANDOFF.md).

## Ejecutar localmente

Requiere Node.js 24 y npm. Desde esta carpeta:

```powershell
npm ci
# Sólo si .env no existe:
Copy-Item .env.example .env
```

Edita `.env` localmente: pega tu clave tras `ASSEMBLYAI_API_KEY=` y cambia `SPARRING_VOICE_ENABLED=true`. No envíes el valor por chat, no lo pegues en la página ni uses un prefijo `VITE_`. El archivo está excluido de Git.

```powershell
npm run dev
```

Abre http://127.0.0.1:5173 en Chrome o Edge, selecciona un caso, lee los límites, acepta el procesamiento de voz y permite el micrófono. Si modificas `.env` con el servicio iniciado, reinícialo. “Cortar audio” libera el micrófono. Cada práctica reserva hasta cuatro minutos del cupo local, incluidos feedback y márgenes.

El adaptador **local** escucha sólo en loopback, puerto 8787. `SPARRING_MAX_SESSION_SECONDS` (60–240, por defecto 240) y `SPARRING_DAILY_MINUTES_CAP` (1–30, por defecto 30) acotan reserva, deadline y duración del token. Su contador es por proceso y se reinicia al reiniciar el servicio; no se publica este adaptador.

El adaptador **de producción** sirve `dist/` y `/api` desde un mismo origen y persiste la cuota global en un archivo con reserva atómica; su empaquetado y configuración de cPanel están en [server/README.md](server/README.md). La clave sólo debe guardarse como variable de entorno del hosting, y el archivo de cuota debe estar fuera del document root. Hasta completar ese despliegue, la URL pública muestra los escenarios como vista previa con la voz deshabilitada.

## Verificar

```powershell
npm run validate:spec
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas no necesitan clave ni llaman a AssemblyAI. Playwright usa micrófono sintético y HTTP/WebSocket simulados. Capturas en `output/playwright`, informes en `test-results` (ambos ignorados por Git). Los fixtures semánticos de `spec/evaluation-cases.json` siguen siendo expectativas; requieren evaluación humana con llamadas reales.

## Contratos y orquestación

- [Plan y calendario](docs/PLAN.md), [SDD](docs/SDD.md), [pruebas y gates](docs/TEST-PLAN.md).
- [Reglas verificadas y fuentes](docs/HACKATHON.md), [checklist de entrega](docs/SUBMISSION.md).
- [Reglas para agentes](AGENTS.md), [playbook reutilizable](ORCHESTRATOR-PLAYBOOK.md), [registro de orquestación](docs/ORCHESTRATION.md).
- [Prompts de trabajo](docs/PROMPTS.md), [cliente](prompts/client-system.md), [coach](prompts/coach-system.md).

No guardamos audio en esta aplicación. El proveedor procesa la voz según las condiciones de tu cuenta. La puntuación es formativa: verifica citas y cálculo, pero no certifica el juicio semántico de la IA ni protege frente a manipulación del navegador. Historial opt in, PWA, calibración humana y entrega del hackathon siguen pendientes.

Código propio bajo [MIT](LICENSE). El starter oficial clonado en `.cache` se excluye del repositorio y no se copia: su licencia sigue pendiente de verificación.
