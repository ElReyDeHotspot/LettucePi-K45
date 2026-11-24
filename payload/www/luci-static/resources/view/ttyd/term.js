
'use strict';'require view';'require uci';'require chester-ui.settings as settings';'require chester-ui.terminal-ui as terminalUi';
function consoleUrl(port,ssl,override,clientOptions){
 const host=window.location.hostname,authority=host.includes(':')&&!host.startsWith('[')?'['+host+']':host;
 const url=new URL(override||((ssl==='1'?'https':'http')+'://'+authority+':'+port+'/'),window.location.href);
 // ttyd's bundled client parses these presentation-only URL preferences.
 const options={fontSize:'14',fontFamily:'ui-monospace, SFMono-Regular, Cascadia Code, Consolas, monospace',cursorBlink:'true',cursorStyle:'bar',disableResizeOverlay:'true',theme:JSON.stringify({background:'#07131d',foreground:'#d0f4ff',cursor:'#63f5d1',cursorAccent:'#07131d',selectionBackground:'#204d63',black:'#142637',red:'#ff718c',green:'#66efbe',yellow:'#f2d18a',blue:'#62b6ff',magenta:'#b7a4ff',cyan:'#6be6ff',white:'#d0eaf6',brightBlack:'#6e899d',brightRed:'#ff9aad',brightGreen:'#8bffd4',brightYellow:'#ffe2a7',brightBlue:'#8dcaff',brightMagenta:'#d0bdff',brightCyan:'#a2f4ff',brightWhite:'#f0fbff'})};
 const configured=new Set((Array.isArray(clientOptions)?clientOptions:clientOptions?[clientOptions]:[]).map(value=>String(value).split('=')[0].trim()));
 for(const [key,value]of Object.entries(options))if(!configured.has(key)&&!url.searchParams.has(key))url.searchParams.set(key,value);return url.toString();
}
return view.extend({
 load(){return uci.load('ttyd');},
 render(){
  const port=uci.get_first('ttyd','ttyd','port')||'7681',ssl=uci.get_first('ttyd','ttyd','ssl')||'0',override=uci.get_first('ttyd','ttyd','url_override');
  if(port==='0')return settings.sheet([terminalUi.style(),settings.head('Terminal','Choose a fixed console port in Terminal Config before opening a session.','terminal'),terminalUi.navigation('terminal')],'st-terminal');
  const url=consoleUrl(port,ssl,override,uci.get_first('ttyd','ttyd','client_option')),status=E('span',{'class':'ct-status',role:'status','aria-live':'polite'},['Opening console…']);
  const frame=E('iframe',{src:url,title:'Chester K45P Terminal','class':'ct-console',load:()=>{status.textContent='Console Loaded';status.classList.add('is-ready');},error:()=>{status.textContent='Console Unavailable';status.classList.remove('is-ready');}});
  const shell=E('section',{'class':'ct-shell'}),full=E('button',{type:'button','class':'ct-button','aria-label':'Full Screen Terminal'},['Full Screen']);
  const syncFull=()=>{const active=document.fullscreenElement===shell||shell.classList.contains('is-expanded');full.textContent=active?'Exit Full Screen':'Full Screen';full.setAttribute('aria-label',active?'Exit Full Screen Terminal':'Full Screen Terminal');document.body.classList.toggle('ct-console-expanded',shell.classList.contains('is-expanded'));};
  full.addEventListener('click',async()=>{if(shell.classList.contains('is-expanded'))shell.classList.remove('is-expanded');else if(document.fullscreenElement===shell)await document.exitFullscreen();else try{await shell.requestFullscreen();}catch(e){shell.classList.add('is-expanded');}syncFull();});
  document.addEventListener('fullscreenchange',syncFull);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&shell.classList.contains('is-expanded')){shell.classList.remove('is-expanded');syncFull();}});
  shell.appendChild(E('div',{'class':'ct-toolbar'},[E('div',{'class':'ct-identity'},[E('span',{'class':'ct-glyph','aria-hidden':'true'},['>_']),E('div',{},[E('strong',{},['LOCAL CONSOLE']),E('span',{},['CHESTER K45P'])])]),E('div',{'class':'ct-toolbar-actions'},[status,E('a',{href:url,target:'_blank',rel:'noopener','class':'ct-button'},['Open in tab']),full])]));
  shell.appendChild(E('div',{'class':'ct-screen'},[frame]));
  shell.appendChild(E('div',{'class':'ct-footer'},[E('span',{},[E('kbd',{},['Ctrl']),E('span',{},[' + ']),E('kbd',{},['C']),E('span',{},[' stops a command'])]),E('span',{},[E('code',{},['exit']),E('span',{},[' ends this session'])])]));
  return settings.sheet([terminalUi.style(),settings.head('Terminal','Direct access to your router’s command line.','terminal'),shell,terminalUi.navigation('terminal')],'st-terminal');
 },handleSaveApply:null,handleSave:null,handleReset:null
});
