# Operación de agentes y protección de cuotas

La versión reutilizable y neutral al evento está en [ORCHESTRATOR-PLAYBOOK.md](../ORCHESTRATOR-PLAYBOOK.md). Este documento conserva la adaptación y el registro histórico de Sparring; para un evento futuro copia el playbook general y completa su adaptador.

La regla de Jorge está persistida en AGENTS.md. Estas son asignaciones iniciales por tipo de tarea, no una afirmación de superioridad universal de un modelo. Ajustar tras medir calidad, tiempo y uso.

| Agente | Trabajo preferido | Esfuerzo | Estado observado |
|---|---|---|---|
| Codex | Coordinar, resolver contratos, revisar evidencia y decidir gates | Medio normalmente; alto para decisiones difíciles | Al inicio 97% restante en ventanas 5h y semanal |
| Claude CLI | Voz, estado concurrente, backend, integración y revisión compleja | sonnet/medium de inicio; high sólo tras diagnóstico | Instalado, cuenta Pro reconocida, inferencia falló: OAuth expirado |
| Grok CLI 4.6 | Investigación con fuentes, QA adversa, revisión y sustitución del orquestador | medium si el modelo lo admite; default si no | Comprobado en esta sesión: autenticado en grok.com y grok-4.6 disponible |
| Agy CLI | Escenarios, UI sobre contratos estables, fixtures, documentación | gemini-3.8-flash-medium + effort medium | Catálogo y prueba mínima AUTH_OK comprobados; tareas con herramientas pueden requerir permisos headless |

No elegir modelos de Claude desde Agy para sortear una cuota agotada de Claude. Rastrear proveedor/cuenta: diferentes CLI pueden compartir cuota. Nunca rotar cuentas para eludir límites.

## Política operativa de uso

1. Antes de un lote y al terminar: observar porcentaje restante por ventana, fuente y hora. Codex permite consulta de uso de la app; Claude/Grok/Agy requieren comando documentado o pantalla de cuota/cuenta. No derivar cupo semanal de tokens de una respuesta.
2. Estado elegible si no hay aviso de agotamiento y uso permitido; si porcentaje no accesible, marcar UNKNOWN, avisar una vez y usar tareas pequeñas, sin loops desatendidos. Se pidió a Jorge confirmar cuotas externas. Su regla se activa desde el aviso, no se inventa un bloqueo por porcentaje desconocido.
3. Al aviso cercano al 10% restante de Codex o lectura ≤10%, guardar HANDOFF antes de otro despacho. Suspender agentes ≤10% (margen conservador sobre “menos de10%”). No resets, compras, fallback a API pagada ni extra usage.
4. No garantizar corte instantáneo de un proceso externo sin telemetría. Mantener invocaciones cortas; si emite aviso, cancelar por el control del proceso y preservar salida. Revisar antes del siguiente lote. No se instaló un monitor recurrente del sistema.
5. Reanudar sólo con cuota recuperada verificada o reset natural. HANDOFF registra hora de reinicio si el proveedor la muestra; nunca adivinarla.

Los créditos comprados de emergencia de los agentes y los promocionales de AssemblyAI son distintos. La estimación USD45 del plan sólo es presupuesto propuesto de AAI. No supone permiso para comprar saldo ni hosting.

## Plantilla mínima de tarea

- ID, objetivo y gate dependiente.
- Archivos propios, contexto exacto, interfaces congeladas y quién integra.
- Proyecto/generación/tier MCP, consultas/paginación/cobertura, fallback y dudas.
- Modelo/esfuerzo resueltos desde CLI; límite de duración/salida y cupo antes.
- Pruebas asignadas, fixtures y artefactos de evidencia.
- Estado final DONE/BLOCKED/FAILED y próxima decisión; nunca DONE sólo por decir que terminó.

Un agente no está solo: no revierte cambios ajenos. Si dos tareas requieren el mismo archivo, serializarlas o usar worktrees luego de existir un commit base. No usar worktrees como si aislaran cambios de servicios/cuentas.

## Tres interacciones y recuperación

Para Grok/Agy llevar ciclo y attempt1..3 por evaluación. Una interacción significa entregar una solución y evaluar sus pruebas; puede incluir llamadas de herramientas dentro de la misma tarea. Los fallos de acceso/permisos también se registran, sin intentar solucionarlos con código al azar. Puede abandonarse antes de tres si la causa es conocida.

Tras el tercer fallo: detener; orquestador identifica si problema es contrato, entorno, hipótesis o evaluación; agente investigador obtiene hasta3fuentes pertinentes (docs oficiales, upstream, issues con repro, expertos con evidencia). Registrar versión/licencia, qué se reutiliza y qué test comprueba la solución. Abrir nuevo ciclo sólo con hipótesis distinta sustentada. No borrar historia ni cambiar de agente para ocultar contador.

Claude no tiene el límite duro por petición del usuario; conservar revisiones por lote y escalar temprano si repite fallos.

## CLI comprobados y ejemplos

Ayudas consultadas: claude --help, grok --help, agy --help; grok models y agy models. Los siguientes son ejemplos para ejecutar desde la raíz una vez recuperados accesos y revisados permisos:

    Get-Content -Raw docs/task-claude-sdd.txt | claude -p --model sonnet --effort medium --permission-mode acceptEdits --allowedTools Read,Write,Edit --tools Read,Write,Edit --output-format json --max-budget-usd 1.5

    grok --model grok-4.6 --reasoning-effort medium --permission-mode plan --no-subagents --max-turns 12 --prompt-file docs/task-grok-review.txt --output-format json

    agy --print "<prompt autosuficiente>" --model gemini-3.8-flash-medium --effort medium --mode plan --print-timeout 4m --output-format json

Las 12 vueltas internas de Grok son un tope técnico por invocación, no permiso para12intentos de evaluación. Revalidar niveles admitidos por modelo antes de usar effort; no sustituir grok-4.6 en el relevo sin avisar.

Modo plan en ejemplos de revisión, permisos de escritura sólo en tareas de código. Para tests, habilitar únicamente comandos necesarios y documentados, sin bypass universal. Agy falló al necesitar permiso command en headless; se resolvió dando contexto inline y pidiendo salida sin herramientas. No se modificaron protecciones globales.

El límite --max-budget-usd de Claude es un guard de esa ejecución según su CLI, no porcentaje de suscripción ni reserva garantizada. Un resultado de auth status positivo no demuestra refresh válido: el intento de inferencia lo desmintió.

## Registro de esta sesión

| Tarea | Resultado | Evaluación del orquestador |
|---|---|---|
| Claude-SDD intento1 | Error OAuth antes de inferencia, coste reportado0 | Sin archivos; retomó Codex. No afirmar revisión Claude realizada |
| Agy-content interacción1 | Denegación command en headless | No bypass; reemitido contexto autosuficiente |
| Agy-content interacción2 | SUCCESS, modelo gemini-3.8-flash-medium,48s reportados | Borrador de escenarios/rúbrica aprovechado; fixtures e IDs necesitaron corrección |
| Revisión integración | IDs de criterios normalizados, hechos/autoridad aclarados, null/idempotencia corregidos | Se conservan expectativas sintéticas; ninguna prueba de voz ejecutada |

Salida Agy reportó32763tokens totales; no convertirlos a coste ni cuota sin telemetría. Para futuras tareas exigir salida breve o archivos acotados y desactivar contexto innecesario sólo por mecanismos documentados. Salidas brutas en .agents-runtime, excluidas del repo; no contienen claves pero no se publican.
