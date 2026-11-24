
'use strict';'require baseclass';
return baseclass.extend({
 style(){document.body.classList.add('chester-terminal-page');return E('link',{rel:'stylesheet',href:L.resource('chester-ui/terminal.css')+'?v=20261122-5'});},
 navigation(active){return E('nav',{'class':'ct-bottom-nav','aria-label':'Terminal Pages'},[['terminal','Terminal',L.url('admin','chester','terminal')],['config','Config',L.url('admin','chester','terminal','config')]].map(([key,label,href])=>E('a',{href,'class':'ct-nav-link'+(key===active?' is-active':''),'aria-current':key===active?'page':null},[label])));}
});

