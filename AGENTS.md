# Sparring — instrucciones persistentes

## Objetivo y método
Construir Sparring para AssemblyAI Voice Agent Hackathon (septiembre 2026). Trabajar con SDD: especificación → contratos → pruebas → implementación → evidencia. Consultar README.md y docs/PLAN.md. No declarar DONE sin los criterios de aceptación y resultados reales. No confundir pruebas mock con llamadas reales.

Para otros eventos, usar el playbook neutral de [ORCHESTRATOR-PLAYBOOK.md](ORCHESTRATOR-PLAYBOOK.md) y completar su adaptador; este AGENTS.md conserva las reglas y el estado específicos de Sparring.

## Orquestación solicitada por Jorge
- Codex coordina; Claude CLI, Grok CLI y Agy CLI reciben tareas acotadas según capacidades comprobadas. Preferir delegación útil y contexto pequeño a duplicar trabajo.
- Al retomar, leer primero el checkpoint vigente y revisar los cambios del agente anterior. Delegar implementación y correcciones verificables a un CLI con capacidad comprobada; Codex conserva alcance, contratos, revisión de integración y decisiones. No repetir el trabajo ya validado ni reenviar el historial completo. Los subagentes internos comparten el cupo de Codex: reservarlos para casos donde aporten una ventaja concreta, no como sustituto automático de los externos.
- Revisar el cupo al abrir y cerrar cada lote, además de atender avisos. Las salidas de agentes deben indicar pruebas y hallazgos en un resumen breve; leer archivos completos sólo cuando la evidencia lo requiere. Una tarea fallida por permisos/entorno se diagnostica antes de repetirla.
- Cada tarea indica objetivo, archivos propios, dependencias, pruebas, esfuerzo, límite y formato de entrega. Los agentes comparten carpeta: no revertir cambios ajenos. No desplegar subagentes recursivos sin necesidad.
- Antes de cada lote revisar uso disponible/avisos. Al aviso de aproximadamente 10% restante en una ventana de Codex: actualizar docs/HANDOFF.md, dejar de despachar y preparar relevo a Grok CLI con modelo grok-4.6, si está autenticado y tiene cupo.
- Agente con menos de 10% restante: suspender hasta recuperación verificada. Aplicar margen conservador de parada al 10%. Nunca canjear resets, comprar créditos ni activar gasto adicional automático. Si no hay telemetría, declarar DESCONOCIDO; no inventar porcentajes. Preguntar una vez y limitar tareas; ante aviso, detener.
- Grok y Agy: máximo 3 interacciones de solución por evaluación. Si fallan, el orquestador reevalúa y exige investigación de repositorios, documentación oficial o casos de expertos comprobables antes de un nuevo ciclo. Registrar hipótesis, fuentes y prueba que discrimina. No usar reintentos ciegos. Claude no tiene ese límite estricto, pero sí revisiones por lote.
- Conservar instrucciones y contexto de relevo en archivos. No depender de memorias internas ni de que un agente herede MCP.
- Autorizado: planificar, investigar, programar y probar dentro del proyecto. No enviar mensajes a terceros, publicar submission, contratar ni gastar reservas sin instrucción específica. Credenciales sólo en variables locales/secretos del hosting; nunca chat, prompts, logs o repositorio.

## Codebase Memory (instrucción original del proyecto)
Preferir MCP a búsquedas de código: search_graph, trace_path, get_code_snippet, check_index_coverage, query_graph, get_architecture. Al iniciar o compactar, comprobar proyecto/generación con list_projects/index_status. Tier Verify por defecto; Scout provisional sin conclusiones negativas; Auditor con paginación completa en alcance acotado.
Después de encontrar rutas, check_index_coverage con cada ruta relevante y scopes para afirmaciones negativas/exhaustivas. Ausencia de gaps no prueba exhaustividad. Leer con rg/archivos rangos parciales, omitidos, excluidos, desactualizados o desconocidos antes de confiar. Usar rg para literales/config/documentos o resultados insuficientes.
Antes de delegar, pasar proyecto, generación, tier, alcance, consultas/paginación, símbolos/rutas, cobertura/fallback y dudas. Agente sin MCP no puede afirmar que lo usó: emplea evidencia recibida y lectura directa.

## Estado inicial de exploración
Sparring indexado en modo fast; generación 2026-09-16T04:28:37Z, ready, 2 nodos/1 arista. search_graph(Function, .*) = 0, has_more=false. Cobertura raíz sin incidencias registradas. Inspección directa de carpeta confirmó vacía antes de crear estos documentos. Aún no hay símbolos de aplicación ni call chains. Reindexar/consultar frescura cuando aparezca código.
