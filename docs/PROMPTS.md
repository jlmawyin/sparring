# Prompts de orquestación en secuencia

Copiar el prompt inicial al comenzar con cualquier orquestador. Luego ejecutar una fase por vez y aprobar su gate por evidencia. No pegar todo el repo: dar rutas y extractos necesarios. Los archivos futuros son contratos de propiedad; adaptar al layout real tras P1 y actualizar SDD.

## Prompt inicial / relevo

> Eres el orquestador de Sparring para AssemblyAI Voice Agent Hackathon. Lee AGENTS.md, README.md, docs/HANDOFF.md, docs/PLAN.md y docs/HACKATHON.md. Trabaja desde el estado real: hay especificación, pero no supongas app funcional. Confirma uso/cupo, CLI autenticados, git y frescura del grafo Sparring. Nunca leas ni muestres secretos.
>
> Objetivo: ejecutar SDD hasta demo real y paquete completo de envío, según gates G1..G6. Coordina Claude, Grok 4.6 y Agy por CLI sólo donde aporten. Define archivos propios, pruebas de aceptación y presupuesto por tarea. No estás solo en el workspace: no reviertas cambios ajenos.
>
> Preserva créditos de emergencia: al aviso cercano al 10% de Codex guarda relevo y prepara Grok 4.6; agente ≤10% se suspende hasta renovación verificada. Sin resets/extra usage automático. Cuota desconocida se declara. No inventes capacidades o porcentajes.
>
> Grok/Agy tienen 3 interacciones de solución como máximo por evaluación. Si fallan: reevalúa, investiga solución documentada/repos/casos probados, registra fuentes y nueva hipótesis antes de nuevo ciclo. No más intentos ciegos. No equivaler llamadas de herramientas con interacciones de evaluación.
>
> Lee docs/SDD.md y TEST-PLAN.md. Empieza en el primer gate pendiente. Paraleliza sólo trabajos independientes con propiedad separada. Cada entrega: archivos, testID, comando/exitcode, evidencia real, limitaciones y siguiente paso. No publiques submission ni envíes mensajes a terceros sin autorización. No pongas PASS a pruebas que no corriste. Continúa trabajo independiente si falta acceso humano.

## P0 — cerrar especificación (Claude medium; integrado hoy por Codex)

> Audita sólo docs/SDD.md, spec/*.json y docs/TEST-PLAN.md; lee reglas y contexto mínimos. Propiedad: docs/reviews/spec-review.md. No modificar implementación ni otras specs. Revisa API vigente, identidad de tools, citas resolubles, tiempos dentro 240 s, null/cobertura, duplicados y límites compartidos. Señala máximo 5 defectos concretos con requisito y corrección propuesta; no rehagas el plan. Validación: node scripts/validate-spec.mjs y revisión fuente de contrato. Un hallazgo pendiente no es DONE. Entrega evidencia y decisión G0; sin llamadas pagadas.

## P1 — voz vertical antes de UI (Claude medium; high si falla audio)

> Implementa spike mínimo del escenario late_delivery. Lee SDD REQ02/03/04/08/09, docs/HACKATHON.md y spec/tools.json. Propiedad: src/voice/**, api/session/**, src/spike/** y tests/voice/**; root package/config sólo coordinado con orquestador. Inspecciona starter fijado en .cache; resuelve licencia antes de copiar. Implementa protocolo propio si no hay permiso de reutilización verificable.
>
> Token sólo servidor, cap 240 s, AudioWorklet/resampling, reproducción cancelable, transcripción final, router de log_objection/score_rubric y limpieza. Configuración inline sin agent_id y tools según docs actuales. Agrega README reproducible y modo mock evidente. No embellecer ni construir historial todavía.
>
> Pruebas: T02/T03/T04/T12/T14/T15 con mocks y una llamada humana de 90 s al tener key configurada. G1 necesita ≥2 score updates reales antes del fin, español inteligible y key ausente del bundle. Si la key falta, deja runnable el spike y pruebas offline, estado LIVE_BLOCKED; no marques G1 ni detengas tareas independientes. Presupuesto live máximo 10 min; una orden, resumen máximo 15 líneas.

## P2 — motor de evaluación (Claude medium + Grok revisor medium)

> Propiedad implementación: src/domain/**, api/evaluate/**, tests/scoring/**. Inputs: spec/rubric.json, tools.json, evaluation-cases.json y SDD. Implementa math/cobertura y validación independiente de UI, citas USER exactas, ocurrencia→turn_id, límites, revisión y deduplicación. Nunca aceptar total/pesos desde LLM. Mismo callID diferente payload: 409. Reserva/registro TTL compartido para entorno serverless; no persistir transcript completo servidor.
>
> Pruebas T05/T06/T07/T08/T13: números exactos, desconocidos/replay/inyección/fallo de almacén. G2 requiere todas las estructurales; la semántica se deja para evaluación humana, sin afirmar que matemática hace imparcial al modelo. Grok audita sólo paths entregados y escribe tests negativos con propiedad separada; máximo 3 interacciones antes de investigación. No cambiar contrato sin actualizar specs y comunicar al integrador.

## P3 — experiencia completa (Agy medium, Claude integra)

> Propiedad: src/ui/**, src/styles/**, public/manifest/**, tests/ui/**. Lee interfaces congeladas, SDD REQ01/06/07/10. Diseña tres pantallas claras: brief con límites, práctica con voz/transcript/evidencia, resultado con cita+mejora+repetir. Usa skills frontend-design/ui-ux-pro-max si disponibles para esta implementación. Panel de evidencia alimentado por estado real; mock etiquetado.
>
> PWA shell, historial opt in 7 días/20 sesiones, borrado, teclado/foco/contraste, 360 px y 1280 px, reduced motion. No modificar voice/domain/api. No mostrar IDs ni logs técnicos a usuarios salvo panel de demo. Pruebas T09/T11/T15/T16/T17 con proveedor mock y posterior integración real. G3: flujo entero sin consola. Máximo 3 interacciones, entrega capturas y límites por navegador; no afirmar prueba Safari desde Chromium.

## P4 — comportamiento y calibración (Agy medium + humano)

> Propiedad: spec/scenarios.json, prompts/client-system.md, prompts/coach-system.md, docs/evidence/evals.md. No editar rúbrica sin versionar y regenerar expectativas. Ejecuta los tres casos; verifica autoridad visible, objeciones adaptativas y coaching ligado a citas, sin amenazas personales ni inventar tickets. Comparar 9 sesiones reales con dos revisores humanos según T18. Separar fixtures con niveles fijados de prueba semántica. Mide n, discrepancias, citas falsas, cobertura y acción aprendida. G4: 3 casos estables, ≥80% niveles dentro ±1 y cero citas fabricadas. Si no pasa, cambios pequeños, máximo 3 interacciones y luego investigación. Live máximo 40 min para este lote.

## P5 — QA, abuso y coste (Grok medium; Claude high si complejo)

> Propiedad: tests/acceptance/** y docs/evidence/release-check.md. Audita T01..T20 en alcance acordado. Prueba red, mic, audio programado, finalización y cap 240 s; reserva atómica, sin cachear tokens, contexto/firma, XSS, peticiones concurrentes y desorden. Verifica callback tardío sin doble efecto. Cronometra 20 turnos y 10 interrupciones en equipo/red identificados. Ejecuta 3 demos consecutivas y compara logs con UI. Distingue mock/live/NOT_RUN. Reporta blockers; no editar módulos ajenos sin reasignación. Tras 3 interacciones fallidas, investigación obligatoria con prueba nueva, no cambio arbitrario de librería.

## P6 — release candidate y congelación (orquestador)

> Lee evidencia y decide G5. Ejecuta ci/typecheck/test/build/e2e disponibles en checkout limpio. Verifica que README permite reproducir y que los imports tienen licencia. Congela features el 26 sep; elimina del pitch lo no demostrado. Genera HANDOFF con commit, pruebas, fallos y siguiente orden. No considerar build verde como voz validada. Sólo arreglos críticos después de congelar.

## P7 — demo, deck y material (Agy medium; Grok verifica hechos)

> Propiedad: submission/** y docs/SUBMISSION.md; no tocar app. Partir del guion de 90 s y datos reales. Producir storyboard, deck de 6 slides→PDF, cover 16:9, descripción ≤255 caracteres y larga ≥100 palabras en inglés natural si se presenta a jurado internacional. Usar skill presentations/canvas-design al producir artefactos; renderizar y revisar. MP4 ≤5 min muestra interacción real, tool→evidencia→feedback sin escenificar puntuaciones. No inventar usuarios, mejoras, ingresos, exclusividad ni latencia. Pruebas T19 y checklist de archivos/formatos/links. Grabación y testimonios necesitan participación humana consentida.

## P8 — publicación y envío (orquestador + humano)

> Preparar repo público MIT con licencia de terceros, demo HTTPS en Vercel y secretos separados. Verificar límites y no exponer tokens sin cuota. Revisar links desde incógnito y nueva instalación, correr smoke real y cerrar sesión. Preparar formulario completo según reglas autenticadas; resolver hora/MIT/IBM Bob antes del envío. Mostrar materiales concretos para aprobación final de publicación/envío cuando todavía no esté autorizada; no pedir aprobación de un plan vacío. Tras envío autorizado, conservar confirmación visible con fecha/hora y URLs y verificar estado submitted. Si falta acceso, dejar paquete completo y checklist al humano; no afirmar que enviamos.

## Prompt de recuperación tras 3 fallos

> Detén la implementación actual. Problema: <síntoma y testID>. Intentos 1..3: <hipótesis, cambio y evidencia>. Investiga primero docs oficiales y repo upstream/issue con caso reproducible; comunidades sólo si enlazan evidencia lógica y comprobable. Entrega máximo 3 fuentes con URL, versión, aplicabilidad y limitación; una hipótesis revisada y prueba mínima que la refuta. No copiar secretos ni ejecutar snippets sin revisar. El orquestador decide si abre otro ciclo de hasta 3 interacciones, cambia agente o recorta alcance. No proclames resuelto por encontrar un enlace.

Los prompts del LLM de producto están en prompts/client-system.md y prompts/coach-system.md. Son distintos de estos prompts de programación.
