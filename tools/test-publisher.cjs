const assert = require('node:assert/strict');
const {publish,localStatus,serialize} = require('../publisher.js');
const ok = value => ({ok:true,json:async()=>value});
(async()=>{
  assert.equal(await localStatus(()=>assert.fail('Public site must not contact helper'),'jsmorley.github.io'),false);
  await assert.rejects(publish({state:{},expected:null,message:'Test'}),/Start start-local/);
  assert.equal(await localStatus(async()=>ok({enabled:true,csrf:'test-csrf'}),'localhost'),true);
  const state={title:'Café 日本語'};
  const result=await publish({state,expected:null,message:'Test',fetcher:async(url,options)=>{
    assert.equal(url,'/__local/publish'); assert.equal(options.headers['X-Homepage-CSRF'],'test-csrf');
    assert.deepEqual(JSON.parse(options.body),{state,expected:null,message:'Test'});
    assert.ok(!options.headers.Authorization); return ok({commit:'test-commit'});
  }});
  assert.equal(result.commit,'test-commit');
  await assert.rejects(publish({state,expected:null,message:'Test',fetcher:async()=>({ok:false,json:async()=>({error:'Newer data exists'})})}),/Newer data/);
  await assert.rejects(publish({state,expected:null,message:'Test',fetcher:async()=>{throw Error('offline')}}),/may have succeeded/);
  assert.ok(serialize(state).includes('Café 日本語'));
  console.log('PASS: localhost-only detection, helper request, CSRF header, no token, Unicode, server errors, uncertain network result.');
})().catch(e=>{console.error(e);process.exitCode=1;});
