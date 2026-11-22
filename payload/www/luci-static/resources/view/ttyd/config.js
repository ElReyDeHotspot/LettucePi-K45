
'use strict';'require view';'require form';'require tools.widgets as widgets';'require chester-ui.settings as settings';'require chester-ui.terminal-ui as terminalUi';
return view.extend({render(){
 let m=new form.Map('ttyd'),s=m.section(form.TypedSection,'ttyd',_('Service instance')),o;
 s.anonymous=true;s.addremove=true;s.addbtntitle=_('Add instance');s.tab('connection',_('Connection'));s.tab('access',_('Access'));s.tab('advanced',_('Advanced'));
 o=s.taboption('connection',form.Flag,'enable',_('Enable terminal'));o.default=true;
 o=s.taboption('connection',form.Value,'port',_('Console port'),_('Port to listen on. The standard port is 7681.'));o.depends('unix_sock','0');o.datatype='port';o.placeholder=7681;
 o=s.taboption('connection',widgets.DeviceSelect,'interface',_('Listen on interface'),_('Network interface used by the console service.'));o.depends('unix_sock','0');o.nocreate=true;o.includeips=true;
 s.taboption('connection',form.Flag,'readonly',_('Read-only session'),_('Allow viewing output without typing commands.'));
 s.taboption('connection',form.Flag,'ipv6',_('IPv6 support'));
 o=s.taboption('access',form.Value,'credential',_('Basic authentication'),_('Optional username:password challenge for the console service.'));o.placeholder='username:password';o.password=true;
 s.taboption('access',form.Flag,'check_origin',_('Validate browser origin'),_('Reject WebSocket connections from a different origin.'));
 s.taboption('access',form.Flag,'ssl',_('HTTPS for console'));
 o=s.taboption('access',form.Value,'ssl_cert',_('Certificate file'));o.depends('ssl','1');o=s.taboption('access',form.Value,'ssl_key',_('Private key file'));o.depends('ssl','1');o=s.taboption('access',form.Value,'ssl_ca',_('Client certificate authority file'),_('CA used to verify client certificates.'));o.depends('ssl','1');
 s.taboption('advanced',form.Flag,'unix_sock',_('Use a UNIX socket'),_('Bind to a local socket instead of a network port.'));
 o=s.taboption('advanced',form.Value,'_unix_sock_path',_('UNIX socket path'));o.depends('unix_sock','1');o.ucioption='interface';o.retain=true;
 o=s.taboption('advanced',form.Value,'command',_('Session command'));o.placeholder='/bin/login';
 o=s.taboption('advanced',form.Value,'uid',_('Process user ID'));o.datatype='uinteger';o=s.taboption('advanced',form.Value,'gid',_('Process group ID'));o.datatype='uinteger';o=s.taboption('advanced',form.Value,'signal',_('Exit signal'),_('Signal sent when a session ends. Default: 1 (SIGHUP).'));o.datatype='uinteger';
 s.taboption('advanced',form.Flag,'url_arg',_('Allow command arguments in URLs'),_('Allow clients to send session command arguments through the URL.'));
 o=s.taboption('advanced',form.DynamicList,'client_option',_('Client options'),_('Presentation preferences sent to the terminal client.'));o.placeholder='key=value';
 o=s.taboption('advanced',form.Value,'terminal_type',_('Terminal type'));o.placeholder='xterm-256color';
 o=s.taboption('advanced',form.Value,'max_clients',_('Maximum sessions'),_('Use 0 for no limit.'));o.datatype='uinteger';o.placeholder='0';s.taboption('advanced',form.Flag,'once',_('One session only'),_('Exit the service when its first client disconnects.'));
 s.taboption('advanced',form.Value,'index',_('Custom terminal HTML path'));
 o=s.taboption('advanced',form.ListValue,'debug',_('Log detail'));o.value('1',_('Error'));o.value('3',_('Warning'));o.value('7',_('Notice'));o.value('15',_('Info'));o.default='7';
 s.taboption('advanced',form.Value,'url_override',_('Console URL override'),_('For use with a reverse proxy. The proxy must provide its own authorization; the console URL is not protected by LuCI login.'));
 return m.render().then(node=>settings.sheet([terminalUi.style(),settings.head('Terminal Config','Connection, access and session options for your console.','terminal'),settings.card('Console service','Changes take effect only after Save & Apply.',[E('div',{'class':'ct-config-form'},[node])],'terminal'),terminalUi.navigation('config')],'st-terminal-config'));
}});
