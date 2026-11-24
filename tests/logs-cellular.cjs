const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const r=path.join(__dirname,'../payload/www/luci-static/resources');
const source=fs.readFileSync(path.join(r,'chester-ui/logs.js'),'utf8');
const logs=new Function('baseclass','rpc',source)({extend:x=>x},{declare:()=>()=>{}});
let row=logs.parseLine("Mon Nov 23 22:51:50 2026 daemon.err dnsmasq[123]: failed <test>",'system');
assert.equal(row.level,3);assert.equal(row.source,'daemon · dnsmasq[123]');assert.equal(row.message,'failed <test>');assert(logs.matches(row,'DNSMASQ','error'));assert(!logs.matches(row,'unrelated','all'));
row=logs.parseLine('<12>[  123.456] device warning','kernel');assert.equal(row.level,4);assert.equal(row.message,'device warning');assert(logs.matches(row,'','warning'));assert(!logs.matches(row,'','error'));
assert.equal(logs.parseLine('plain continuation','kernel').level,null);assert(!logs.matches(logs.parseLine('plain continuation','kernel'),'','error'));
// A shared card must initialize every per-modem render cache, just like Home.
let refresh,rendered=false;const dom={content:(node,children)=>{node.children=children;}};
function E(){return {isConnected:true};}
const overviewCore={methods:{fetchModem:async()=>({id:'test'}),renderModems(){assert(this.modeModels);assert(this.modeControls);assert(this.selectedModes);assert(this.modemSnapshotCache);rendered=true;return [];}}};
const live=new Function('baseclass','poll','dom','rpc','uci','overviewCore','E','L','requestAnimationFrame','document',fs.readFileSync(path.join(r,'chester-ui/live-cellular.js'),'utf8'))({extend:x=>x},{add:()=>{}},dom,{declare:()=>async()=>[]},{load:async()=>{}},overviewCore,E,{resource:x=>x,resolveDefault:async x=>x},cb=>{refresh=cb;},{hidden:false});
(async()=>{live.create(()=>({id:'test'}));await refresh();assert(rendered);console.log('PASS log parsing/severity/search and shared cellular-card initialization.');})().catch(e=>{console.error(e);process.exitCode=1;});
