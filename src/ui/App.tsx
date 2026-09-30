import { useEffect, useRef, useState } from 'react';
import { createVoiceController } from '../voice/controller';
import type { Catalog, CriterionScore, Health, ScoreSnapshot, Turn, VoiceController, VoiceState } from '../shared/types';
import scenarioData from '../../spec/scenarios.json';
import rubricData from '../../spec/rubric.json';

const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const previewCatalog: Catalog = {
  scenarios: scenarioData.map(scenario => ({
    id: scenario.id, version: scenario.version, title: scenario.titulo,
    brief: scenario.brief_visible, role: scenario.roles.usuario,
    facts: scenario.hechos, authority: scenario.restricciones_autoridad,
  })),
  criteria: rubricData.criteria.map(({ id, label, weight }) => ({
    id: id as Catalog['criteria'][number]['id'], label, weight,
  })),
};

const titles: Record<string, string> = { late_delivery: 'Llegó tarde. El enojo, puntual.', price_objection: '“La competencia cobra menos.”', cancellation: 'Un cobro de más. Un cliente menos.' };
const labels: Record<string, string> = { late_delivery: 'Entrega demorada', price_objection: 'Objeción de precio', cancellation: 'Solicitud de cancelación' };
const roles: Record<string, string> = { late_delivery: 'Soporte', price_objection: 'Ventas', cancellation: 'Retención' };
const stateLabels: Record<VoiceState, string> = { idle: 'Listo para practicar', preparing: 'Preparando micrófono', connecting: 'Conectando con el cliente', roleplay: 'Conversación en curso', finalizing: 'Cerrando evaluación', coaching: 'Escucha tu feedback', ending: 'Cerrando la llamada', ended: 'Práctica terminada', error: 'La llamada se interrumpió' };

function readable(value: unknown): string { return typeof value === 'object' ? JSON.stringify(value) : String(value); }
function clock(seconds: number) { return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`; }
function niceKey(key: string) { return key.replaceAll('_', ' '); }

export function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [selectedId, setSelectedId] = useState('late_delivery');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [partial, setPartial] = useState<{role: 'USER' | 'AGENT'; text: string} | null>(null);
  const [snapshot, setSnapshot] = useState<ScoreSnapshot | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showScores, setShowScores] = useState(true);
  const controller = useRef<VoiceController | null>(null);
  const startedAt = useRef(0);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const active = !['idle', 'ended', 'error'].includes(state);
  const scenario = catalog?.scenarios.find(s => s.id === selectedId);
  const complete = state === 'ended' || state === 'error';
  const displayCriteria: CriterionScore[] = snapshot?.criteria ?? (catalog?.criteria ?? []).map(c => ({...c, level: null, evidence: null}));

  useEffect(() => {
    const ac = new AbortController();
    Promise.all([
      fetch('/api/catalog', { signal: ac.signal }).then(r => { if (!r.ok) throw Error(); return r.json() as Promise<Catalog>; }),
      fetch('/api/health', { signal: ac.signal }).then(r => { if (!r.ok) throw Error(); return r.json() as Promise<Health>; }),
    ]).then(([c, h]) => { setCatalog(c); setHealth(h); }).catch(e => {
      if (e.name === 'AbortError') return;
      setCatalog(previewCatalog);
      setError(isLocal
        ? 'No se pudo conectar con el servicio local. Inicia npm run dev y vuelve a cargar.'
        : 'La práctica por voz no está disponible en este momento. Puedes explorar los escenarios y volver a intentarlo más tarde.');
    });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    const c = createVoiceController({
      onState: s => { setState(s); if (s === 'roleplay' && !startedAt.current) startedAt.current = Date.now(); },
      onTurn: turn => { setTurns(prev => prev.some(t => t.turn_id === turn.turn_id) ? prev : [...prev, turn]); setPartial(null); },
      onPartial: (role, text) => setPartial({role, text}),
      onSnapshot: next => setSnapshot(prev => !prev || next.revision >= prev.revision ? next : prev),
      onError: setError,
    });
    controller.current = c;
    return () => { c.stop(); controller.current = null; };
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => { if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)); }, 250);
    return () => clearInterval(id);
  }, [active]);
  useEffect(() => { transcriptEnd.current?.scrollIntoView({block: 'nearest', behavior: 'instant'}); }, [turns, partial]);

  async function start() {
    if (!scenario || !consent || active) return;
    setError(''); setSnapshot(null); setTurns([]); setPartial(null); setElapsed(0); startedAt.current = 0;
    try { await controller.current?.start(scenario); }
    catch { setError('No se pudo iniciar. Revisa el permiso del micrófono y la conexión.'); setState('error'); }
  }
  async function finish() { try { await controller.current?.finish(); } catch { setError('El feedback por voz no pudo completarse. Conservamos la evaluación recibida.'); controller.current?.stop(); } }
  function reset() { controller.current?.stop(); setState('idle'); setError(''); setSnapshot(null); setTurns([]); setPartial(null); setElapsed(0); startedAt.current = 0; }

  return <div className="app-shell">
    <header className="masthead">
      <a className="brand" href="/" aria-label="Sparring, inicio"><span className="brand-symbol" aria-hidden="true">s</span> sparring<span className="brand-period">.</span></a>
      <span className="header-note">Entrena la conversación.</span>
      <span className="environment"><span aria-hidden="true" />{isLocal ? 'Laboratorio local' : 'Práctica de voz'}</span>
    </header>

    <main>
      <section className="intro" aria-labelledby="main-title">
        <div><p className="eyebrow">Práctica real. Clientes simulados.</p><h1 id="main-title">Que la próxima conversación<br/><span>no sea tu primera vez.</span></h1></div>
        <p className="intro-note">Un cliente difícil. Tres minutos.<br/>Un siguiente paso para hacerlo mejor.</p>
      </section>
      {error && <div role="alert" className="notice error"><strong>Necesitamos tu atención.</strong> {error}</div>}
      {health && (!health.key_configured || !health.voice_enabled) && <div className="notice" role="status">{isLocal ? <>La voz está pendiente de configuración. Guarda tu clave de AssemblyAI en el archivo local <code>.env</code> y reinicia <code>npm run dev</code>. No pegues la clave en esta pantalla.</> : 'La práctica por voz está temporalmente desactivada. Vuelve a intentarlo más tarde.'}</div>}

      <div className="practice-layout">
        <aside className="scenario-panel" aria-label="Escenarios de práctica">
          <div className="section-heading"><span className="eyebrow">Elige tu reto</span><span className="tiny-label">3 escenarios</span></div>
          <div className="scenario-list">{catalog ? catalog.scenarios.map((s, i) => <button key={s.id} className={`scenario-choice ${selectedId === s.id ? 'selected' : ''}`} aria-pressed={selectedId === s.id} disabled={active} onClick={() => { setSelectedId(s.id); reset(); }}>
            <span className="scenario-top"><span className="scenario-icon" aria-hidden="true">{['↗', '≈', '↩'][i]}</span><span className="tiny-label">{roles[s.id]}</span></span>
            <strong>{labels[s.id] || s.title}</strong><span className="scenario-caption">{titles[s.id]}</span><span className="scenario-bottom">3 min de práctica <span aria-hidden="true">↗</span></span>
          </button>) : <p role="status">Cargando los escenarios…</p>}</div>
          <div className="sidebar-tip"><span className="tip-mark" aria-hidden="true">“</span><p>No necesitas la respuesta perfecta.<br/><strong>Necesitas escuchar la siguiente pregunta.</strong></p></div>
          <p className="provider-credit">Conversación de voz con <strong>AssemblyAI</strong></p>
        </aside>

        <section className="workspace" aria-label="Sala de práctica">
          <div className="room-bar"><span className="room-label"><span className={`status-dot ${active ? 'live' : ''}`} aria-hidden="true"/><span role="status">{stateLabels[state]}</span></span><span className="timer" aria-label={`${elapsed} segundos transcurridos`}>{clock(elapsed)} <span>/ 03:00</span></span></div>
          {scenario && <>
            {state === 'idle' ? <div className="brief-body">
              <div className="client-card"><div className="voice-emblem" aria-hidden="true"><span/><span/><span/><span/><span/><span/><span/></div><p className="eyebrow">Tu cliente está al otro lado</p><h2>{titles[scenario.id] || scenario.title}</h2><p>Escucha su objeción. Responde con tu voz.<br/>Sparring adapta la conversación a lo que dices.</p></div>
              <div className="brief-content"><p className="eyebrow">Antes de llamar</p><h3>Tu margen de acción</h3><p>{scenario.brief}</p><details><summary>Ver los hechos y límites del caso</summary><dl>{Object.entries({...scenario.facts, ...scenario.authority}).map(([k,v]) => <div key={k}><dt>{niceKey(k)}</dt><dd>{readable(v)}</dd></div>)}</dl></details></div>
            </div> : <div className="conversation-body">
              <div className="conversation-title"><div><p className="eyebrow">{roles[scenario.id]} · {labels[scenario.id]}</p><h2>{state === 'coaching' || complete ? 'Cada conversación deja una pista.' : 'Escucha. Respira. Responde.'}</h2></div><span className={`voice-emblem small ${state === 'roleplay' ? 'speaking' : ''}`} aria-hidden="true"><span/><span/><span/><span/><span/></span></div>
              <div className="transcript" role="log" aria-label="Transcripción de la conversación" aria-live="polite">
                {!turns.length && !partial && <div className="transcript-empty"><span aria-hidden="true">◌</span><p>{state === 'preparing' ? 'Permite el acceso al micrófono en tu navegador.' : 'Aquí verás la conversación cuando comience.'}</p></div>}
                {turns.map(t => <div key={t.turn_id} className={`utterance ${t.role === 'USER' ? 'you' : 'client'}`}><span className="speaker">{t.role === 'USER' ? 'Tú' : state === 'coaching' || complete ? 'Sparring' : 'Cliente simulado'}</span><p>{t.text}</p></div>)}
                {partial?.text && <div className={`utterance partial ${partial.role === 'USER' ? 'you' : 'client'}`}><span className="speaker">{partial.role === 'USER' ? 'Tú' : 'Sparring'} · transcribiendo</span><p>{partial.text}</p></div>}
                <div ref={transcriptEnd}/>
              </div>
            </div>}
            <div className="call-controls">
              {state === 'idle' && <><label className="consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>Acepto enviar mi voz a AssemblyAI para esta práctica y que Sparring use la transcripción para evaluar la rúbrica. Usaré datos ficticios. Sparring no guarda audio.</span></label><button className="primary-button" disabled={!consent || !health?.key_configured || !health?.voice_enabled} onClick={() => void start()}><MicIcon/> Iniciar práctica <span aria-hidden="true">↗</span></button><p className="control-help">Permite el micrófono al comenzar · Máximo 4 min con feedback</p></>}
              {active && <div className="active-controls"><p>{state === 'coaching' || state === 'finalizing' ? 'Micrófono silenciado. La evaluación se está cerrando.' : 'Puedes interrumpir al cliente al tomar la palabra.'}</p><div><button className="secondary-button" onClick={() => void finish()} disabled={state !== 'roleplay'}>Terminar y ver feedback</button><button className="stop-button" onClick={() => controller.current?.stop()}><span aria-hidden="true">■</span> Cortar audio</button></div></div>}
              {complete && <div className="active-controls"><p>{!snapshot ? 'No hay suficiente evidencia para evaluar esta práctica.' : snapshot.total === null ? 'La cobertura de evidencia quedó incompleta (menos del 60% de la rúbrica); no se calculó una nota final, aunque sí hay observaciones parciales.' : 'Evaluación formativa basada en las respuestas observadas.'}</p><button className="primary-button" onClick={reset}>Volver a practicar <span aria-hidden="true">↻</span></button></div>}
            </div>
          </>}
        </section>
      </div>

      <section className="score-panel" aria-labelledby="score-title"><div className="score-header"><div><p className="eyebrow">Lo que se observa</p><h2 id="score-title">La evidencia cuenta.</h2></div><button className="text-button" aria-expanded={showScores} onClick={() => setShowScores(!showScores)}>{showScores ? 'Ocultar' : 'Mostrar'} evaluación {showScores ? '−' : '+'}</button></div>
        {showScores && <><div className="score-summary"><div className="score-total"><strong>{snapshot?.total ?? '—'}<small>/100</small></strong><span>{snapshot?.provisional ? 'Resultado provisional' : snapshot ? 'Resultado de la práctica' : 'Sin evaluar todavía'}</span></div><div className="coverage"><div><span>Cobertura de la rúbrica</span><strong>{snapshot?.coverage ?? 0}%</strong></div><progress value={snapshot?.coverage ?? 0} max="100"/><p>La nota aparece al observar al menos el 60% de la rúbrica.</p></div></div>
          <div className="criteria-grid">{displayCriteria.map(c => { const scored = c; return <article className="criterion" key={c.id}><div className="criterion-heading"><h3>{c.label}</h3><span>{scored?.level == null ? '—' : `${scored.level}/4`}</span></div><div className="level-track" aria-hidden="true">{[0,1,2,3].map(n=><i key={n} className={scored?.level != null && n < scored.level ? 'filled' : ''}/>)}</div>{scored?.evidence ? <><blockquote>“{scored.evidence.quote}”</blockquote><p>{scored.evidence.rationale}</p></> : <p>Aún sin evidencia</p>}<span className="criterion-weight">Peso en la rúbrica: {c.weight}%</span></article>; })}</div>
          {snapshot && <div className="next-action"><span aria-hidden="true">↗</span><div><strong>Tu siguiente paso</strong><p>{snapshot.next_action}</p></div></div>}
          <p className="score-disclaimer">Las notas son orientativas: Sparring observa señales explícitas en la transcripción, valida citas textuales y calcula la puntuación. No es una certificación de desempeño.</p></>}
      </section>
    </main>
    <footer><span>sparring. <span>Un espacio para equivocarte antes.</span></span><span>Casos ficticios · Sin acciones sobre clientes reales</span></footer>
  </div>;
}
function MicIcon() { return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>; }
