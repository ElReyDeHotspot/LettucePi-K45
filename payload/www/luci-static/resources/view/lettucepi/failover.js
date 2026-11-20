'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';

var status=rpc.declare({object:'failover',method:'status',expect:{}});
var interfaces=rpc.declare({object:'network.interface',method:'dump',expect:{interface:[]}});
var save=rpc.declare({object:'failover',method:'set_config',params:['enabled','mode','primary','backup','targets','interval','fail_count','recover_count'],expect:{}});
var builtinPorts=rpc.declare({object:'luci',method:'getBuiltinEthernetPorts',expect:{result:[]}});
var devices=rpc.declare({object:'network.device',method:'status',expect:{'':{}}});
var wanRole=rpc.declare({object:'misectel',method:'wan_to_lan',expect:{}});
var setWanRole=rpc.declare({object:'misectel',method:'set_wan_to_lan',params:['enabled'],expect:{}});
var CSS='.fo-page{max-width:1040px;margin:auto;padding:18px 8px 32px;color:#172033}.fo-page .fo-ports{grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-flow:row;grid-auto-columns:auto;gap:8px}.fo-ports .misectel-dashboard-port-panel__port{min-width:0;min-height:86px;padding:16px 8px 12px;font-family:inherit;display:flex;flex-direction:column;justify-content:flex-start;align-items:stretch}.fo-ports button{appearance:none;width:100%;font-size:inherit}.fo-ports .misectel-dashboard-port-panel__name{font-size:16px}.fo-ports .misectel-dashboard-port-panel__speed{font-size:12px}.fo-ports button:disabled{cursor:wait;opacity:.6}.fo-page *{box-sizing:border-box}.fo-heading{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:18px}.fo-heading h2{margin:0;font-size:25px}.fo-muted{color:#69778b;font-size:13px}.fo-card{border:1px solid #dfe6ee;border-radius:18px;padding:22px;margin-bottom:18px;background:#fff;box-shadow:0 5px 20px #20365408}.fo-card h3{margin:0 0 14px;font-size:16px}.fo-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.fo-state{font-size:22px;font-weight:700;margin-bottom:6px}.fo-pill{border-radius:20px;padding:6px 12px;background:#edf2f7;font-size:12px;font-weight:700}.fo-pill.online{background:#e4f6ec;color:#17814d}.fo-pill.offline{background:#fcecec;color:#bd3740}.fo-kv{display:grid;grid-template-columns:105px 1fr;gap:7px;font-size:13px}.fo-kv span:nth-child(odd){color:#69778b}.fo-kv span:nth-child(even){overflow-wrap:anywhere}.fo-field{display:flex;flex-direction:column;gap:7px;font-size:13px;margin-bottom:16px}.fo-page input:not([type=checkbox]),.fo-page select{width:100%;min-width:0;height:41px;border:1px solid #cad5e2;border-radius:9px;padding:8px 11px;background:#fafcff}.fo-check{display:flex;align-items:center;gap:10px;font-size:14px}.fo-check input{width:18px;height:18px}.fo-help{padding:13px 16px;border-radius:12px;background:#edf5ff;color:#345778;font-size:13px;margin-bottom:18px}.fo-log{max-height:210px;overflow:auto;white-space:pre-wrap;font-size:12px;color:#53647b;margin:0}.fo-actions{display:flex;justify-content:flex-end;gap:12px;align-items:center}.fo-save{padding:10px 22px;border:0;border-radius:10px;background:#d8273e;color:white;font-weight:700;cursor:pointer}.fo-result{font-size:13px}.fo-result.error{color:#bd3740}@media(max-width:720px){.fo-grid{grid-template-columns:1fr}.fo-card{padding:18px}.fo-heading{align-items:flex-start}}';

return view.extend({
    load:function(){return Promise.all([status(),interfaces(),builtinPorts(),devices(),wanRole(),uci.load('misectel')]);},
    render:function(data){
        if(!document.getElementById('k45p-failover-css'))document.head.appendChild(E('style',{id:'k45p-failover-css'},[CSS]));
        if(!document.getElementById('misectel-dashboard-css'))document.head.appendChild(E('link',{id:'misectel-dashboard-css',rel:'stylesheet',href:L.resource('misectel-dashboard/dashboard.css')}));
        var self=this, s=data[0]||{}, c=s.config||{}, names=['wan',c.primary||'wan',c.backup||'pcie0'];
        (data[1]||[]).forEach(function(i){if(i.interface!=='lan'&&i.interface!=='loopback')names.push(i.interface);});
        names=names.filter(function(n,i,a){return a.indexOf(n)===i;});
        function select(value,options){var e=E('select');options.forEach(function(o){e.appendChild(E('option',{value:o[0]},[o[1]]));});e.value=value;return e;}
        function field(label,node){return E('label',{'class':'fo-field'},[E('span',{},[label]),node]);}
        function number(value,min,max){return E('input',{type:'number',value:String(value),min:min,max:max});}
        this.wanIsLan=!!(data[4]||{}).enabled;
        this.portBusy=false;
        this.portBox=E('div',{'class':'misectel-dashboard-port-panel fo-ports','aria-label':'Ethernet ports'});
        var labels={}, rawLabels=uci.get('misectel','clients','port_labels')||'';
        String(Array.isArray(rawLabels)?rawLabels.join(' '):rawLabels).split(/[\s,]+/).forEach(function(pair){var kv=pair.split('=');if(kv.length===2)labels[kv[0].toLowerCase()]=kv[1];});
        this.portEntries=(data[2]||[]).filter(function(p){return /^lan[123]$|^wan$/.test(p.device);}).sort(function(a,b){return (a.device==='wan'?99:+a.device.replace('lan',''))-(b.device==='wan'?99:+b.device.replace('lan',''));}).map(function(p){
            var isWan=p.device==='wan', label=E('strong',{'class':'misectel-dashboard-port-panel__name'}), speed=E('div',{'class':'misectel-dashboard-port-panel__speed'});
            var node=E(isWan?'button':'div',isWan?{type:'button',click:ui.createHandlerFn(self,function(){return self.toggleWanPort();})}:{},[label,speed]);
            self.portBox.appendChild(node);return {device:p.device,isWan:isWan,label:label,speed:speed,node:node,name:labels[p.device]||p.device.toUpperCase()};
        });
        this.wanNotice=E('div',{'class':'fo-help'},['The Ethernet WAN socket is currently a LAN port. Click its icon above to restore WAN before enabling Automatic or WAN only.']);
        this.enable=E('input',{type:'checkbox'});this.enable.checked=!!c.enabled;
        this.mode=select(c.mode||'auto',[['auto','Automatic'],['wan','WAN only'],['cell','Cellular only']]);
        var opts=names.map(function(n){return[n,n];});
        this.primary=select(c.primary||'wan',opts);this.backup=select(c.backup||'pcie0',opts);
        this.targets=E('input',{type:'text',value:(c.targets||[]).join(', ')});
        this.interval=number(c.interval||5,2,300);this.fail=number(c.fail_count||3,1,60);this.recover=number(c.recover_count||6,1,120);
        this.headline=E('div',{'class':'fo-state'});this.description=E('div',{'class':'fo-muted'});this.badge=E('span',{'class':'fo-pill'});
        this.wanCard=E('div',{'class':'fo-card'});this.cellCard=E('div',{'class':'fo-card'});this.events=E('pre',{'class':'fo-log'});this.message=E('span',{'class':'fo-result','aria-live':'polite'});
        var btn=E('button',{'class':'fo-save',type:'button',click:ui.createHandlerFn(this,async function(){
            this.message.textContent='Saving…';this.message.className='fo-result';
            try{var r=await save(this.enable.checked?'1':'0',this.mode.value,this.primary.value,this.backup.value,this.targets.value,this.interval.value,this.fail.value,this.recover.value);
                if(!r.success)throw new Error(r.error||'Could not save settings.');this.message.textContent='Saved';this.update(await status());
            }catch(e){this.message.className='fo-result error';this.message.textContent=e.message;}
        })},['Save settings']);
        var root=E('div',{'class':'fo-page'},[
            E('div',{'class':'fo-heading'},[E('div',{},[E('h2',{},['Failover']),E('div',{'class':'fo-muted'},['Physical WAN primary · Cellular backup'])]),this.badge]),
            E('div',{'class':'fo-card'},[this.portBox,E('div',{'class':'fo-muted',style:'margin-top:14px'},['Click the WAN socket to switch between WAN and LAN. A connected device may briefly disconnect.'])]),
            E('div',{'class':'fo-card'},[this.headline,this.description]),
            this.wanNotice,
            E('div',{'class':'fo-grid'},[this.wanCard,this.cellCard]),
            E('div',{'class':'fo-card'},[E('h3',{},['Mode and uplinks']),E('label',{'class':'fo-check'},[this.enable,'Enable Failover']),E('div',{'class':'fo-grid',style:'margin-top:18px'},[field('Operating mode',this.mode),field('Primary WAN interface',this.primary),field('Cellular backup interface',this.backup)])]),
            E('div',{'class':'fo-card'},[E('h3',{},['Health checks']),field('Ping targets (one to six IPv4 addresses)',this.targets),E('div',{'class':'fo-grid'},[field('Seconds between checks',this.interval),field('Failed checks before switching',this.fail),field('Healthy checks before returning to WAN',this.recover)]),E('div',{'class':'fo-muted'},['Checks run through each uplink. Existing connections may reconnect when the uplink changes. This page manages IPv4; IPv6 retains its existing configuration.'])]),
            E('div',{'class':'fo-actions'},[this.message,btn]),E('div',{'class':'fo-card',style:'margin-top:18px'},[E('h3',{},['Recent events']),this.events])
        ]);
        this.updatePorts(data[3]||{},data[4]||{});
        poll.add(async function(){if(self.portBusy)return;try{var d=await Promise.all([devices(),wanRole()]);if(!self.portBusy)self.updatePorts(d[0],d[1]);}catch(e){}},10);
        this.update(s);poll.add(async function(){try{self.update(await status());}catch(e){self.badge.textContent='Status unavailable';}},3);return root;
    },
    updatePorts:function(map,role){
        this.wanIsLan=!!role.enabled;
        this.portEntries.forEach(function(p){
            var info=map[p.device]||{}, on=info.carrier===true, rate=parseFloat((String(info.speed||'').match(/[0-9.]+/)||['0'])[0]), tier=!on?'offline':rate>=1000?'gigabit':rate>=100?'fast':'slow';
            p.node.className='misectel-dashboard-port-panel__port is-'+tier+' is-'+(on?'online':info.carrier===false?'offline':'warn')+(p.isWan?' is-switchable':'');
            p.label.textContent=p.isWan?(role.enabled?'LAN':'WAN'):p.name;
            p.speed.textContent=on?(rate>=1000?((rate/1000)%1?(rate/1000).toFixed(1):rate/1000)+'Gbps':rate?rate+'Mbps':'Connected'):'';
            p.node.title=p.isWan?(role.enabled?'This socket is LAN. Click to make it WAN.':'This socket is WAN. Click to make it LAN.'):(on?'Connected':'Not connected');
            if(p.isWan){p.node.disabled=this.portBusy;p.node.setAttribute('aria-label',role.enabled?'Switch LAN socket to WAN':'Switch WAN socket to LAN');}
        },this);
        this.wanNotice.style.display=role.enabled?'':'none';
    },
    toggleWanPort:async function(){
        if(this.portBusy)return;
        var c=(this.lastStatus||{}).config||{};
        if(!this.wanIsLan&&c.enabled&&c.mode!=='cell'){
            this.message.className='fo-result error';this.message.textContent='Turn Failover off or select Cellular only before changing the WAN socket to LAN.';
            ui.addNotification(null,E('p',{},[this.message.textContent]));return;
        }
        this.portBusy=true;
        this.portEntries.forEach(function(p){if(p.isWan)p.node.disabled=true;});
        try{
            var r=await setWanRole(this.wanIsLan?'0':'1');
            if(!r.success)throw new Error(r.message||'Could not change the socket role.');
            this.wanIsLan=!!r.enabled;
            this.portEntries.forEach(function(p){if(p.isWan){p.label.textContent=r.enabled?'LAN':'WAN';p.node.title=r.enabled?'This socket is LAN. Click to make it WAN.':'This socket is WAN. Click to make it LAN.';p.node.setAttribute('aria-label',r.enabled?'Switch LAN socket to WAN':'Switch WAN socket to LAN');}});
            this.wanNotice.style.display=r.enabled?'':'none';
            ui.addNotification(null,E('p',{},['Socket changed to '+(r.enabled?'LAN':'WAN')+'. The network is reconnecting.']));
        }catch(e){ui.addNotification(null,E('p',{},[e.message]));}
        finally{this.portBusy=false;this.portEntries.forEach(function(p){if(p.isWan)p.node.disabled=false;});}
    },
    update:function(s){
        this.lastStatus=s;
        this.wanNotice.style.display=s.wan_is_lan?'':'none';
        var c=s.config||{}, enabled=!!c.enabled;
        this.badge.className='fo-pill'+(enabled?' online':'');this.badge.textContent=enabled?'Enabled':'Off';
        this.headline.textContent=!enabled?'Failover is off':!s.running?'Failover service is starting':s.active==='cell'?'Using cellular backup':'Using physical WAN';
        this.description.textContent=s.error||(!s.running?'Link monitoring is stopped. Uplink status is unavailable.':!enabled?'Your existing network routing is unchanged.':c.mode==='auto'?'Automatically returns to WAN after '+c.recover_count+' healthy checks.':c.mode==='cell'?'Cellular is selected.':'Physical WAN is selected.');
        function link(card,title,v){v=v||{};var known=!!s.running&&typeof v.up==='boolean',healthy=known&&v.up&&v.health==='up';card.replaceChildren(E('div',{style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:18px'},[E('h3',{style:'margin:0'},[title]),E('span',{'class':'fo-pill '+(healthy?'online':known?'offline':'')},[!known?'Not checked':!v.up?'Interface down':healthy?'Online':v.health==='down'?'No internet':'Checking…'])]),E('div',{'class':'fo-kv'},[E('span',{},['Interface']),E('span',{},[v.iface||'—']),E('span',{},['Device']),E('span',{},[v.dev==='-'?'—':v.dev||'—']),E('span',{},['IPv4']),E('span',{},[v.ip==='-'?'—':v.ip||'—']),E('span',{},['Gateway']),E('span',{},[v.gateway==='-'?'—':v.gateway||'—']),E('span',{},['Latency']),E('span',{},[v.rtt?v.rtt+' ms':'—'])]));}
        link(this.wanCard,'Physical WAN',s.wan);link(this.cellCard,'Cellular backup',s.cell);
        this.events.textContent=(s.log||[]).slice().reverse().join('\n')||'No events yet.';
    },
    handleSaveApply:null,handleSave:null,handleReset:null
});
