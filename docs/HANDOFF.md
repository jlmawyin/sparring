# Relevo de Sparring

## CHECKPOINT VIGENTE — 2026-09-16 20:09 ECT

**Leer esta sección primero. El contenido posterior a HISTÓRICO está superado.** Orquestador principal: **Codex de nuevo**. Grok CLI 4.6 cerró el lote que Codex dejó pendiente al agotar la ventana 5h. No reiniciar planificación. Prompt listo: `docs/task-codex-resume.txt`.

### Transmisión Grok → Codex (lo hecho, no repetir)

Grok asumió orquestación temporal según `docs/task-grok-handoff.txt` y el CHECKPOINT de 11:33 ECT. Completó los ítems 1–5 de ese checkpoint. Un ciclo de solución, sin reintentos ciegos.

**Verificado (comandos reales, exit 0):**
- `npm run typecheck`
- `npm test` **118/118** (7 archivos). Incluye el lote server que el padre no había recogido (`tests/server/app.test.ts`, 60 casos) y 7 casos nuevos de recuperación.
- `npm run build` — Vite 8.3.0, `dist/assets/index-BAoVxe85.js` ~251 kB. Grep de `dist/` sin `ASSEMBLYAI_API_KEY` ni `Bearer`.
- `npm run test:e2e` **7/7**, 15.3s. Proveedor **MOCK**. `full-stack.spec.ts` = HTTP Node real + AssemblyAI simulado (3/2/1/4/2 → 59, cobertura 100). **No es G1.**

**Código propio de este relevo (revisar diff, no reescribir):**
- `server/app.ts` — `SPARRING_MAX_SESSION_SECONDS` 60–240 (defecto 240) y `SPARRING_DAILY_MINUTES_CAP` 1–30 (defecto 30). Misma cifra en reserva, deadline, `max_seconds` y `max_session_duration_seconds`. Inválido → defecto; fuera de rango → clamp.
- `tests/server/app.test.ts` — fixture fusiona `env`; tests 90s, tope 1 min con sesiones de 60s, clamp/default.
- `src/voice/evaluateRecovery.ts` **nuevo** — timeout 3s, reintento idéntico (servidor ya idempotente), replay si `revision_conflict`, incompleto sin inventar éxito. El sobre `sent` es el que el servidor aceptó, no el envelope obsoleto.
- `src/voice/controller.ts` — `handleToolCall` usa `attemptEvaluate`; snapshot tardío puede actualizar revisión visible; tool.result de ese call sigue error si no se recuperó.
- `tests/voice/evaluateRecovery.test.ts` **nuevo** — 7 casos.
- README y `server/README.md` documentan las variables. No se tocó el starter en `.cache`.

**No hecho / no afirmar:**
- G1 LIVE_NOT_RUN. Ningún token AssemblyAI real. Ninguna práctica iniciada.
- PWA, historial, contador distribuido, calibración, video/slides/submission: pendientes según PLAN.
- `npm run validate:spec` no se reejecutó en este turno (PASS previo).

**Entorno al cerrar transmisión (20:09 ECT):**
- `npm run dev` seguía respondiendo: 5173 web, 8787 api. Health `{status:ok,key_configured:true,voice_enabled:true,mode:local}`. Loopback only.
- Clave: KEY_CONFIGURED=true, SPARRING_VOICE_ENABLED=true. Valor nunca leído ni impreso.
- Git `master` local, sin remoto: `43261a6` root (64 archivos autorizados) → HEAD `34fab80` (sobre accepted + SHA en HANDOFF). `.env` ignorado.

**Memoria:** Sparring fast, generación `2026-09-16T16:31:39Z`, 435 nodos / 1045 aristas, ready. Excluidos por diseño: `docs/`, `scripts/`, `tests/e2e/`, `tests/**/*.test.ts` (fast-pattern). Tests leídos en fuente. Tras más código, reindexar; no reutilizar conclusiones del índice 161 nodos.

### Próximo trabajo concreto (Codex)

1. Comprobar cupo propio (`get_usage_limits` o equivalente). Si 5h sigue ~0% o `ordinaryUsageAllowed=false`, no despachar lotes; G1 humano no gasta Codex. Si recuperó, orquestar con margen de parada 10%. Sin resets ni extra usage.
2. **G1 con persona** — `docs/LIVE-CHECK.md`. Si `npm run dev` cayó: relanzar, health, no mintear token hasta gesto+consentimiento. Una llamada ≤4 min. No declarar G1 por e2e mock.
3. Revisión padre del diff Grok (`evaluateRecovery` + cuotas). No revertir. Si G1 pasa: anotar LIVE-CHECK y seguir PLAN (PWA/historial, cuota distribuida, submission). No desplegar adaptador Map local.

### Agentes

- Grok 4.6: lote cerrado. No asignarle de nuevo las mismas pruebas/cuotas/timeout.
- Claude: 3 lotes voz ya hechos; no reanudar sin cupo. Sesión previa `da4c0a80-7b63-4b73-af32-ef9c573f4a46`.
- Agy: ciclo 503 descartado; no reintento ciego.
- Codex worker `/root/local_backend`: interrumpido por cuota; no reactivar en frío. El padre ya recogió sus tests (118 PASS).
- Cuota Grok: DESCONOCIDO. Parar al aviso ≤10%. Máximo 3 interacciones Grok/Agy por evaluación nueva.

### Comando de relevo a Codex

Leer `docs/task-codex-resume.txt` (también abajo). Pegar en Codex desde esta carpeta. No usar el prompt histórico de planificación.

## HISTÓRICO — planificación previa (no estado vigente)

Actualizado: 2026-09-15 ECT / 2026-09-16 UTC. Orquestador: Codex. Sustituto solicitado: Grok CLI 4.6. Este documento es un checkpoint, no indicación de que Codex agotó cuota.

## Estado real

- Preparación SDD terminada y validada: node scripts/validate-spec.mjs terminó con exitcode0 y PASS. Evidencia en docs/evidence/planning-validation.json; sólo consistencia de especificación, producto NOT_RUN.
- Carpeta inicialmente vacía; hoy contiene documentos, prompts y contratos/fixtures. No app, deployment, API calls de voz, video, PDF ni submission.
- Se investigó evento, guías, docs AAI actuales y competencia. Hora exacta de cierre, MIT específico, equipo/eligibilidad e IBM Bob quedan pendientes de portal autenticado.
- Se clonó starter en .cache (ignorado), commit11b4c9508bef682785e8bdf23d5170b30aafb7a6; no se ejecutó. No se encontró archivo LICENSE en revisión inicial; no copiar al código MIT hasta resolver licencia.
- Reindexación al cierre: Sparring fast,161nodos/160aristas; índice excluye docs y scripts por diseño, además de .cache y .agents-runtime. Leer directamente esas rutas para validar; no interpretar exclusión como ausencia. Pedir index_status/check_index_coverage para generación vigente.
- En la comprobación de esta sesión, Grok quedó autenticado en grok.com con grok-4.6; Agy respondió AUTH_OK con gemini-3.8-flash-low sin herramientas. Claude reportó loggedIn:false y ahora tiene un flujo claude auth login abierto, esperando que el usuario complete el navegador/código. No afirmar revisión de Claude/Grok realizada.
- Memoria estructural al cierre: proyecto Sparring, generación 2026-09-16T04:49:11Z, modo fast, estado ready, 161 nodos/160 aristas. `docs/`, `scripts/`, `.cache/` y `.agents-runtime/` están excluidos por diseño; se leyeron directamente las rutas relevantes. No hay repo Git propio todavía.
- AGENTS.md fija reglas de coordinación, cuotas y3interacciones. No se activaron resets ni compras.

## Próxima orden concreta

Ejecutar P1 de docs/PROMPTS.md, luego P2. Puede programarse y probarse offline aunque falte API key. G1 sólo cierra con llamada real en español y herramientas de scoring antes del final. No gastar tiempo en UI completa antes de demostrar voz+tool.

1. Confirmar autenticación y cuota externa. Para Grok, modelo grok-4.6 debe aparecer en grok models y login ser válido; para Claude, auth status no basta si refresh falla.
2. Consultar index_status del grafo Sparring y coverage para código nuevo; estado inicial fast generation2026-09-16T04:28:37Z,2nodes/1edge y cero funciones, documentos posteriores fuera de esa referencia.
3. Leer SDD, TEST-PLAN y tools/scenarios/rubric. Ejecutar node scripts/validate-spec.mjs.
4. Crear proyecto app con scripts de build/tests y lockfile. Respetar separación voice/domain/ui y sin secretos cliente.
5. Preparar .env local sin imprimir valores; si no hay acceso a AAI, dejar spike mock etiquetado y gate LIVE_BLOCKED.
6. Registrar resultados, revisar cambios y actualizar este archivo antes de un relevo.

## Decisiones a preservar

- React/Vite TypeScript, funciones HTTP Vercel, browser WSS directo con token efímero.
- Inline config con tools cliente, no agent_id mezclado.
- Roleplay180s, finalización≤20s y coaching≤40s dentro240s totales.
- Score propuesto por actor, evidencia validada servidor, matemática determinista; formativo, no antifraude ni científicamente validado.
- Cinco criterios20/20/25/20/15, niveles0..4/null y totalnull si cobertura<60%.
- start_scenario/save_session app; log_objection/score_rubric tools reales.
- Historial local opt in, no audio grabado por app; revisar retención del proveedor.
- Cuota global atómica y kill switch antes de demo pública. Reserva minutos incluso en desconexión.
- No prometer interrupción agente→humano hasta pasarT20; humano→agente se prueba enT03.

## Pendientes del usuario (ya preguntados, no repetir sin necesidad)

- Cupo/facturación de Claude, Grok y Agy, horas humanas disponibles e integrantes.
- Restaurar login Claude y Grok.
- Portal lablab: hora/zona exacta y requisitos MIT/IBM Bob; equipo creado además de Enrolled.
- API key por archivo local y confirmación de acceso/saldo, antes de primera llamada. No enviar por chat.
- GitHub/hosting al preparar publicación. No necesarios para trabajar en contratos.

## Cuotas y relevo

Consulta inicial Codex:97% restante5h y97% semanal. Última consulta antes de cierre de planificación:41% restante5h y88% semanal; saldo de créditos sin cambio, sin resets consumidos. Fuente: get_usage_limits de la app. Es una foto, no estado perpetuo; reconsultar antes de despachar. Externos UNKNOWN, sin aviso recibido de≤10%; autenticación y cuota son distintos. Al aviso cercano al umbral: parar nuevos lotes, guardar trabajo/estado de procesos, actualizar uso+fuente+reset, diffs/commit, pruebas y siguiente comando. Relevo manual hacia Grok4.6 autenticado con cupo; no hay cambio automático garantizado.

No quedan procesos CLI activos de estas tareas. Las salidas brutas se guardaron en .agents-runtime. El directorio no se convirtió aún en repositorio Git propio ni se creó commit; hacerlo al iniciar implementación después de comprobar si hay repositorio padre.

## Plantilla de actualización

Último commit/diff: <consultar git, no inventar>.
Gate actual / tarea / dueño / archivos: <...>.
Pruebas y evidencias: <comando, exitcode, ruta, mock/live>.
Agentes activos y sesión reanudable: <...>.
Cuotas / hora / reset natural: <...>.
Bloqueos y trabajo independiente: <...>.
Siguiente orden mínima: <...>.
