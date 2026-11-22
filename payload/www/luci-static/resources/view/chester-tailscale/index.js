'use strict';
'require view';
'require fs';
'require ui';
'require chester-ui.settings as settings';

/* Tailscale control panel.
 *
 * Tailscale is not in the firmware; "Install" fetches it from the package feed.
 * All work happens in /usr/sbin/chester-tailscale -- the rpcd ACL permits
 * exactly the argument forms used here and nothing else.
 *
 * `tailscale up` blocks until the browser login completes, so the backend
 * backgrounds it and hands back the login URL; this view shows it as a link and
 * then polls until the node reports Running.
 */

function row(label,value){return E('div',{'class':'ts-detail'},[E('span',{},[label]),E('strong',{},[value||'—'])]);}
function btn(label,cls,handler){return settings.button(label,handler,{'class':'st-button '+cls});}
function mesh(){var logo=E('span',{'class':'ts-mark','aria-hidden':'true'});logo.innerHTML='<svg viewBox="0 0 52 52" fill="currentColor">'+[10,26,42].map(function(y){return [10,26,42].map(function(x){return '<circle cx="'+x+'" cy="'+y+'" r="4.5"/>';}).join('');}).join('')+'</svg>';return logo;}

return view.extend({
	load: function () {
		return fs.exec('/usr/sbin/chester-tailscale', [ 'status' ]).then(function (r) {
			try { return JSON.parse((r.stdout || '').trim()); }
			catch (e) { return { ok: false, error: 'unreadable' }; }
		}).catch(function () { return { ok: false, error: 'denied' }; });
	},

	refresh: function () {
		var self = this;
		return self.load().then(function (info) {
			var body = self.render(info);
			var old = document.querySelector('#view');
			if (old) { old.innerHTML = ''; old.appendChild(body); }
		});
	},

	/* Login URL handling: show it, keep it clickable, and stop polling once the
	 * node actually comes up. */
	showAuth: function (url) {
		var self = this;
		ui.showModal(_('Sign in to Tailscale'), [
			E('p', {}, _('Open this link, sign in, and this router joins your tailnet.')),
			E('p', {}, [ E('a', { 'href': url, 'target': '_blank', 'rel': 'noreferrer',
				'style': 'word-break:break-all' }, url) ]),
			E('p', { 'class': 'spinning' }, _('Waiting for sign-in to complete...')),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': function () { ui.hideModal(); self.refresh(); } }, _('Close'))
			])
		], 'chester-tailscale-modal');
		var tries = 0;
		var tick = function () {
			if (++tries > 60) return;
			fs.exec('/usr/sbin/chester-tailscale', [ 'authurl' ]).then(function (r) {
				var d = {};
				try { d = JSON.parse((r.stdout || '').trim()); } catch (e) { return; }
				if (d.backend === 'Running') { ui.hideModal(); self.refresh(); return; }
				window.setTimeout(tick, 3000);
			}).catch(function () {});
		};
		window.setTimeout(tick, 3000);
	},

	run: function (action, busyText, ev) {
		var self = this;
		ui.showModal(_('Tailscale'), [ E('p', { 'class': 'spinning' }, busyText) ], 'chester-tailscale-modal');
		return fs.exec('/usr/sbin/chester-tailscale', [ action ]).then(function (r) {
			var out = (r.stdout || '').trim();
			ui.hideModal();
			if (out.indexOf('OK:') !== 0) {
				ui.addNotification(null, E('p', {}, out || _('Action failed.')), 'danger');
				return self.refresh();
			}
			var msg = out.replace(/^OK:\s*/, '');
			/* connect / connect-ssh answer with the login URL when the node is
			 * not authenticated yet. */
			if (/^https:\/\//.test(msg)) return self.showAuth(msg);
			ui.addNotification(null, E('p', {}, msg), 'info');
			return self.refresh();
		}).catch(function (err) {
			ui.hideModal();
			ui.addNotification(null, E('p', {}, String(err)), 'danger');
		});
	},

	confirmThen: function (title, warning, action, busyText) {
		var self = this;
		ui.showModal(title, [
			E('p', {}, warning),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-remove',
					'click': ui.createHandlerFn(self, function () {
						ui.hideModal();
						return self.run(action, busyText);
					})
				}, _('Continue'))
			])
		], 'chester-tailscale-modal');
	},

 render:function(info){
  var self=this;
  var link=E('link',{rel:'stylesheet',href:L.resource('chester-ui/tailscale.css')+'?v=20261122-2'});
  if(!info||info.ok!==true)return settings.sheet([link,settings.head('Tailscale','Your router. Connected, wherever you are.','network'),settings.card('Unable to read status','Your connection settings have not been changed.',[settings.button('Try again',function(){return self.refresh();})],'network')],'st-tailscale');
  var present=info.present===true||info.present==='true',running=info.running===true||info.running==='true',connected=info.backend==='Running';
  var ssh=info.ssh===true||info.ssh==='true',dns=info.dns===true||info.dns==='true';
  var status=connected?'Connected':!present?'Not installed':!running?'Service stopped':info.backend==='NeedsLogin'?'Sign-in needed':info.backend==='Stopped'?'Disconnected':'Ready to connect';
  var actions=[],management=[];
  if(!present){actions.push(btn('Install Tailscale','',ui.createHandlerFn(self,'run','install','Downloading and installing…')));}
  else{
   if(!connected)actions.push(btn('Connect Tailscale','',ui.createHandlerFn(self,'run','connect','Starting sign-in…')));
   else actions.push(E('a',{'class':'st-button secondary',href:'https://login.tailscale.com/admin/machines',target:'_blank',rel:'noopener noreferrer'},['Manage devices ↗']));
   actions.push(btn('Refresh status','secondary',ui.createHandlerFn(self,'refresh')));
   management.push(E('div',{'class':'ts-setting'},[E('div',{},[E('strong',{},['Tailnet DNS']),E('p',{'class':'st-muted'},['Off keeps the router using its current DNS settings.'])]),btn(dns?'Turn off':'Turn on','secondary',ui.createHandlerFn(self,'run',dns?'dns-off':'dns-on','Applying DNS preference…'))]));
   if(!connected)management.push(E('div',{'class':'ts-setting'},[E('div',{},[E('strong',{},['Connect with Tailscale SSH']),E('p',{'class':'st-muted'},['Also enables SSH access through your tailnet.'])]),btn('Connect + SSH','secondary',ui.createHandlerFn(self,'run','connect-ssh','Starting sign-in…'))]));
   management.push(E('div',{'class':'ts-setting'},[E('div',{},[E('strong',{},['App updates']),E('p',{'class':'st-muted'},['Check the configured package feed for a newer version.'])]),btn('Check for updates','secondary',ui.createHandlerFn(self,'run','update','Checking for a newer version…'))]));
   if(connected||info.state==='present')management.push(E('div',{'class':'ts-setting'},[E('div',{},[E('strong',{},['Sign out of this router']),E('p',{'class':'st-muted'},['Forgets its Tailscale identity. The app stays installed.'])]),btn('Sign out','secondary',function(){self.confirmThen('Sign out of Tailscale','This router leaves the tailnet and forgets its identity. Tailscale stays installed.','logout','Signing out…');})]));
   management.push(E('div',{'class':'ts-setting'},[E('div',{},[E('strong',{},['Remove Tailscale']),E('p',{'class':'st-muted'},['Uninstalls the app and removes its saved identity.'])]),btn('Uninstall','secondary ts-remove',function(){self.confirmThen('Uninstall Tailscale','Tailscale is removed and this router forgets its identity. It can be installed again later.','uninstall','Removing Tailscale…');})]));
  }
  var root=settings.sheet([link,
   settings.head('Tailscale','Your router. Connected, wherever you are.','network'),
   E('section',{'class':'st-card ts-hero'},[
    E('div',{'class':'ts-brand'},[mesh(),E('span',{},['TAILSCALE']),E('span',{'class':'ts-status'+(connected?' is-connected':'')},[status])]),
    E('h2',{},[connected?'Your private network is ready.':'A secure way back home.']),
    E('p',{'class':'ts-lead'},[connected?'This router is connected to your tailnet. Use its Tailscale address from your other connected devices.':'Connect your Chester router to your private Tailscale network for access when you’re away.']),
    E('div',{'class':'ts-actions'},actions),
    E('div',{'class':'ts-journey','aria-label':'Connection progress'},[['1','Install app',present],['2','Sign in',connected],['3','Stay connected',connected]].map(function(step){return E('div',{'class':'ts-step'+(step[2]?' is-complete':'')},[E('span',{},[step[2]?'✓':step[0]]),E('strong',{},[step[1]])]);}))
   ]),
   present?E('div',{'class':'st-summary'},[settings.stat('Tailscale address',info.ip||'Not assigned','network'),settings.stat('Tailnet DNS',dns?'Enabled':'Off','router'),settings.stat('Tailscale SSH',ssh?'Enabled':'Off','terminal')]):'',
   info.authurl&&!connected?settings.card('Finish connecting','Sign in to link this router to your tailnet.',[E('a',{'class':'st-button',href:info.authurl,target:'_blank',rel:'noopener noreferrer'},['Continue sign-in ↗'])],'lock'):'',
   E('div',{'class':'ts-columns'},[
    settings.card('Connection details','Status reported by this router.',[E('div',{'class':'ts-details'},[row('Connection',status),row('Version',present?info.version:'Not installed'),row('Account',info.user||'Not reported'),row('Tailscale address',info.ip||'Not assigned')])],'port'),
    settings.card('Private by design','Simple access to the devices you trust.',[E('div',{'class':'ts-feature'},[settings.icon('lock'),E('div',{},[E('strong',{},['Encrypted connections']),E('p',{'class':'st-muted'},['Tailscale connects your devices over an encrypted private network.'])])]),E('div',{'class':'ts-feature'},[settings.icon('shield'),E('div',{},[E('strong',{},['You control access']),E('p',{'class':'st-muted'},['Manage who can connect in your Tailscale account.'])])]),E('div',{'class':'ts-feature'},[settings.icon('router'),E('div',{},[E('strong',{},['Keep your local DNS']),E('p',{'class':'st-muted'},['Tailnet DNS is optional and stays off until you enable it.'])])])],'shield')
   ]),
   present?E('details',{'class':'st-card ts-options'},[E('summary',{},['App settings & maintenance']),E('div',{},management)]):E('p',{'class':'st-muted ts-install-note'},['Installation downloads the app from the configured package feed. Your router needs internet access.'])
  ],'st-tailscale');
  return root;
 },

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
