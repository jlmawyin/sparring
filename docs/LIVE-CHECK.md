# Gate G1 — primera prueba real, no aprobada

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
