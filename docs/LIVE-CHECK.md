# Gate G1 — pruebas reales, puntuación aún no verificada

## Cuarta prueba solicitada — bloqueo tras el primer turno

Jorge reportó que en la versión anterior el cliente simulado pronunció la apertura, recibió una respuesta USER y no volvió a hablar. Finalizó manualmente; el coaching tomó esa única respuesta y no hubo nota numérica. La UI había registrado 40 % de cobertura, así que la ausencia de nota era coherente con el umbral, pero el silencio del cliente **sí es un fallo de continuidad**. El 2026-09-30 ~01:00 ECT se publicó el fix protocolario `98025a3`: una `tool.call` que llega después de su `reply.done` ya puede devolver `tool.result` en el instante permitido. Tests 196/196, 8/8 E2E simuladas, build y salud pública PASS. Pestaña Edge de prueba abierta con `?voiceDebug=1`, que registra sólo tipos de eventos. **Resultado humano de esta cuarta prueba pendiente; no declarar G1 PASS aún.**

La primera llamada con persona sí ocurrió; aún no acredita G1 porque no hubo puntuación en vivo. No subir API keys, tokens ni capturas del dashboard con credenciales.

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
