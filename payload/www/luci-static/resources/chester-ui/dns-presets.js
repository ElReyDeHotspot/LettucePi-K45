'use strict';
'require baseclass';
// Public resolver addresses verified against the providers' documentation.
const presets=[
 {id:'cloudflare',name:'Cloudflare',detail:'Standard',ipv4:['1.1.1.1','1.0.0.1'],ipv6:['2606:4700:4700::1111','2606:4700:4700::1001'],source:'https://developers.cloudflare.com/1.1.1.1/ip-addresses/'},
 {id:'google',name:'Google',detail:'Standard',ipv4:['8.8.8.8','8.8.4.4'],ipv6:['2001:4860:4860::8888','2001:4860:4860::8844'],source:'https://developers.google.com/speed/public-dns/docs/using'},
 {id:'quad9',name:'Quad9',detail:'Threat Blocking',ipv4:['9.9.9.9','149.112.112.112'],ipv6:['2620:fe::fe','2620:fe::9'],source:'https://docs.quad9.net/services/'},
 {id:'adguard',name:'AdGuard DNS',detail:'Ads & Trackers',ipv4:['94.140.14.14','94.140.15.15'],ipv6:['2a10:50c0::ad1:ff','2a10:50c0::ad2:ff'],source:'https://adguard-dns.io/en/public-dns.html'}
];
const lines=v=>String(v||'').split(/[\s,]+/).filter(Boolean).map(s=>s.toLowerCase());
return baseclass.extend({presets,fill(id,ipv4,ipv6){const p=presets.find(p=>p.id===id);if(!p)throw new Error('Unknown DNS preset.');ipv4.value=p.ipv4.join('\n');ipv6.value=p.ipv6.join('\n');return p;},selected(ipv4,ipv6){return presets.find(p=>JSON.stringify(lines(ipv4))===JSON.stringify(p.ipv4)&&JSON.stringify(lines(ipv6))===JSON.stringify(p.ipv6))?.id||'';}});
