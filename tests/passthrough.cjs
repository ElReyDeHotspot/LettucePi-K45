const fs=require('fs'),path=require('path'),assert=require('assert/strict');
String.prototype.format=function(...args){let i=0;return this.replace(/%s/g,()=>String(args[i++]));};
const source=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/view/misectel-modem/bridge.js'),'utf8');
function make(options={}){
 const calls=[],notices=[];
 const rpc={declare:o=>async(...args)=>{calls.push({method:o.method,args});if(o.method==='set_qmodem'){if(options.lostReply)throw new Error('reply interrupted');return {result:true,pending_token:'test-token'};}if(o.method==='activate_qmodem')return {result:true};if(o.method==='get_config')return {pending_token:'test-token',config:{global:{revision:8},assignments:[{provider:'qmodem_passthrough',instance:'modemA',enabled:'1',desired_port:['lan3'],desired_wifi:[],management_cidr:'192.168.101.1/24'}]}};return {};}};
 const api=new Function('view','rpc','misectel','modemHelper','_','L',source)({extend:x=>x},rpc,{setButtonBusy(){}},{boolValue:v=>v===true||v==='1'},s=>s,{resolveDefault:(p,f)=>Promise.resolve(p).catch(()=>f)});
 const ctx={form:{modemId:'modemA',bridgeMode:{checked:true},bridgePorts:{inputs:[{checked:true,value:'lan3'}]},bridgeWifi:{value:''},managementIp:{value:'192.168.101.1/24'}},managerConfig:{force_save_supported:true,config:{global:{revision:7}}},capabilities:{qmodem_passthrough:{lan_first:true},provider_interface_types:{qmodem_passthrough:['port','wifi']}},refreshTransaction:async()=>{},syncControls(){},notify:(m,t)=>notices.push({m,t}),transactionNode:{scrollIntoView(){}}};
 return {api,ctx,calls,notices};
}
const portBuilder=new Function('E','settings','normalizeList',source.slice(source.indexOf('function portLabel('),source.indexOf('function buildWifiSelect('))+';return buildBridgePortChecks;')((tag,attrs={},children=[])=>({tag,attrs,children,disabled:!!attrs.disabled,checked:!!attrs.checked,value:attrs.value,getAttribute:k=>attrs[k]??null}),{icon:()=>({})},v=>Array.isArray(v)?v:v?[v]:[]);
let ports=portBuilder([],['lan1','lan2','lan3'].map(device=>({device,type:'port',role:'lan'})).concat([{device:'wan',type:'port',role:'wan',assignable:false}]),{},'qmodem_passthrough:modemA');
assert(ports.inputs.every(i=>i.attrs.type==='radio'));assert.deepEqual(ports.inputs.map(i=>i.value),['wan','lan1','lan2','lan3']);assert(ports.inputs[0].disabled);assert(!ports.inputs[1].disabled);
ports=portBuilder(['wan'],[{device:'wan',role:'lan',assignable:true}],{},'qmodem_passthrough:modemA');assert(ports.inputs[0].checked&&!ports.inputs[0].disabled);
ports=portBuilder([],[{device:'wan',role:'lan',assignable:true}],{wan:{provider:'vxlan',instance:'other'}},'qmodem_passthrough:modemA');assert(ports.inputs[0].disabled);
(async()=>{
 let t=make();await t.api.saveAssignment.call(t.ctx,{});
 let writes=t.calls.filter(c=>c.method==='set_qmodem');assert.equal(writes.length,1);assert.deepEqual(writes[0].args,['modemA',{enabled:'1',desired_port:['lan3'],desired_wifi:[],management_cidr:'192.168.101.1/24'},7,false]);assert(t.calls.some(c=>c.method==='activate_qmodem'));assert(!t.calls.some(c=>c.method==='confirm_config'));
 t=make();t.ctx.form.bridgeMode.checked=false;await t.api.saveAssignment.call(t.ctx,{});assert.equal(t.calls.find(c=>c.method==='set_qmodem').args[1].enabled,'0');
 for(const address of ['192.168.101.0/24','192.168.101.255/24','192.168.1.1/32','999.1.1.1/24']){t=make();t.ctx.form.managementIp.value=address;await t.api.saveAssignment.call(t.ctx,{});assert(!t.calls.some(c=>c.method==='set_qmodem'),address);assert(t.notices.length);}
 t=make();t.ctx.form.bridgePorts.inputs=[];await t.api.saveAssignment.call(t.ctx,{});assert(!t.calls.some(c=>c.method==='set_qmodem'));
 t=make();t.ctx.form.bridgePorts.inputs.push({checked:true,value:'lan1'});await t.api.saveAssignment.call(t.ctx,{});assert(!t.calls.some(c=>c.method==='set_qmodem'));
 t=make();t.ctx.form.bridgeWifi.value='ap1';await t.api.saveAssignment.call(t.ctx,{});assert(!t.calls.some(c=>c.method==='set_qmodem'));
 t=make();t.ctx.managerConfig.pending_token='existing';await t.api.saveAssignment.call(t.ctx,{});assert(!t.calls.some(c=>c.method==='set_qmodem'));
 t=make();await t.api.saveAssignment.call(t.ctx,{},true);assert.equal(t.calls.find(c=>c.method==='set_qmodem').args[3],true);assert(!t.calls.some(c=>c.method==='activate_qmodem'));
 t=make({lostReply:true});await t.api.saveAssignment.call(t.ctx,{});assert(t.calls.some(c=>c.method==='get_config'));assert(t.calls.some(c=>c.method==='activate_qmodem'));assert(!t.calls.some(c=>c.method==='confirm_config'));
 const map=make();let assignment={enabled:'1',desired_port:['lan1'],desired_wifi:[]};let status={instance:'modemA',cellular_ipv4:'192.0.0.1',endpoint_attached:true,passthrough_active:true};const mapctx={selectedModemId:'modemA',managerConfig:{},managerStatus:{qmodem:[status]},assignment:()=>assignment,mapAddress:{},mapHandoff:{}};
 map.api.refreshMap.call(mapctx);assert.equal(mapctx.mapAddress.textContent,'192.0.0.1');assert.equal(mapctx.mapHandoff.textContent,'192.0.0.1 → LAN 1 · Passthrough active');
 mapctx.managerConfig.pending_token='pending';map.api.refreshMap.call(mapctx);assert.equal(mapctx.mapHandoff.textContent,'Handoff awaiting confirmation');delete mapctx.managerConfig.pending_token;
 status.passthrough_active=false;map.api.refreshMap.call(mapctx);assert.equal(mapctx.mapHandoff.textContent,'Waiting for cellular handoff');
 assignment.enabled='0';map.api.refreshMap.call(mapctx);assert.equal(mapctx.mapHandoff.textContent,'Cellular address stays with Chester in router mode');
 console.log('PASS passthrough UI: safe apply/explicit confirmation, disable payload, invalid CIDR/no-port/pending guards, explicit force and interrupted-reply recovery.');
})().catch(e=>{console.error(e);process.exitCode=1;});
