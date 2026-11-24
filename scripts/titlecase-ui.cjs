'use strict';
const fs=require('fs'),path=require('path'),acorn=require('acorn');
const minor=new Set(['a','an','and','as','at','but','by','for','from','in','into','nor','of','on','or','per','the','to','via','with','without']);
const canonical={'wifi':'Wi-Fi','wi-fi':'Wi-Fi','ipv4':'IPv4','ipv6':'IPv6','ip':'IP','dns':'DNS','dhcp':'DHCP','apn':'APN','sim':'SIM','sims':'SIMs','sms':'SMS','ssh':'SSH','http':'HTTP','https':'HTTPS','ntp':'NTP','ttl':'TTL','hl':'HL','wan':'WAN','lan':'LAN','cpu':'CPU','usb':'USB','mac':'MAC','mtu':'MTU','mss':'MSS','vlan':'VLAN','vlans':'VLANs','vpn':'VPN','vpns':'VPNs','tcp':'TCP','udp':'UDP','qos':'QoS','sqm':'SQM','ndt':'NDT','mlab':'M-Lab','m-lab':'M-Lab','ndpi':'nDPI','ebpf':'eBPF','enb':'eNB','gnb':'gNB','rsrp':'RSRP','rsrq':'RSRQ','rssi':'RSSI','sinr':'SINR','pci':'PCI','iccid':'ICCID','imei':'IMEI','imsi':'IMSI','pin':'PIN','puk':'PUK','led':'LED','leds':'LEDs','dmz':'DMZ','upnp':'UPnP','ddns':'DDNS','qmodem':'QModem','openwrt':'OpenWrt','luci':'LuCi','warp':'WARP','warp+':'WARP+','ookla':'Ookla','tailscale':'Tailscale','wireguard':'WireGuard','zapret2':'Zapret2','netflix':'Netflix','mbps':'Mbps','gbps':'Gbps','kbit/s':'kbit/s','mb/s':'MB/s','gb':'GB','mb':'MB','kb':'KB','tx':'TX','rx':'RX','ubus':'ubus','zstd':'zstd','lz4':'lz4','lzo':'lzo','fast.com':'FAST.com','ipset':'ipset','iptables':'iptables','nftables':'nftables','conntrack':'conntrack','dnsmasq':'dnsmasq','odhcpd':'odhcpd','stderr':'stderr','stdout':'stdout','rpiboot':'rpiboot','uboot':'U-Boot','ahdemo':'ahdemo','s390':'s390','x86':'x86','x64':'x64'};
function titleCase(text){
 if(typeof text==='string'&&((/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/i.test(text)&&!text.includes('FAST.com'))||/^AT[+?]/i.test(text)||/^(?:tty|eth|pcie|radio|wwan)\d/i.test(text)))return text;
 if(typeof text!=='string'||!text.trim()||text.length>100||/[.!]\s*$/.test(text)||/[\n<>={}]/.test(text)||/^https?:|^\//.test(text))return text;
 const words=text.split(/(\s+)/),last=words.length-1;
 return words.map((word,i)=>{if(!word.trim()||word.includes('_')||/^\(?\//.test(word)||/^&[a-z]+;/i.test(word)||/^\(?(?:yyyy|mm|dd|hh|ss)(?:[-:](?:yyyy|mm|dd|hh|ss))+\)?$/i.test(word))return word;return word.replace(/FAST\.com|[A-Za-z][A-Za-z0-9+]*(?:[-/’'][A-Za-z0-9+]+)*/gi,(part,offset)=>{const lower=part.toLowerCase();if((offset>0&&/[0-9]/.test(word[offset-1]))||/^(?:eth|pcie|radio|wwan|tty)\d/i.test(part))return part;if(canonical[lower])return canonical[lower];if(part===part.toUpperCase())return part;if(part!==part.toLowerCase()&&part!==part[0].toUpperCase()+part.slice(1).toLowerCase())return part;return i!==0&&i!==last&&minor.has(lower)?lower:part.replace(/(^|[-/])([a-z])/g,(_,prefix,letter)=>prefix+letter.toUpperCase());});}).join('');
}
function transform(code){
 const tree=acorn.parse(code,{ecmaVersion:'latest',allowReturnOutsideFunction:true});const picked=new Map();
 function mark(n){if(!n)return;if(n.type==='Literal'&&typeof n.value==='string'){const next=titleCase(n.value);if(next!==n.value)picked.set(n.start,{start:n.start,end:n.end,before:n.value,after:next});}else if(n.type==='BinaryExpression'&&n.operator==='+'){mark(n.left);mark(n.right);}else if(n.type==='ArrayExpression')n.elements.forEach(mark);else if(n.type==='ConditionalExpression'){mark(n.consequent);mark(n.alternate);}else if(n.type==='LogicalExpression'){mark(n.left);mark(n.right);}else if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&['_','N_'].includes(n.callee.name))mark(n.arguments[0]);}
 const helpers=new Map();
 function collect(n){if(!n||typeof n!=='object')return;const fn=n.type==='VariableDeclarator'&&['FunctionExpression','ArrowFunctionExpression'].includes(n.init?.type)?n.init:n.type==='FunctionDeclaration'?n:n.type==='Property'&&['FunctionExpression','ArrowFunctionExpression'].includes(n.value?.type)?n.value:null;const name=n.type==='VariableDeclarator'?n.id?.name:n.type==='FunctionDeclaration'?n.id?.name:n.type==='Property'?(n.key.name||n.key.value):null;if(fn&&name){const positions=[];fn.params.forEach((p,i)=>{if(p.type==='Identifier'&&/^(?:label|title|caption)$/i.test(p.name))positions.push(i);});if(positions.length)helpers.set(name,positions);}for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(x=>x?.type&&collect(x));else if(v?.type)collect(v);}}collect(tree);
 function str(n){return n?.type==='Literal'?n.value:undefined;}
 function prop(n){return n?.computed?str(n.property):n?.property?.name;}
 function walk(n){if(!n||typeof n!=='object')return;
  if(n.type==='Property'&&!n.computed&&['label','title','caption','aria-label'].includes(n.key.name||str(n.key)))mark(n.value);
  if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&['textContent','innerText'].includes(prop(n.left))){const object=code.slice(n.left.object.start,n.left.object.end);if(/title|label|button|heading|caption/i.test(object))mark(n.right);}
  if(n.type==='CallExpression'){
   const c=n.callee,a=n.arguments,name=c.type==='Identifier'?c.name:c.type==='MemberExpression'?prop(c):'';
   if(c.type==='MemberExpression'&&name==='setAttribute'&&['aria-label','title'].includes(str(a[0])))mark(a[1]);
   if(c.type==='MemberExpression'&&['showModal','createButton','createCard','createField','createDetailItem','createInfoItem','createInlineCheck'].includes(name))mark(a[0]);
   if(c.type==='MemberExpression'&&['head','card','field','toggle','stat','button'].includes(name)&&/^(?:settings|kit)$/.test(code.slice(c.object.start,c.object.end)))mark(a[0]);
   if(c.type==='Identifier'&&['field','check','stat','button'].includes(name))mark(a[0]);
   if(helpers.has(name))helpers.get(name).forEach(i=>mark(a[i]));
   if(c.type==='Identifier'&&name==='select')for(const options of a)if(options?.type==='ArrayExpression')for(const pair of options.elements||[])if(pair?.type==='ArrayExpression')mark(pair.elements[1]);
   if(c.type==='MemberExpression'&&name==='map'&&c.object.type==='ArrayExpression'&&a[0]&&/E\(['"](?:button|option)['"]/.test(code.slice(a[0].start,a[0].end)))for(const pair of c.object.elements)if(pair?.type==='ArrayExpression')mark(pair.elements[1]);
   if(c.type==='MemberExpression'&&['option','taboption'].includes(name))mark(a[name==='option'?2:3]);
   if(c.type==='MemberExpression'&&name==='section'&&a[0]?.type==='MemberExpression'){const type=prop(a[0]);if(type==='NamedSection')mark(a[3]);else if(['TypedSection','GridSection','TableSection'].includes(type))mark(a[2]);}
   if(c.type==='MemberExpression'&&name==='tab')mark(a[1]);
   if(c.type==='MemberExpression'&&name==='value'&&a.length>=2)mark(a[1]);
   if(c.type==='Identifier'&&['E','make'].includes(name)){
    const tag=str(a[0]);
    if(/^(h[1-6]|summary|button|th|dt|legend|strong)$/.test(tag||''))mark(a[2]||a[1]);
    if(tag==='label')mark(a[2]);
    if(['span','div'].includes(tag)&&a[1]?.type==='ObjectExpression'){
     const attrs=Object.fromEntries(a[1].properties.filter(p=>p.type==='Property').map(p=>[p.key.name||str(p.key),str(p.value)]));
     if(attrs.role==='heading'||/(?:^|[-_ ])(?:title|label|heading|caption)(?:$|[-_ ])/.test(attrs.class||''))mark(a[2]);
    }
   }
  }
  for(const [k,v]of Object.entries(n)){if(k==='start'||k==='end')continue;if(Array.isArray(v))v.forEach(x=>x&&typeof x.type==='string'&&walk(x));else if(v&&typeof v.type==='string')walk(v);}
 }
 walk(tree);const changes=[...picked.values()].sort((a,b)=>b.start-a.start);let output=code;for(const c of changes)output=output.slice(0,c.start)+(code[c.start]==="'"?"'"+c.after.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'":JSON.stringify(c.after))+output.slice(c.end);return {output,changes};
}
function run(root,write){const records=[];let files=0;const base=fs.statSync(root).isDirectory()?root:path.dirname(root);function walk(target){const stat=fs.statSync(target);if(stat.isDirectory()){for(const item of fs.readdirSync(target,{withFileTypes:true}))if(item.isDirectory()||item.isFile())walk(path.join(target,item.name));}else if(stat.isFile()&&target.endsWith('.js')){files++;const result=transform(fs.readFileSync(target,'utf8'));if(result.changes.length){if(write)fs.writeFileSync(target,result.output);records.push({file:path.relative(base,target),changes:result.changes.map(({before,after})=>({before,after}))});}}}walk(root);return{files,changedFiles:records.length,labels:records.reduce((n,r)=>n+r.changes.length,0),records};}
function runMenus(root,write){const records=[];let files=0;for(const file of fs.readdirSync(root)){if(!file.endsWith('.json'))continue;files++;const target=path.join(root,file),data=JSON.parse(fs.readFileSync(target,'utf8')),changes=[];for(const [route,node] of Object.entries(data)){if(typeof node.title!=='string'||node.title==='IPV6')continue;const next=titleCase(node.title);if(next!==node.title){changes.push({route,before:node.title,after:next});node.title=next;}}if(changes.length){if(write)fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');records.push({file,changes});}}return{files,changedFiles:records.length,labels:records.reduce((n,r)=>n+r.changes.length,0),records};}
if(require.main===module){const root=process.argv[2],write=process.argv.includes('--write'),out=process.argv.find(a=>a.startsWith('--report='));const report=(process.argv.includes('--menus')?runMenus:run)(root,write);if(out)fs.writeFileSync(out.slice(9),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({files:report.files,changedFiles:report.changedFiles,labels:report.labels}));}
module.exports={titleCase,transform,run,runMenus};
