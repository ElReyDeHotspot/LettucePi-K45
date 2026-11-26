const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/live-cellular.js','utf8');
const home=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/overview-core.js','utf8');
const apply=new Function('chesterCarrierName',home.slice(home.indexOf('function homeApplyLiveSIM('),home.indexOf('return baseclass.extend({methods:'))+';return homeApplyLiveSIM;')(v=>v||'');
const ticks=[],removed=[],renders=[];let frame,simCalls=0,fetches=0,hold=null;
const modem={id:'modem1'},document={hidden:false};
let sim={updated:1,running:true,active:'1',config:{modem:'modem1'},cards:{'1':{presence:'present',ready:true,connected:true,carrier:'T-Mobile',ipv4:'192.0.2.2',rsrp:-90}}};
const snapshot={id:'modem1',modeLabel:'5G NSA',operator:'Old',status:{tone:'online'},signals:[],rawSignals:{},carriers:[{band:'N41'}],description:[]};
const api=new Function('baseclass','poll','dom','rpc','uci','overviewCore','E','L','requestAnimationFrame','document',source)(
 {extend:x=>x},{add:(fn,seconds)=>ticks.push({fn,seconds}),remove:fn=>removed.push(fn)},
 {content:(node,children)=>node.children=children},{declare:opts=>opts.object==='chester.sim'?async()=>{simCalls++;if(hold)await hold;return sim;}:async()=>[]},
 {load:async()=>{}},{methods:{applyLiveSIM:apply,fetchModem:async()=>{fetches++;return snapshot;},renderModems:models=>{renders.push(models[0]);return [];}}},
 (tag,attrs={},children=[])=>({tag,attrs,children,isConnected:true,querySelector:()=>null}),
 {resource:x=>x,resolveDefault:(p,v)=>Promise.resolve(p).catch(()=>v)},fn=>frame=fn,document);
(async()=>{
 const card=api.create(()=>modem);await frame();assert.equal(renders.at(-1).signals[0].value,'-90 dBm');
 const live=ticks.find(t=>t.seconds===2).fn;assert.equal(ticks.find(t=>t.seconds===15).fn,card.refresh);
 sim={...sim,updated:2,cards:{'1':{presence:'present',ready:true,connected:true,carrier:'Verizon',ipv4:'192.0.2.3',rsrp:-105}}};
 await live();assert.equal(renders.at(-1).operator,'Verizon');assert.equal(renders.at(-1).ipv4,'192.0.2.3');assert.equal(renders.at(-1).signals[0].value,'-105 dBm');assert.equal(fetches,1,'fast ticks must not fetch QModem/AT information');
 sim={...sim,updated:3,active:'',cards:{'1':{presence:'unknown',ready:false,connected:false}}};await live();assert.equal(renders.at(-1).status.tone,'online','unknown slot replies must not erase the established netifd snapshot');assert.deepEqual(renders.at(-1).carriers,[{band:'N41'}]);
 sim={...sim,updated:4,active:'1',cards:{'1':{presence:'absent',ready:false,connected:false}}};await live();assert.equal(renders.at(-1).status.text,'No SIM inserted');assert.deepEqual(renders.at(-1).carriers,[]);
 document.hidden=true;const calls=simCalls;await live();await card.refresh();assert.equal(simCalls,calls);document.hidden=false;
 let release;hold=new Promise(resolve=>release=resolve);const first=live();await live();assert.equal(simCalls,calls+1,'overlapping fast ticks must be skipped');release();await first;hold=null;
 card.node.isConnected=false;await live();assert.equal(removed.length,2,'both polls must be removed when leaving the page');
 console.log('PASS lock-page Cellular cards: live carrier/IP/signal, SIM removal clears stale data, no fast modem queries, visibility/overlap guards and poll cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;});
