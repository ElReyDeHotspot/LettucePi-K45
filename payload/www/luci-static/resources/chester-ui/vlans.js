'use strict';
'require baseclass';

// Pure planner: the view stages this plan only after review. No RPC or writes here.
function ipNumber(text){
 const parts=String(text).split('.');
 if(parts.length!==4||parts.some(p=>!/^\d{1,3}$/.test(p)||Number(p)>255||String(Number(p))!==p))return null;
 return parts.reduce((n,p)=>n*256+Number(p),0);
}
function cidr(text){
 const parts=String(text).trim().split('/'),ip=ipNumber(parts[0]),prefix=Number(parts[1]);
 if(parts.length!==2||ip===null||!/^\d+$/.test(parts[1])||prefix<16||prefix>30)return null;
 const size=2**(32-prefix),start=Math.floor(ip/size)*size;
 return {ip,address:parts[0],prefix,start,end:start+size-1,size,mask:[24,16,8,0].map(s=>Math.floor((2**32-size)/2**s)%256).join('.')};
}
function overlap(a,b){return a.start<=b.end&&b.start<=a.end;}
function validate(model){
 const errors=[],ids=new Set([1]),names=new Set(),subnets=[];
 if(model.blocked)errors.push(model.blocked);
 for(const n of model.networks){
  const id=Number(n.id),name=String(n.name||'').trim(),subnet=cidr(n.cidr);
  if(!Number.isInteger(id)||id<2||id>4094||ids.has(id))errors.push('Each VLAN needs a unique ID from 2 to 4094.');ids.add(id);
  if(!name||name.length>32||names.has(name.toLowerCase()))errors.push('Use a unique network name, up to 32 characters.');names.add(name.toLowerCase());
  if(!subnet||subnet.ip!==subnet.start+1||!(subnet.address.startsWith('10.')||subnet.address.startsWith('192.168.')||(/^172\.(1[6-9]|2\d|3[01])\./.test(subnet.address))))errors.push(name+': use a private IPv4 gateway at the first usable address, for example 192.168.20.1/24.');
  else {if([...(model.reserved||[]),...subnets].some(other=>overlap(subnet,other)))errors.push(name+': this subnet overlaps another router network.');subnets.push(subnet);}
  if(n.internet&&!model.wanZone)errors.push('No Internet firewall zone was found. Turn off Internet access for this network.');
 }
 let managementPorts=0;
 for(const port of model.ports){
  if(port.native===1)managementPorts++;
  if(!ids.has(Number(port.native)))errors.push(port.name+': choose a valid default network.');
  if((port.tagged||[]).some(id=>!ids.has(Number(id))||Number(id)===Number(port.native)))errors.push(port.name+': tagged networks must differ from the default network.');
 }
 if(!managementPorts)errors.push('Keep at least one Ethernet port on the Main LAN so you can manage the router.');
 for(const n of model.networks)if(!model.ports.some(p=>Number(p.native)===Number(n.id)||(p.tagged||[]).map(Number).includes(Number(n.id))))errors.push(n.name+': assign at least one port before applying.');
 return [...new Set(errors)];
}
function plan(model){
 const errors=validate(model);if(errors.length)throw new Error(errors.join('\n'));
 const ops=[],set=(config,sid,key,value)=>ops.push({action:'set',config,sid,key,value}),add=(config,type,sid,values)=>{ops.push({action:'add',config,type,sid});for(const [key,value] of Object.entries(values))set(config,sid,key,value);};
 for(const old of model.managed||[])ops.push({action:'remove',config:old.config,sid:old.sid});
 if(!model.networks.length){
  // Return to the plain bridge only when this page previously enabled filtering.
  if(model.wasManaged){set('network',model.bridgeSid,'vlan_filtering','0');set('network','lan','device',model.bridge);}
  return ops;
 }
 set('network',model.bridgeSid,'vlan_filtering','1');set('network','lan','device',model.bridge+'.1');
 for(const id of [1,...model.networks.map(n=>Number(n.id))]){
  const ports=model.ports.flatMap(p=>Number(p.native)===id?[p.name+':u*']:(p.tagged||[]).map(Number).includes(id)?[p.name+':t']:[]);
  add('network','bridge-vlan','cv'+id+'_ports',{device:model.bridge,vlan:String(id),ports,chester_vlan:'1',local:'1'});
 }
 for(const n of model.networks){
  const id=Number(n.id),sid='cv'+id,subnet=cidr(n.cidr);
  add('network','interface',sid,{proto:'static',device:model.bridge+'.'+id,ipaddr:subnet.address,netmask:subnet.mask,chester_vlan:'1',chester_name:n.name});
  add('dhcp','dhcp',sid,{interface:sid,start:'2',limit:String(Math.min(150,subnet.size-3)),leasetime:'12h',ignore:n.dhcp?'0':'1',ra:'disabled',dhcpv6:'disabled',ndp:'disabled',chester_vlan:'1'});
  add('firewall','zone',sid+'_zone',{name:sid,network:[sid],input:'REJECT',output:'ACCEPT',forward:'REJECT',chester_vlan:'1'});
  add('firewall','rule',sid+'_dns',{name:'Chester '+n.name+' DNS',src:sid,proto:'tcp udp',dest_port:'53',target:'ACCEPT',family:'ipv4',chester_vlan:'1'});
  if(n.dhcp)add('firewall','rule',sid+'_dhcp',{name:'Chester '+n.name+' DHCP',src:sid,proto:'udp',src_port:'68',dest_port:'67',target:'ACCEPT',family:'ipv4',chester_vlan:'1'});
  if(n.internet)add('firewall','forwarding',sid+'_internet',{src:sid,dest:model.wanZone,chester_vlan:'1'});
 }
 return ops;
}
return baseclass.extend({ipNumber,cidr,overlap,validate,plan});
