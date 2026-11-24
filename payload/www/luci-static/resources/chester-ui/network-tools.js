
'use strict';'require baseclass';
function ip(value){const p=String(value||'').split('.');if(p.length!==4||p.some(v=>!/^(?:0|[1-9]\d{0,2})$/.test(v)||Number(v)>255))throw new Error('Enter a valid IPv4 address.');return p.reduce((n,v)=>n*256+Number(v),0)>>>0;}
function text(n){return [24,16,8,0].map(s=>(n>>>s)&255).join('.');}
function range(address,prefix){const n=ip(address),bits=Number(prefix);if(!Number.isInteger(bits)||bits<1||bits>32)throw new Error('Invalid network prefix.');const mask=(0xffffffff<<(32-bits))>>>0;return {ip:n,first:(n&mask)>>>0,last:((n&mask)|(~mask))>>>0,mask,prefix:bits};}
function maskPrefix(mask){const bits=ip(mask).toString(2).padStart(32,'0');if(!/^1+0*$/.test(bits))throw new Error('Invalid subnet mask.');return bits.indexOf('0')<0?32:bits.indexOf('0');}
function overlaps(a,b){return a.first<=b.last&&b.first<=a.last;}
function validateGuest(v,networks,radios,wan){
 const bytes=s=>new TextEncoder().encode(String(s)).length;
 if(!v.ssid||bytes(v.ssid)>32||/[\x00-\x1f\x7f]/.test(v.ssid))throw new Error('Use a WiFi name between 1 and 32 bytes without control characters.');
 if(v.enabled&&(bytes(v.password)<8||bytes(v.password)>63||/[\x00-\x1f\x7f]/.test(v.password)))throw new Error('Use a guest WiFi password between 8 and 63 bytes.');
 if(!['psk2','sae-mixed'].includes(v.encryption))throw new Error('Choose a supported security mode.');
 if(!v.radios.length||v.radios.some(id=>!radios.some(r=>r.id===id)))throw new Error('Choose at least one available WiFi band.');
 if(v.enabled&&v.radios.some(id=>radios.find(r=>r.id===id)?.disabled))throw new Error('Enable the selected radios in Wireless before enabling Guest WiFi.');
 const subnet=range(v.address,24),first=subnet.ip>>>24;if(first===0||first===127||first>=224||subnet.ip===subnet.first||subnet.ip===subnet.last)throw new Error('Choose a usable guest router address.');
 if(![['10.0.0.0',8],['172.16.0.0',12],['192.168.0.0',16]].some(([a,b])=>{const r=range(a,b);return subnet.first>=r.first&&subnet.last<=r.last;}))throw new Error('Use a private guest subnet, such as 192.168.50.1.');if((subnet.ip&255)>=100&&(subnet.ip&255)<=199)throw new Error('Choose a router address outside the automatic .100–.199 address pool.');
 if(networks.some(n=>overlaps(subnet,n)))throw new Error('The guest subnet overlaps an existing LAN, WAN, VLAN or VPN network. Choose another /24 subnet.');
 if(v.enabled&&!wan)throw new Error('Configure an Internet firewall zone before enabling the guest network.');
 return subnet;
}
function guestPlan(v,radios,wan){
 const plan=[],add=(config,sid,type,options)=>plan.push({config,sid,type,options:{...options,chester_guest:'1'}}),on=v.enabled;
 add('network','chester_guest_bridge','device',{name:'br-ct-guest',type:'bridge',bridge_empty:'1',ipv6:'0'});
 add('network','chester_guest','interface',{device:'br-ct-guest',proto:'static',ipaddr:v.address,netmask:'255.255.255.0',delegate:'0',ipv6:'0',disabled:on?'0':'1'});
 add('dhcp','chester_guest','dhcp',{interface:'chester_guest',start:'100',limit:'100',leasetime:'4h',dhcpv4:'server',dhcpv6:'disabled',ra:'disabled',ignore:on?'0':'1'});
 for(const [i,radio] of radios.entries())if(v.radios.includes(radio.id))add('wireless','chester_guest_'+i,'wifi-iface',{device:radio.id,network:['chester_guest'],mode:'ap',ssid:v.ssid,encryption:v.encryption,key:v.password,isolate:v.isolate?'1':'0',bridge_isolate:v.isolate?'1':'0',disabled:on?'0':'1'});
 add('firewall','chester_guest_zone','zone',{name:'chester_guest',network:['chester_guest'],input:'REJECT',output:'ACCEPT',forward:'REJECT'});
 if(wan)add('firewall','chester_guest_internet','forwarding',{src:'chester_guest',dest:wan,enabled:on?'1':'0'});
 add('firewall','chester_guest_dns','rule',{name:'Chester Guest DNS',src:'chester_guest',proto:['tcp','udp'],dest_port:'53',target:'ACCEPT',family:'ipv4'});
 add('firewall','chester_guest_dhcp','rule',{name:'Chester Guest DHCP',src:'chester_guest',proto:'udp',dest_port:'67',target:'ACCEPT',family:'ipv4'});
 add('firewall','chester_guest_private','rule',{name:'Chester Guest Private Networks',src:'chester_guest',dest:'*',dest_ip:['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.168.0.0/16'],proto:'all',family:'ipv4',target:'REJECT'});
 add('firewall','chester_guest_ipv6','rule',{name:'Chester Guest IPv6 Isolation',src:'chester_guest',dest:'*',proto:'all',family:'ipv6',target:'REJECT'});
 return plan;
}
function validateDMZ(v,lan){if(!v.enabled)return;if(!v.wan)throw new Error('Choose an Internet firewall zone.');const n=ip(v.address);if(n<=lan.first||n>=lan.last||n===lan.ip)throw new Error('Choose a device address inside your main LAN, excluding the router and network addresses.');if(!v.confirmed)throw new Error('Confirm that you understand the device will receive unsolicited inbound IPv4 traffic.');}
return baseclass.extend({ip,text,range,maskPrefix,overlaps,validateGuest,guestPlan,validateDMZ});
