// Browser integration tests use a fake microphone, mocked HTTP and mocked AAI WS.
// No API key or real provider connection. These do NOT satisfy the live-call G1 gate.
import { test, expect, type Page } from '@playwright/test';
import scenarios from '../../spec/scenarios.json' with { type: 'json' };
import rubric from '../../spec/rubric.json' with { type: 'json' };
import type { CriterionId, ScoreSnapshot } from '../../src/shared/types';

const catalog = {
  scenarios: scenarios.map(s => ({id:s.id,version:s.version,title:s.titulo,brief:s.brief_visible,role:s.roles.usuario,facts:s.hechos,authority:s.restricciones_autoridad})),
  criteria: rubric.criteria.map(c => ({id:c.id,label:c.label,weight:c.weight})),
};
const quote = 'Entiendo que el retraso paralizó a su equipo. ¿Qué necesita resolver primero?';
const baseSnapshot = (): ScoreSnapshot => ({revision:0,coverage:0,total:null,provisional:true,limitations:[],next_action:'Haz una pregunta sobre la prioridad del cliente.',criteria:rubric.criteria.map(c => ({id:c.id as CriterionId,label:c.label,weight:c.weight,level:null,evidence:null}))});

async function mockApi(page: Page, keyConfigured = true) {
  const requests: Record<string, unknown>[] = [];
  let snapshot = baseSnapshot();
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown;
    if (path === '/api/catalog') body = catalog;
    else if (path === '/api/health') body = {status:'ok',key_configured:keyConfigured,voice_enabled:true,mode:'local'};
    else if (path === '/api/session/start') body = {session_id:'test-session',session_context:'mock-context',token:'MOCK_ONLY',max_seconds:240,deadline:Date.now()+240000,session_config:{system_prompt:'Simulación de prueba automatizada.',greeting:'Llegó tarde.',output:{voice:'lola'}}};
    else if (path === '/api/evaluate') {
      const payload = route.request().postDataJSON(); requests.push(payload);
      // Verify request contract independently of the response implementation.
      expect(payload.revision).toBe(snapshot.revision);
      expect(payload.transcript_final.some((t: {role:string;text:string})=>t.role==='USER' && t.text.includes(quote))).toBe(true);
      snapshot = {...snapshot,revision:snapshot.revision+1,coverage:65,total:75,criteria:snapshot.criteria.map(c=>['empathy','discovery','objection_handling'].includes(c.id) ? {...c,level:3,evidence:{quote,user_turn_id:'turn_1',rationale:'Reconoce el impacto y pregunta la prioridad.',source_call_id:payload.tool_call_id}}:c)};
      body = {snapshot,result:{accepted:true},processing_ms:1};
    } else if (path === '/api/session/finish') { snapshot = {...snapshot,provisional:false}; body = {snapshot,coach_prompt:'Resume sólo la evidencia validada.'}; }
    else if (path === '/api/session/end') body = {ok:true};
    else { await route.fulfill({status:404,json:{message:'unexpected test endpoint'}}); return; }
    await route.fulfill({status:200,json:body});
  });
  return {requests};
}

test('requires consent; renders complete case; mobile has no horizontal overflow', async ({page}) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Iniciar práctica'})).toBeDisabled();
  await page.getByRole('button',{name:/Objeción de precio/}).click();
  await page.getByText('Ver los hechos y límites del caso').click();
  await expect(page.getByText(/Solo puede ofrecerse hasta un 5%/)).toBeVisible();
  await page.setViewportSize({width:360,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button',{name:'Iniciar práctica'})).toBeEnabled();
  await page.screenshot({path:'output/playwright/mobile.png',fullPage:true});
});

test('missing key provides local setup guidance and never asks for key in the page', async ({page}) => {
  await mockApi(page,false);
  await page.goto('/');
  await expect(page.getByText(/La voz está pendiente de configuración/)).toBeVisible();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button',{name:'Iniciar práctica'})).toBeDisabled();
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.screenshot({path:'output/playwright/desktop.png',fullPage:true});
});

test('real browser adapter: handshake, live scoring, safe tool result, coaching, end', async ({page}) => {
  const {requests} = await mockApi(page);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as any).__testTracks = [];
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      (window as any).__testTracks.push(...stream.getTracks());
      return stream;
    };
  });
  const wire: Record<string, any>[] = [];
  let replyDoneSent = false;
  let endSeen = false;
  let audioBeforeReady = false;
  let ready = false;
  const pageErrors: string[] = [];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.routeWebSocket('wss://agents.assemblyai.com/**', ws => {
    const send = (data: unknown) => ws.send(JSON.stringify(data));
    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw)); wire.push(msg);
      if (msg.type === 'input.audio' && !ready) audioBeforeReady = true;
      if (msg.type === 'session.update' && !ready) {
        // AAI waits for config BEFORE sending ready; a client waiting for ready to configure deadlocks.
        ready = true; send({type:'session.ready',session_id:'provider-test-session'});
        setTimeout(()=>{
          send({type:'transcript.user',item_id:'u1',text:quote});
          send({type:'reply.started',reply_id:'fc-call1',item_id:'a1'});
          send({type:'tool.call',call_id:'call1',name:'score_rubric',arguments:{observations:[{criterion_id:'empathy',level:3,quote,occurrence:1,rationale:'Reconoce el impacto.'}]}});
          setTimeout(()=>{ replyDoneSent = true; send({type:'reply.done',reply_id:'fc-call1',status:'completed'}); },100);
        },80);
      } else if (msg.type === 'session.update' && ready) send({type:'session.updated',config:msg.session});
      else if (msg.type === 'tool.result') {
        expect(replyDoneSent).toBe(true); expect(typeof msg.result).toBe('string'); expect(msg.is_error).toBe(false);
        send({type:'reply.started',reply_id:'r2',item_id:'a2'});
        send({type:'transcript.agent',reply_id:'r2',item_id:'a2',text:'Quiero una solución concreta.',interrupted:false});
        send({type:'reply.done',reply_id:'r2',status:'completed'});
      } else if (msg.type === 'reply.create') {
        send({type:'reply.started',reply_id:'coach',item_id:'a3'});
        send({type:'transcript.agent',reply_id:'coach',item_id:'a3',text:'Reconociste el impacto. Acuerda el siguiente paso.',interrupted:false});
        send({type:'reply.done',reply_id:'coach',status:'completed'});
      } else if (msg.type === 'session.end') { endSeen = true; send({type:'session.ended',session_duration_seconds:3}); ws.close(); }
    });
  });
  await page.goto('/');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Iniciar práctica'}).click();
  await expect(page.getByText('Conversación en curso')).toBeVisible({timeout:12000});
  await expect(page.locator('.score-total strong')).toContainText('75');
  await expect.poll(()=>wire.some(m=>m.type==='tool.result')).toBe(true);
  await expect.poll(()=>wire.some(m=>m.type==='input.audio' && typeof m.audio === 'string' && m.audio.length > 0)).toBe(true);
  expect(requests).toHaveLength(1); expect(audioBeforeReady).toBe(false);
  await page.getByRole('button',{name:'Terminar y ver feedback'}).click();
  await expect(page.getByText('Práctica terminada')).toBeVisible({timeout:10000});
  expect(endSeen).toBe(true); expect(pageErrors).toEqual([]);
  expect(await page.evaluate(() => (window as any).__testTracks.length > 0 && (window as any).__testTracks.every((t: MediaStreamTrack) => t.readyState === 'ended'))).toBe(true);
  await expect(page.getByText('Resultado de la práctica',{exact:true})).toBeVisible();
  await page.screenshot({path:'output/playwright/feedback-mock.png',fullPage:true});
});

test('microphone denied releases the session and shows a recoverable message', async ({page}) => {
  await mockApi(page);
  await page.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError');};});
  await page.goto('/'); await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Iniciar práctica'}).click();
  await expect(page.getByRole('alert')).toContainText(/micrófono/);
  await expect(page.getByRole('button',{name:'Volver a practicar'})).toBeVisible();
});

test('stopping and immediately restarting survives the old socket closing later', async ({page}) => {
  await mockApi(page);
  let connections = 0;
  let oldClosed = false;
  await page.routeWebSocket('wss://agents.assemblyai.com/**', ws => {
    const connection = ++connections;
    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'session.update') ws.send(JSON.stringify({type:'session.ready',session_id:`s${connection}`}));
      if (msg.type === 'session.end') setTimeout(() => { oldClosed = true; ws.close(); }, 600);
    });
  });
  await page.goto('/'); await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Iniciar práctica'}).click();
  await expect(page.getByText('Conversación en curso')).toBeVisible();
  await page.getByRole('button',{name:'Cortar audio'}).click();
  await page.getByRole('button',{name:'Volver a practicar'}).click();
  await page.getByRole('button',{name:'Iniciar práctica'}).click();
  await expect(page.getByText('Conversación en curso')).toBeVisible();
  await expect.poll(()=>oldClosed).toBe(true);
  // Cross the old cleanup timer while new call is alive.
  await expect.poll(()=>page.locator('.timer').textContent()).toContain('00:02');
  await expect(page.getByText('Conversación en curso')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(connections).toBe(2);
  await page.getByRole('button',{name:'Cortar audio'}).click();
});

test('network close releases the server session and allows a new practice', async ({page}) => {
  await mockApi(page);
  let endRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/session/end') endRequests++; });
  await page.routeWebSocket('wss://agents.assemblyai.com/**', ws => {
    ws.onMessage(raw => {
      if (JSON.parse(String(raw)).type === 'session.update') {
        ws.send(JSON.stringify({type:'session.ready',session_id:'network-test'}));
        setTimeout(()=>ws.close({code:1011,reason:'test network failure'}),100);
      }
    });
  });
  await page.goto('/'); await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Iniciar práctica'}).click();
  await expect(page.getByRole('alert')).toContainText('Se perdió la conexión');
  await expect.poll(()=>endRequests).toBe(1);
  await expect(page.getByRole('button',{name:'Volver a practicar'})).toBeVisible();
});
