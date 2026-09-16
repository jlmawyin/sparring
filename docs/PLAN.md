# Plan de ejecución SDD — v1

SDD = desarrollo guiado por especificaciones. Cada incremento cierra requisito → contrato → prueba → código → evidencia. Este plan completa la fase de preparación; las fases de producto siguen pendientes.

## Decisión de producto

Sparring es un gimnasio breve de conversaciones difíciles para equipos pequeños de ventas y soporte en español. Un cliente simulado plantea resistencia; el usuario practica, ve qué conductas sustentan su evaluación y repite una respuesta mejorada. El objetivo del hackathon es demostrar ese ciclo completo y fiable.

P0: un escenario completo (`late_delivery`), voz bidireccional real, tool de scoring durante llamada, fin con coaching y evidencia. P1 del alcance final: otros dos escenarios, historial local, repetir, PWA instalable y accesibilidad. P2 opcional después de gates: interrupción proactiva del agente, comparación de intentos. Fuera: CRM, telefonía, WhatsApp, pagos, equipos/multiusuario, catálogo, analítica de emociones, gamificación compleja, avatar3D y entrenar modelos.

La categoría ya existe: [Yoodli](https://yoodli.ai/solutions/sales-roleplay) y [Second Nature](https://secondnature.ai/) ofrecen simulación comercial. No presentar la idea como la primera. Nuestra hipótesis diferenciadora es la práctica breve en español con objeciones adaptativas y puntuación sustentada en citas y políticas del caso. Validarla con usuarios, no deducir ventaja competitiva sólo por usar herramientas.

## Secuencia y calendario

Base provisional: un builder humano disponible3–4h/día + agentes por tareas, unas40–50h humanas. Fechas ECT. Si disponibilidad menor, recortar alcance opcional antes que evidencia/entrega.

| Fase / prompt | Fecha objetivo | Trabajo y propietario previsto | Gate para avanzar |
|---|---|---|---|
| P0 especificación | 15–16sep | Codex: reglas, SDD, contratos. Agy: escenarios/fixtures. Claude: auditoría si recupera acceso | Contratos coherentes; incógnitas con dueño; JSON válido |
| P1 spike de voz | 16–17sep | Claude medium/high: token, PCM, WS, tool, barge-in humano | G1: llamada90s en español, ≥2tool updates antes del fin, sin exponer key |
| P2 scoring | 18–19sep | Claude medium: validación, evidencias, idempotencia; Grok medium: casos adversos | G2: fixtures estructurales pasan y ningún score sin evidencia |
| P3 experiencia | 20–21sep | Agy medium: UI/PWA sobre interfaces estables; Claude: integración | G3: elegir→hablar→feedback→repetir sin consola, desktop/móvil |
| P4 contenido/evals | 22–23sep | Agy: 3escenarios; Grok: investigación/casos; humano: pilotos | G4: 9ensayos reales (3por escenario), consistencia de rúbrica y coaching útil |
| P5 robustez | 24–25sep | Claude high si falla audio; Agy pruebas; Codex decide recortes | G5: negativos críticos, coste controlado, 3demos consecutivas |
| P6 congelación | 26sep 18:00 | Codex: cerrar alcance y commit release candidate | Sólo bugs, material y texto después de este punto |
| P7 entrega | 27–28sep | Agy: guion/slides; Grok: revisión factual; humano grabación; Codex QA | G6: MP4/PDF/cover/README, links en incógnito y build reproducible |
| P8 submit | 29sep antes18:00 | Humano confirma formulario; orquestador comprueba evidencia | Confirmación de recepción guardada, no basta pulsar guardar |
| Reserva | 30sep antes cierre confirmado | Fallos de publicación/envío | Sin features nuevas |

Dependencia crítica: G1→G2→G3→G4→G5→G6→submit. Contenido y guion se pueden hacer en paralelo al spike. No entregar al agenteUI contratos que otro está modificando.

## Gates de riesgo y alternativas

- API/voz no habilitada: preparar interfaz con adaptador mock claramente etiquetado y tramitar acceso humano. No marcar G1. Si el17sep no hay acceso, evaluar pipeline AssemblyAI STT+LLM+TTS con credenciales, costo y latencia explícitos; no añadir proveedores por defecto.
- Agente no interrumpe deliberadamente: mantener objeciones y presión en turnos cortos, demostrar barge-in humano. No bloquear MVP ni fingir cortes en edición.
- Scoring altera conversación o tools no se disparan: reducir payload y frecuencia; observar logs. Tras3intentos Grok/Agy, investigación antes de reintentar. Si requiere observador separado, ADR y prueba de coste/latencia antes de ampliación.
- Tiempo insuficiente: eliminar comparación de intentos/instalación avanzada antes que voz, scoring, escenarios o formatos obligatorios. Si sólo un caso pasa, declarar prototipo de1caso y revisar expectativas; no simular otros dos como reales.
- Falta licencia reutilizable en starter: usarlo como referencia y escribir integración propia del protocolo, sin copiar código sin autorización.

## Recursos necesarios

Hardware: portátil con Chrome/Edge, micrófono, audífonos y un Android o iPhone para smoke test. Captura de pantalla y audio con consentimiento de quienes participan. Datos: casos sintéticos; 3personas de ventas/soporte para entrevistas y5usuarios piloto (pueden solaparse). Roles: builder/decisor, testers, narrador; confirmar integrantes reales.

Software previsto: Node LTS soportado y fijado al implementar, TypeScript, React/Vite, Vitest y Playwright; backend funciones HTTP Vercel. Lockfile versionado. Sin base de datos de conversaciones; contador de cuota compartido requiere almacén atómico mínimo (p.ej. Redis compatible elegido al desplegar). Si no existe contador seguro, no abrir tokens al público.

Cuentas: lablab/equipo, AssemblyAI con Voice Agent API, GitHub, Vercel, CLI autenticados. No es necesario Twilio. `docs/HANDOFF.md` conserva bloqueos y siguiente orden.

## Presupuesto propuesto (no gasto ejecutado)

AAI publica USD4,50/h = USD0,075/min. Una sesión con3min práctica+1min coaching cuesta aproximadamenteUSD0,30 sólo por AAI. Reconfirmar precio/campaña y duración facturada en dashboard tras primer ensayo. El saldo~USD150 proviene del usuario, no del dashboard verificado.

Asignación propuesta: spike/evals60min=USD4,50; desarrollo180min=USD13,50; pilotos100min=USD7,50; ensayos/video40min=USD3; demo pública100min=USD7,50. Total480min=USD36; colchón hastaUSD45 sin usar reservas de agentes. Hosting/almacénUSD0 objetivo en cuotas disponibles, pendiente comprobar; cualquier cargo adicional requiere límite acordado. La cuota API de AAI y las suscripciones de agentes son presupuestos distintos.

Cap app:240s por sesión, una activa por visitante, hasta3sesiones/visitante/día, tope global30min/día inicialmente, tokenTTL60s. Reservar240s en contador atómico antes de emitir token; si no se puede reconciliar duración, cobrar internamente toda la reserva. Límite público acumulado100min hasta revisión. Kill switch desactiva nuevos tokens. Conectar sólo tras gesto y consentimiento; desconectar en fin. Pruebas automáticas por defecto sin APIs.

## Validación comercial

Preguntar a tres responsables: cómo entrenan hoy, frecuencia de práctica, coste de una mala promesa, qué hace confiable un feedback y si pagarían por práctica recurrente. Con5pilotos medir tiempo hasta primera llamada, finalización, utilidad1–5 y acción que repiten. Metas exploratorias:4/5completan sin ayuda y mediana utilidad≥4; publicar n y observaciones, no generalizar. Precio y TAM/SAM son hipótesis a investigar; no inventar cifras ni afirmar mejora en ventas desde un ensayo.

Oferta posterior candidata: piloto por equipo con bolsa de minutos y escenarios propios. El MVP no implementa cobros. Economía inicial se calcula desde minutos usados, costes del proveedor y soporte medido; no sólo tokens.
