// Real local HTTP server + real browser/audio graph. Only AssemblyAI is mocked.
import { test, expect } from '@playwright/test';
import { createApp } from '../../server/app.ts';
import type { AddressInfo } from 'node:net';

test('browser and real backend accept two live observations and calculate 59 with full coverage', async ({page}) => {
  const server = createApp({env:{ASSEMBLYAI_API_KEY:'synthetic-test-key',SPARRING_VOICE_ENABLED:'true'},fetch:async(input,init)=>{
    const url = new URL(String(input));
    expect(url.origin).toBe('https://agents.assemblyai.com');
    expect(url.searchParams.get('max_session_duration_seconds')).toBe('240');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-test-key');
    return Response.json({token:'TEST_PROVIDER_ONLY'});
  }});
  await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const accepted: string[] = [];
  const quote = 'Entiendo el impacto en su equipo. Puedo devolver el envío o escalar con respuesta en cuatro horas hábiles.';
  try {
    await page.route('**/api/**',async route=>{
      const response = await route.fetch({url:base+new URL(route.request().url()).pathname});
      await route.fulfill({response});
    });
    await page.routeWebSocket('wss://agents.assemblyai.com/**', ws=>{
      let ready = false;
      const send = (data: unknown)=>ws.send(JSON.stringify(data));
      const score = (id: string,observations: {criterion_id:string;level:number}[])=>{
        send({type:'reply.started',reply_id:`fc-${id}`});
        send({type:'tool.call',call_id:id,name:'score_rubric',arguments:{observations:observations.map(o=>({...o,quote,occurrence:1,rationale:'Evidencia sintética para probar el contrato.'}))}});
        send({type:'reply.done',reply_id:`fc-${id}`,status:'completed'});
      };
      ws.onMessage(raw=>{
        const msg = JSON.parse(String(raw));
        if(msg.type==='session.update' && !ready){
          ready=true;
          expect(msg.session.output.voice).toBe('lola');
          expect(msg.session.input.format.encoding).toBe('audio/pcm');
          expect(msg.session.tools.map((t:{name:string})=>t.name)).toEqual(['log_objection','score_rubric']);
          expect(JSON.stringify(msg)).not.toContain('synthetic-test-key');
          send({type:'session.ready',session_id:'provider-full-stack'});
          setTimeout(()=>{send({type:'transcript.user',item_id:'real-api-u1',text:quote});score('first',[{criterion_id:'empathy',level:3},{criterion_id:'discovery',level:2}]);},80);
        }else if(msg.type==='tool.result'){
          expect(msg.is_error).toBe(false);
          expect(JSON.parse(msg.result).accepted).toBe(true);
          accepted.push(msg.call_id);
          if(msg.call_id==='first')score('second',[{criterion_id:'objection_handling',level:1},{criterion_id:'solution_integrity',level:4},{criterion_id:'closing',level:2}]);
        }else if(msg.type==='session.update')send({type:'session.updated',config:msg.session});
        else if(msg.type==='reply.create'){
          send({type:'reply.started',reply_id:'coach'});
          send({type:'transcript.agent',item_id:'coach-turn',reply_id:'coach',text:'Revisa las citas de tu resultado.',interrupted:false});
          send({type:'reply.done',reply_id:'coach',status:'completed'});
        }else if(msg.type==='session.end'){send({type:'session.ended'});ws.close();}
      });
    });
    await page.goto('/');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Iniciar práctica'}).click();
    await expect(page.getByText('Conversación en curso')).toBeVisible();
    await expect(page.locator('.score-total strong')).toContainText('59');
    await expect(page.locator('.coverage strong')).toHaveText('100%');
    await expect.poll(()=>accepted).toEqual(['first','second']);
    await page.getByRole('button',{name:'Terminar y ver feedback'}).click();
    await expect(page.getByText('Práctica terminada')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.score-total strong')).toContainText('59');
  } finally {
    await page.goto('about:blank');
    server.closeAllConnections();
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
