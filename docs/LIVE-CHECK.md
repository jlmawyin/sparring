# Gate G1 — nota real verificada; continuidad pendiente

## Inicio rechazado por presupuesto local — corregido (2026-09-30 ~06:50 ECT)

La captura de inicio fallido a 00:00 se diagnosticó como `daily_limit`: 28 min reservados de un límite de 30, con reserva de 4 min por inicio y ninguna sesión activa. `d35b3a7` configura 60 min en producción sin borrar el historial, permite ese máximo en ambos servidores y muestra errores específicos sin revelar mensajes privados del proveedor. Suite completa 201/201 PASS y prueba adicional de cota superior PASS; build/spec y 8/8 E2E simuladas PASS.

Despliegue limitado a `sparring-app`, sano; asset público `index-CFX6LR85.js`. Smoke público **start 200 / end 200**, cierre inmediato sin micrófono ni WebSocket. Ledger después: **32/60 min reservados**, sin sesión activa. Edge quedó en Listo para practicar. **Inicio desbloqueado; continuidad de voz aún sin nueva verificación humana.** No atribuir este rechazo a la API ni declarar G1 PASS por la prueba de endpoints.

## Quinta prueba pública — duplicación y reversión (2026-09-30 ~06:05 ECT)

En la versión `46a7b2c`, Jorge terminó una llamada de 01:46. La UI mostró **67/100 con 65 % de cobertura**, pero repitió literalmente la objeción «Un reembolso de envío es una burla, mis operarios perdieron horas de trabajo por su culpa.» dos veces y apareció `El agente no respondió; finaliza manualmente si continúa.`. La traza optativa en Edge incluye un reply vacío, luego `recovery reply.create sent`, varios replies y dos `transcript.agent` consecutivos; no se capturaron IDs/timing exactos. Por tanto, la puntuación real está confirmada, **la continuidad G1 no**.

Se retiró el watchdog/reintento del cliente y se desplegó `1d40226` (asset `index-BinPc2yX.js`; salud pública 200; Docker sano). Tests 196/196 y build PASS. Este rollback evita que Sparring envíe un `reply.create` adicional durante roleplay; queda por comprobar una nueva toma real sin duplicación. Si la respuesta automática vuelve a quedar vacía, no ocultar la limitación ni reactivar el reintento sin una prueba discriminante.

## Prueba pública 2026-09-30 ~01:30 ECT, versión `03ebc38`

La recuperación sí produjo una réplica después de un reply vacío, pero la llamada resultó peor para Jorge: el cliente se cortó y reanudó, el usuario trató de hablar y la interacción perdió continuidad. En Edge se observaron `input.speech.started` durante una respuesta del agente, luego `reply.done completed` y `recovery reply.create sent` **antes** de `input.speech.stopped`. Tras 03:15, el coaching indicó evaluación incompleta y la UI mostró 20 % de cobertura y `—/100`. No usar esta toma como evidencia positiva.

`46a7b2c` corrige ese solapamiento: al detectar habla del usuario silencia el audio local al instante, cancela la recuperación del turno anterior e impide reintentar durante la intervención. 205/205 unitarias, build PASS y 8/8 E2E simuladas PASS; asset público `index-H7ZFJrXC.js`, Docker sano y `/api/health` 200. **La siguiente práctica humana corta está pendiente**. Si vuelve a fallar, conservar la pestaña y revisar la secuencia; no declarar G1 PASS ni grabar video por los tests.

## Cuarta prueba solicitada — bloqueo tras el primer turno

Jorge reportó que en la versión anterior el cliente simulado pronunció la apertura, recibió una respuesta USER y no volvió a hablar. Finalizó manualmente; el coaching tomó esa única respuesta y no hubo nota numérica. La UI había registrado 40 % de cobertura, así que la ausencia de nota era coherente con el umbral, pero el silencio del cliente **sí es un fallo de continuidad**. El 2026-09-30 ~01:00 ECT se publicó el fix protocolario `98025a3`: una `tool.call` que llega después de su `reply.done` ya puede devolver `tool.result` en el instante permitido. Tests 196/196, 8/8 E2E simuladas, build y salud pública PASS. Pestaña Edge de prueba abierta con `?voiceDebug=1`, que registra sólo tipos de eventos. **Resultado humano de esta cuarta prueba pendiente; no declarar G1 PASS aún.**

### Resultado humano después de `98025a3`

- En otro navegador, el cliente respondió una vez a intervenciones USER fragmentadas y formuló «¿Antes de qué? No tengo tiempo para rodeos, dígame qué solución me ofrece para compensar el tiempo perdido.» El usuario propuso reembolso del envío de USD 25 o escalar la compensación con respuesta en 4 horas hábiles, sin prometer el 30 %. No hubo réplica del cliente después de esa propuesta. La captura de coaching a 03:17 mostró **67/100 con 65 % de cobertura**. Queda verificada una nota numérica real, pero no continuidad completa ni cierre natural del roleplay.
- En Edge con `?voiceDebug=1`, Codex observó una llamada nueva con saludo, una transcripción USER y 40 % de cobertura. La secuencia de tipos tras `transcript.user` fue `reply.started` → `reply.done completed`, sin `transcript.agent`, sin `tool.call` y sin `session.error`; permaneció sin respuesta durante más de un minuto. Se detuvo a 02:02 para no consumir más crédito. Esta traza distingue un **reply vacío del proveedor** de un `tool.result` retenido por nuestro gate en esa llamada. No prueba por qué el proveedor produjo el reply vacío.
- El commit `03ebc38` ya publica una recuperación acotada: si un turno USER finalizado recibe `reply.done completed` sin audio, `transcript.agent` ni `tool.call`, espera 1 s por eventos tardíos y envía **un** `reply.create`; una segunda respuesta vacía muestra error sin entrar en bucle. Evita duplicar una respuesta cuyo audio llegó antes del texto; cancela la recuperación al terminar o cortar. Integración: 203/203 unitarias, build/spec PASS, 8/8 E2E simuladas PASS. Contenedor público sano y asset `index-CwTUkjtL.js` verificado. **La conversación humana posterior a este despliegue está en curso; no declarar continuidad aprobada por los tests.**

La llamada más reciente en otro navegador mostró 67/100 con 65 % de cobertura, pero el cliente dejó de responder tras la última propuesta. G1 completo sigue pendiente de una conversación continua. No subir API keys, tokens ni capturas del dashboard con credenciales.

1. Guardar `ASSEMBLYAI_API_KEY` en `.env` y `SPARRING_VOICE_ENABLED=true`. Ejecutar `npm run dev` y abrir http://127.0.0.1:5173 en Chrome o Edge. El archivo está ignorado por Git; la clave no debe usar prefijo `VITE_`.
2. Elegir **Entrega demorada**. Leer hechos y autoridad, aceptar procesamiento por AssemblyAI e iniciar. Confirmar saludo en español y texto coherente. Hablar al menos 90 segundos; sólo usar datos ficticios.
3. Reconocer el impacto en el equipo y preguntar qué necesita resolver primero. Observar una actualización de evidencia **durante** la llamada. Ofrecer reembolso del envío o escalamiento con respuesta en cuatro horas hábiles, sin prometer compensación extra. Comprobar una segunda actualización antes de terminar.
4. Tomar la palabra mientras habla el cliente: comprobar que su audio se corta y que no reaparecen fragmentos antiguos. Esta es interrupción del usuario hacia el agente; no afirmar interrupción inversa.
5. Terminar la práctica. Comprobar micrófono desactivado, resultado con citas y cobertura, feedback hablado coherente con el resultado y cierre automático. Si cobertura <60%, la nota global debe seguir vacía.
6. Repetir brevemente y pulsar **Cortar audio**: el indicador de micrófono del navegador debe apagarse inmediatamente. No esperar a que termine de hablar.
7. Registrar resultado aquí, con discrepancias literales entre lo dicho y lo transcrito, número de actualizaciones y cualquier error. No declarar éxito por pasar tests mock. Detener las llamadas si aparece error persistente o consumo imprevisto.

| Campo | Resultado real |
|---|---|
| Fecha/hora y persona | 2026-09-29 ~20:30 ECT, Jorge |
| Dispositivo, navegador y red | Windows, Edge, servidor local 127.0.0.1; red no registrada |
| Escenario y versión | late_delivery 1.0.0 |
| Duración, español comprensible | 183 s observados en la UI; conversación y transcripción de ambos lados. El usuario dijo que fue convincente, pero la voz habló algo rápido. |
| Dos actualizaciones antes de terminar | **No: 0 % de cobertura y ninguna puntuación al cierre**. No se observó evidencia aceptada; aún no se sabe si hubo `tool.call` rechazado o si el proveedor no lo invocó. |
| Interrupción sin audio viejo | No verificada de forma controlada. |
| Feedback y micrófono liberado | La UI terminó y mostró un siguiente paso genérico sin puntuación. No se verificó el indicador del micrófono ni coaching hablado. |
| Cierre y gasto observado en cuenta | Cierre UI observado; gasto en dashboard aún no verificado. |
| Gate | **LIVE_FAILED_SCORING** — reparar, instrumentar y repetir la prueba antes de declarar G1 PASS. |

Presupuesto de prueba propuesto: una llamada de hasta cuatro minutos; reserva local completa aunque se termine antes. El tope de 30 minutos es por proceso y no sobrevive reinicios. El coste real y la retención de datos deben comprobarse en la cuenta de AssemblyAI. Pruebas de latencia, otras plataformas y calibración humana completa siguen en TEST-PLAN.md.

## Segunda prueba humana — sitio público

Jorge probó `https://sparring.visitaremota.com/` antes del cierre del 29/30 de septiembre. Reportó que la interacción de voz fue convincente y que la aplicación dio consejos útiles, pero **la rúbrica no pudo asignar una nota numérica**. También observó que el texto del saludo aparece brevemente con palabras pegadas y que sólo el inicio del audio suena demasiado rápido; luego se normaliza. No registró porcentaje de cobertura, transcripción exacta, duración ni estado del micrófono. Por tanto, **G1 sigue parcial / sin aprobar en puntuación**. No atribuir automáticamente la falta de nota a un defecto: con cobertura menor al 60 % el diseño oculta la nota de forma deliberada. Hace falta repetir una interacción guiada y observar si aparecen evidencias y nota. Claude reprodujo en prueba sintética el defecto de separación de `transcript.agent.delta` y preparó un fix; todavía no acredita audio real ni despliegue. El ritmo inicial de síntesis aún no tiene causa verificada.

## Tercera prueba humana — tras despliegue 54c7f9f

Codex observó en Edge el resultado de la nueva llamada pública de Jorge. La transcripción visible tenía el saludo del agente y **una** respuesta del usuario; el panel mostraba **40 %** de cobertura, con empatía 2/4 e indagación 3/4, las otras tres categorías sin evidencia, nota `— /100`, y texto de coaching sobre empatía/indagación. El reloj UI marcaba `01:39 / 03:00`; no inferir por qué se cerró en ese momento. Esta prueba **sí acredita puntuación y citas para dos criterios**, pero no una nota global: el umbral de 60 % se aplicó como diseñado. No se verificó el audio del coaching en esta observación. También reveló un falso negativo de empatía: “impacto ... en la operación de su equipo” se clasificó como validación general por una ventana literal demasiado corta. Claude recibió corrección acotada. Falta una prueba con al menos dos respuestas distintas, cobertura >=60 % y nota real antes de G1 PASS.
