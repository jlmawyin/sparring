# Sparring

[Read this README in English](README.en.md).

Entrena conversaciones difíciles con un cliente simulado por voz. Tres escenarios ficticios, cinco criterios de evaluación, citas de evidencia y coaching al finalizar. Proyecto para AssemblyAI Voice Agent Hackathon, septiembre de 2026.

## Estado

React/TypeScript, audio del navegador, WebSocket directo a AssemblyAI y evaluación determinista en servidor. La [demo pública](https://sparring.visitaremota.com/) sirve frontend y API desde Contabo. Una llamada humana pública mostró una nota real de **67/100 con 65 % de cobertura**. La continuidad de la voz sigue siendo experimental: algunas respuestas automáticas del proveedor han terminado vacías; se retiró un reintento del cliente que duplicaba la voz. Las pruebas automatizadas simulan AssemblyAI y no prueban que cada llamada real continúe sin interrupciones. Estado y limitaciones vigentes en [HANDOFF](docs/HANDOFF.md).

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

El adaptador **local** escucha sólo en loopback, puerto 8787. `SPARRING_MAX_SESSION_SECONDS` (60–240, por defecto 240) y `SPARRING_DAILY_MINUTES_CAP` (1–60, por defecto 30) acotan reserva, deadline y duración del token. Su contador es por proceso y se reinicia al reiniciar el servicio; no se publica este adaptador. El despliegue de la entrega usa un límite explícito de 60 minutos reservados al día y conserva el consumo acumulado entre reinicios.

La aplicación evalúa cada turno final del participante. Por defecto, `SPARRING_SCORING_MODE=local` aplica reglas conservadoras a señales explícitas de la transcripción, sin una llamada adicional al modelo; el servidor comprueba las citas literales y calcula la rúbrica. La modalidad opcional `gateway` usa una función forzada de [AssemblyAI LLM Gateway](https://www.assemblyai.com/docs/llm-gateway/agentic-workflows), sólo para cuentas con acceso a sus modelos. Los `tool.call` espontáneos del Voice Agent siguen aceptándose. Las notas son formativas: las reglas pueden omitir una buena respuesta expresada de otra manera y ninguna modalidad certifica el desempeño.

El adaptador **de producción** sirve `dist/` y `/api` desde un mismo origen y persiste la cuota global en un archivo con reserva atómica; su configuración está en [server/README.md](server/README.md). El despliegue usa un contenedor Docker en Contabo detrás de Nginx y Cloudflare, con `.env` privado fuera de la imagen y de Git. El archivo de cuota se guarda en un volumen persistente.

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
