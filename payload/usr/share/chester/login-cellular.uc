#!/usr/bin/ucode
// Public radio preview: whitelist only. Never return a raw modem response.
import { open, stat } from 'fs';
import { cursor } from 'uci';

function cached(path) {
 try { let file=open(path,'r'); if (!file) return {}; let data=json(file.read('all')); file.close(); return data; }
 catch (e) { return {}; }
}
function safe(value,limit) { return substr(''+(value ?? ''),0,limit); }
let ctx=cursor(), section=null;
ctx.foreach('qmodem','modem-device',function(s) {
 if (section == null && s.disabled != '1' && match(s['.name'],/^[A-Za-z0-9_]+$/)) section=s['.name'];
});
let result={available:false,carrier:'Cellular',network_mode:'',age:null,entries:[]};
if (section != null) {
 let cellpath='/tmp/cache_cell_info_'+section;
 let cell=cached(cellpath), sim=cached('/tmp/cache_sim_info_'+section);
 let fields=['networkmode','band','bandca','arfcn','arfcnca','earfcn','earfcnca','nrarfcn','physicalcellid','physicalcellidca','pci','pcid','dlbandwidth','dlbandwidthca','rsrp','rsrq','sinr'];
 for (let entry in (cell.modem_info || [])) {
  let key=replace(lc(safe(entry.key,48)),/[^a-z0-9]/g,'');
  if (index(fields,key)<0) continue;
  let value=safe(entry.value,160);
  if (key == 'networkmode') result.network_mode=value;
  push(result.entries,{key:safe(entry.key,48),value:value,extra_info:safe(entry.extra_info,20)});
 }
 for (let entry in (sim.modem_info || [])) if (entry.key == 'ISP') result.carrier=safe(entry.value,48);
 let info=stat(cellpath);
 if (info) result.age=max(0,time()-info.mtime);
 result.available=length(result.entries)>0;
}
printf('%J\n',result);
