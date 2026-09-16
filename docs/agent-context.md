# Contexto mínimo para trabajadores CLI

Idioma de documentación: español. Proyecto vacío al inicio; no hay app. Fecha local de inicio 2026-09-15, zona America/Guayaquil UTC-5. Restan aproximadamente dos semanas. SDD significa desarrollo guiado por especificaciones.

Producto: Sparring, simulación vocal de cliente difícil para entrenamiento de ventas/soporte. PWA con micrófono, 3 escenarios, 5 criterios con evidencia, tools reales durante conversación y coaching final por voz/pantalla. No telefonía, CRM, pagos, catálogo ni entrenamiento de modelos. Demo de 90s, voz española, subtítulos ingleses para jueces si procede. El scoring en vivo es requisito propio del producto, no se ha confirmado como regla del evento.

Fuentes verificadas por coordinador:
- https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon : 1–30 septiembre 2026, online, AssemblyAI obligatorio, pool 10.000 (5.000 efectivo + 5.000 créditos). Hora de cierre, 5 ganadores, tamaño equipo y MIT del evento: sin verificación independiente todavía.
- https://lablab.ai/hackathon-rules (navegador): GitHub público, URL interactiva, cover 16:9 PNG/JPG, video MP4 y slides PDF. Nombra Streamlit/Replit/Vercel. Criterios: presentación, valor comercial, tecnología, originalidad.
- https://lablab.ai/delivering-your-hackathon-solution (navegador): resumen hasta 255 caracteres, descripción al menos 100 palabras, video máximo 5 minutos, PDF. Aparece IBM Bob en guía general; aplicabilidad a este evento NO confirmada.
- https://www.assemblyai.com/docs/voice-agents/voice-agent-api : starter oficial https://github.com/AssemblyAI/voice-agent-starter-js (no asumir que la versión actual coincide con blogs anteriores).
- https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration : browser a WebSocket con token efímero del servidor. Token de un uso, TTL 1–600s; cap de sesión 60–10800s. session.end evita gracia facturable de reconexión. El starter completo resamplea audio; evitar forzar 24kHz en Safari.
- https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference : tool.call trae arguments objeto; tool.result lleva result como JSON string y call_id. Acumular resultados hasta reply.done y respetar estado de la conexión; llamadas duplicadas idempotentes. reply.done interrupted requiere detener audio programado.
- https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools : definir herramientas función inline; configuración inline y agent_id son mutuamente excluyentes en guía browser. Revalidar schema antes de implementación.
- https://www.assemblyai.com/docs/voice-agents/voice-agent-api/supported-languages : español STT/TTS, voz lola indicada. Probar acento latino real.
- https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions : barge-in del humano soportado. Interrupción deliberada del agente sobre el humano NO demostrada, es experimento con gate; no prometer.

Preferencia de arquitectura para evaluar: frontend TypeScript/React/Vite, funciones HTTP Vercel para token y scoring, browser WS directo a AAI; no relay WS en funciones. Historial local y sin audio grabado por nosotros. Scoring formativo validado servidor (no certificado antifraude), sin segundo LLM inicialmente: tool recoge observaciones con citas exactas y servidor aplica rúbrica determinista. No confundir validación de evidencia con evaluación semántica infalible. Alternativa si auditoría lo exige: observador separado detrás de gate coste/latencia.

Estado MCP: proyecto Sparring, Tier Verify, index fast generation 2026-09-16T04:28:37Z, ready, 2 nodos/1 edge; search_graph Function .* total0 has_more=false; check_index_coverage scopes[.] sin gap registrado; directorio vacío confirmado con inspección directa. No símbolos, call chains o archivos de app. Documentos creados después de esa generación; leerlos directamente. Si no hay acceso a MCP, decirlo, no inventar uso.

No estás solo en el workspace: tu orden específica define los archivos propios. No editar ni revertir otros. No leer credenciales, directorios de cuentas ni proyectos vecinos. Si aparece aviso <=10% de cupo o agotamiento, parar y reportar. No gasto extra ni resets. Sin acceso a telemetría, reconocerlo. No invocar otros agentes. Resultado conciso con archivos, decisiones, pruebas ejecutadas/no ejecutadas y dudas.
