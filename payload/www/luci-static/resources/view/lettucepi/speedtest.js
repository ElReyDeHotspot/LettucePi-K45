'use strict';
'require view';
'require rpc';
'require dom';
'require ui';
'require poll';

var callStatus = rpc.declare({ object: 'luci.lettucepi.speedtest', method: 'status' });
var callHistory = rpc.declare({ object: 'luci.lettucepi.speedtest', method: 'history' });
var callStart = rpc.declare({ object: 'luci.lettucepi.speedtest', method: 'start' });
var callCancel = rpc.declare({ object: 'luci.lettucepi.speedtest', method: 'cancel' });

return view.extend({
	load: function() { return Promise.all([ callStatus(), callHistory() ]); },

	render: function(data) {
		var self = this;
		var root = E('div', { class: 'cbi-map lp-speedtest' }, [
 E('style',{},'.lp-speedtest{max-width:1040px;margin:auto;padding:18px 8px 30px;color:#172033;font-size:14px}.lp-speedtest *{box-sizing:border-box}.lp-st-card,.lp-st-history{background:#fff;border:1px solid #dfe6ee;border-radius:20px;padding:26px;margin-bottom:22px;box-shadow:0 3px 12px #243d5805}.lp-st-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.lp-st-brand{display:flex;align-items:center;gap:13px;font-size:19px;font-weight:650}.lp-st-brand-icon{display:grid;place-items:center;background:#edf4ff;color:#4d84ca;width:44px;height:44px;border-radius:13px;font-size:25px}.lp-st-caption{font-size:13px;color:#8190a3;font-weight:400;margin-top:5px}.lp-st-go.btn{border:0!important;border-radius:24px!important;background:#4285eb!important;color:#fff!important;font-size:13px!important;font-weight:650!important;min-height:44px!important;padding:11px 20px!important;cursor:pointer}.lp-st-go.btn:hover{background:#2f70ce!important}.lp-st-go.btn:disabled{opacity:.55}.lp-st-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.lp-st-metric{background:#f7f9fc;border:1px solid #f0f3f7;border-radius:13px;padding:18px 15px;min-width:0;display:flex;flex-direction:column-reverse;gap:10px;align-items:flex-start}.lp-st-value{font-size:30px;line-height:1.2;color:#24374c;font-weight:650;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.lp-st-label{color:#7a8798;font-size:11px}.lp-st-msg{color:#8190a3;font-size:12px;min-height:20px;margin:18px 0}.lp-st-details{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:22px 0 16px;padding-top:18px;border-top:1px solid #edf1f6;font-size:12px;color:#7b8899;overflow-wrap:anywhere}.lp-st-details strong{color:#52677f;font-weight:550}.lp-st-result{grid-column:1/-1}.lp-speedtest a{color:#4485d8;text-decoration:none}.lp-speedtest a:hover{text-decoration:underline}.lp-st-actions{display:flex;justify-content:flex-end;gap:10px}.lp-st-actions button{min-height:44px;border:1px solid #cfdae6;border-radius:24px;background:#fff;color:#516782;padding:10px 18px}.lp-st-foot{color:#8794a5;font-size:11px;line-height:1.6;margin:18px 0 0}.lp-st-history h3{font-size:17px;font-weight:650;margin:0 0 18px}.lp-st-history table{width:100%;border-collapse:collapse}.lp-st-history th,.lp-st-history td{padding:13px 9px;border-bottom:1px solid #edf1f6;text-align:left;font-size:12px;color:#52677f}.lp-st-history th{color:#8996a7;font-size:10px;font-weight:500}.lp-st-empty{color:#91a0b1;text-align:center;padding:24px 12px;font-size:13px}.lp-st-progress{height:5px;background:#eaf0f8;border-radius:5px;overflow:hidden;margin:18px 0}.lp-st-progress-bar{height:100%;background:#4b8bec;transition:width .4s;width:0}.lp-speedtest button:focus-visible,.lp-speedtest a:focus-visible{outline:3px solid #85b2ef;outline-offset:3px}@media(max-width:650px){.lp-speedtest{padding:12px 0 24px}.lp-st-card,.lp-st-history{padding:18px 16px;border-radius:17px}.lp-st-header{gap:16px}.lp-st-go.btn{width:100%}.lp-st-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.lp-st-metric{padding:16px 12px}.lp-st-value{font-size:28px}.lp-st-details{grid-template-columns:1fr;gap:9px}.lp-st-result{grid-column:auto}.lp-st-history table,.lp-st-history tbody{display:block}.lp-st-history thead{display:none}.lp-st-history tr{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #edf1f6;padding:12px 0}.lp-st-history td{border:0;padding:7px 4px;overflow-wrap:anywhere}.lp-st-history td:first-child,.lp-st-history td:nth-last-child(2),.lp-st-history td:last-child{grid-column:1/-1}.lp-st-history td[data-label]:before{content:attr(data-label);display:block;color:#8a98a9;font-size:10px;margin-bottom:4px}}@media(prefers-reduced-motion:reduce){.lp-st-progress-bar{transition:none}}'),
			E('div', { class: 'lp-st-card' }, [
                E('div',{class:'lp-st-header'},[E('div',{class:'lp-st-brand'},[E('span',{class:'lp-st-brand-icon','aria-hidden':'true'},'◴'),E('div',{},['Ookla Speedtest',E('div',{class:'lp-st-caption'},'Your router’s built-in connection test.')])]),E('button',{type:'button',class:'btn lp-st-go',id:'lp-st-start',click:ui.createHandlerFn(self,self.start)},E('span',{id:'lp-st-go-label'},'Run speed test'))]),
                E('div', { id: 'lp-st-msg', class: 'lp-st-msg', 'aria-live':'polite' }),
				E('div', { class: 'lp-st-grid' }, [
					self.metric('download', '—', '↓ Download · Mbps'),
					self.metric('upload', '—', '↑ Upload · Mbps'),
                    self.metric('ping', '—', 'Latency · ms'),
                    self.metric('jitter', '—', 'Jitter · ms')
				]),
                E('div',{id:'lp-st-progress',class:'lp-st-progress',role:'progressbar','aria-label':'Speed test progress','aria-valuemin':'0','aria-valuemax':'100'},E('div',{id:'lp-st-progress-bar',class:'lp-st-progress-bar'})),
				E('div', { class: 'lp-st-details' }, [
					E('div', {}, [ E('strong', {}, 'Provider: '), E('span', { id: 'lp-st-isp' }, '—') ]),
					E('div', {}, [ E('strong', {}, 'Server: '), E('span', { id: 'lp-st-server' }, '—') ]),
					E('div', {}, [ E('strong', {}, 'Location: '), E('span', { id: 'lp-st-location' }, '—') ]),
					E('div', {}, [ E('strong', {}, 'Packet loss: '), E('span', { id: 'lp-st-loss' }, '—') ]),
					E('div', { class: 'lp-st-result' }, [ E('strong', {}, 'Result: '), E('span', { id: 'lp-st-result' }, 'Available when the test finishes') ])
				]),
				E('div', { class: 'lp-st-actions' }, [
					E('button', { class: 'btn', id: 'lp-st-cancel', click: ui.createHandlerFn(self, self.cancel) }, 'Cancel')
				]),
				E('p', { class: 'lp-st-foot' }, 'Runs directly on this router. Tests use your internet connection and mobile data. Powered by Ookla.')
			]),
			E('div', { class: 'lp-st-history' }, [ E('h3', {}, 'Recent Tests'), E('div', { id: 'lp-st-history' }) ])
		]);
		poll.add(function() { return self.refresh(); }, 1);
		window.setTimeout(function() { self.update((data && data[0]) || {}); self.updateHistory((data && data[1]) || {}); }, 0);
		return root;
	},

	metric: function(id, value, label) {
		return E('div', { class: 'lp-st-metric lp-st-metric-' + id }, [ E('div', { class: 'lp-st-value', id: 'lp-st-' + id }, value), E('div', { class: 'lp-st-label' }, label) ]);
	},

	refresh: function() {
		var self = this;
		return Promise.all([ callStatus(), callHistory() ]).then(function(r) { self.update(r[0] || {}); self.updateHistory(r[1] || {}); });
	},

	update: function(r) {
		function set(id, value) { var n = document.getElementById(id); if (n) n.textContent = value; }
		set('lp-st-download', Number(r.download_mbps || 0) > 0 ? Number(r.download_mbps).toFixed(2) : '—');
		set('lp-st-upload', Number(r.upload_mbps || 0) > 0 ? Number(r.upload_mbps).toFixed(2) : '—');
		set('lp-st-ping', r.latency_ms ? Number(r.latency_ms).toFixed(1) : '—');
		set('lp-st-jitter', Number.isFinite(r.jitter_ms) ? r.jitter_ms.toFixed(1) : '—');
        set('lp-st-isp', r.isp || '—'); set('lp-st-server', r.server || '—');
		set('lp-st-location', r.location || '—'); set('lp-st-loss', r.packet_loss != null ? Number(r.packet_loss).toFixed(1) + '%' : '—');
		var result = document.getElementById('lp-st-result');
		if (result) result.replaceChildren(r.result_url ? E('a', { href: r.result_url, target: '_blank', rel: 'noopener noreferrer' }, 'View on Speedtest.net') : document.createTextNode('Available when the test finishes'));
		var stage = r.test_phase === 'ping' ? 'Measuring ping…' : r.test_phase === 'download' ? 'Measuring download…' : r.test_phase === 'upload' ? 'Measuring upload…' : 'Testing your connection…';
		var msg = !r.installed ? 'The built-in speed-test engine is unavailable.' : r.running ? stage : r.phase === 'completed' ? 'Last test complete' : r.phase === 'cancelled' ? 'Test cancelled' : r.phase === 'failed' ? 'The test could not complete. Check your connection and try again.' : 'Ready to test';
		set('lp-st-msg', msg);
		var start = document.getElementById('lp-st-start'), cancel = document.getElementById('lp-st-cancel'), dial = document.getElementById('lp-st-dial');
		if (start) start.disabled = !r.installed || !!r.running;
		set('lp-st-go-label', r.running ? (r.test_phase === 'upload' ? 'UPLOAD' : r.test_phase === 'download' ? 'DOWNLOAD' : 'PING') : 'Run speed test');
		if (cancel) {cancel.disabled = !r.running;cancel.style.display=r.running?'':'none';}
        var progress=document.getElementById('lp-st-progress'),bar=document.getElementById('lp-st-progress-bar');
        var pct=r.test_phase==='upload'?50+Math.min(1,r.progress||0)*50:r.test_phase==='download'?Math.max(5,Math.min(1,r.progress||0)*50):3;
        if(progress){progress.style.display=r.running?'':'none';progress.setAttribute('aria-valuenow',String(Math.round(pct)));}if(bar)bar.style.width=pct+'%';
		if (dial) dial.className = 'lp-st-dial' + (r.running ? ' running' : '') + (r.test_phase === 'upload' ? ' upload' : '');
	},

	updateHistory: function(payload) {
		var target = document.getElementById('lp-st-history');
		if (!target) return;
		var rows = (payload && payload.results) || [];
		if (!rows.length) { target.replaceChildren(E('div', { class: 'lp-st-empty' }, 'No completed tests yet.')); return; }
		rows = rows.slice().reverse().slice(0,5);
		var body = rows.map(function(r) {
			var when = r.timestamp ? new Date(Number(r.timestamp) * 1000).toLocaleString() : '—';
			return E('tr', {}, [
				E('td', {}, when), E('td', {'data-label':'Download · Mbps'}, Number(r.download_mbps || 0).toFixed(2)),
				E('td', {'data-label':'Upload · Mbps'}, Number(r.upload_mbps || 0).toFixed(2)), E('td', {'data-label':'Latency · ms'}, Number(r.latency_ms || 0).toFixed(1)),
				E('td', {'data-label':'Jitter · ms'}, Number.isFinite(r.jitter_ms)?r.jitter_ms.toFixed(1):'—'),
                E('td', {}, (r.server || '—') + (r.location ? ' · ' + r.location : '')),
				E('td', {}, r.result_url ? E('a', { href: r.result_url, target: '_blank', rel: 'noopener noreferrer' }, 'View') : '—')
			]);
		});
		target.replaceChildren(E('table', {}, [ E('thead', {}, E('tr', {}, [ E('th', {}, 'Date'), E('th', {}, 'Down'), E('th', {}, 'Up'), E('th', {}, 'Latency'),E('th',{},'Jitter'), E('th', {}, 'Server'), E('th', {}, 'Result') ])), E('tbody', {}, body) ]));
	},

	start: function() { var self = this; return callStart().then(function(r) { if (r && r.error) ui.addNotification(null, E('p', {}, r.error)); return self.refresh(); }); },
	cancel: function() { var self = this; return callCancel().then(function() { return self.refresh(); }); },

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
