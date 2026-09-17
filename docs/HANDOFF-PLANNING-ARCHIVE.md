# Archivo del relevo de planificación

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
