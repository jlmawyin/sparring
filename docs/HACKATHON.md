# Reglas, fuentes y decisiones

Verificado el 15 de septiembre de 2026 ECT (16 septiembre UTC). Las reglas específicas del evento y el formulario autenticado prevalecen sobre guías generales. No asumir que las notas iniciales equivalen a reglas confirmadas.

| Tema | Evidencia | Acción / estado |
|---|---|---|
| Evento | [Página oficial](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon): online, 1–30 septiembre, registro durante el periodo | Confirmado |
| Tecnología | Misma página: construir sobre AssemblyAI | Integración de voz real en camino principal; mock sólo para desarrollo |
| Premio | Misma página: pool USD10.000, dividido en USD5.000 efectivo y USD5.000 créditos | Reparto de cinco ganadores de las notas: pendiente |
| Equipo | [FAQ](https://lablab.ai/guide): todos inscritos y pertenencia a equipo incluso si se participa solo | Usuario reporta Enrolled; confirmar equipo creado. Límite 1–6 no verificado |
| Materiales | [Rule Book](https://lablab.ai/hackathon-rules), leído en navegador: repo GitHub público, URL interactiva, PNG/JPG 16:9, MP4 y PDF | Incluir todos |
| Textos | [Submission Guidelines](https://lablab.ai/delivering-your-hackathon-solution), navegador: descripción corta ≤255 caracteres, larga ≥100 palabras, tags, video ≤5min | Preparar guion de90s, exportar MP4 y slides PDF |
| Hosting | Rule Book nombra Streamlit, Replit o Vercel; guía los presenta como opciones | Elegir Vercel para evitar ambigüedad, funciones HTTP y WS directo desde browser |
| Licencia | No se encontró MIT en los textos visibles consultados | MIT como decisión propia; verificar el formulario |
| IBM Bob | La guía general menciona reporte de IBM Bob | No extrapolarlo automáticamente: confirmar aplicabilidad en el evento |
| Cierre | Página pública sólo delimita 1–30sep; notas dicen aprox.30sep10:00ECT | Hora NO confirmada. Objetivo interno: envío29sep antes18:00ECT, adelantable si cambia el cierre |

No se contará con una extensión o envío manual tardío. Verificar hora con zona y convertir a America/Guayaquil (UTC−5); no convertir desde una abreviatura ambigua.

## Trazabilidad de evaluación

Los cuatro ejes publicados son tecnología, presentación, valor comercial y originalidad. No se encontraron pesos oficiales: no inventarlos.

| Eje | Evidencia que construiremos | Criterio interno de salida |
|---|---|---|
| Tecnología | AAI procesa audio, tools actualizan evidencia durante llamada, respuesta vocal y reconexión | Grabación real con timestamps y request IDs redactados; 3sesiones seguidas correctas |
| Presentación | Problema claro, conversación breve, objeción, score explicado, repetición | En90s un espectador entiende quién lo usa y qué mejora |
| Valor comercial | Practicar sin arriesgar relación comercial, foco equipos pequeños de soporte/ventas en español | 3entrevistas breves + 5pruebas de uso; reportar datos observados sin afirmar ROI no medido |
| Originalidad | Dificultad que responde a conducta, evidencia por criterio, límites comerciales, repetición comparable | Mostrar al menos una decisión de puntuación explicada y una corrección practicada |

## Acciones humanas necesarias

- Confirmar equipo inscrito, elegibilidad, hora exacta, MIT/IBM Bob y campos del formulario en lablab.
- API key sólo en `.env` y luego secreto del hosting. Confirmar acceso a Voice Agent API y saldo real antes de llamadas.
- Restaurar Claude/Grok; confirmar cuotas y desactivar consumo adicional de reservas en sus cuentas si existe ese ajuste.
- Identificar cuenta GitHub/repositorio y proyecto Vercel al preparar publicación. No pedir estos accesos para terminar la especificación.

## Fuentes técnicas y reutilización

- [Quickstart y starter oficial](https://www.assemblyai.com/docs/voice-agents/voice-agent-api).
- [Browser/token/audio](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration).
- [Eventos](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/events-reference) y [tools cliente](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/tools/client-side-tools).
- [Idiomas](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/supported-languages) y [interrupciones](https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions).
- [Precio publicado del producto](https://www.assemblyai.com/products/voice-agent-api): USD4,50/hora de conexión; validar cuenta/campaña antes de gastar.

Se clonó para inspección `.cache/voice-agent-starter-js`, commit `11b4c9508bef682785e8bdf23d5170b30aafb7a6`, del [repositorio AssemblyAI](https://github.com/AssemblyAI/voice-agent-starter-js). No se ejecutó el starter ni su publicación. No se encontró archivo raíz `LICENSE`; revisar todos los archivos de licencia y permiso de reutilización antes de incorporar su código al repo MIT. Alternativa: implementar el protocolo documentado con código propio. El starter se mantiene fuera de distribución.
