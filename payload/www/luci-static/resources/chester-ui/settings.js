'use strict';
'require baseclass';
const icons={fan:'M12 12C3 10 3 4 8 3c4 0 4 5 4 9zm0 0c2-9 8-9 9-4 0 4-5 4-9 4zm0 0c9 2 9 8 4 9-4 0-4-5-4-9zm0 0c-2 9-8 9-9 4 0-4 5-4 9-4',temperature:'M9 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0zm3-6v10',power:'M12 2v10M5 5a9 9 0 1 0 14 0',shield:'M12 2 3 6v7c0 5 9 9 9 9s9-4 9-9V6zM8 12l3 3 5-6',clock:'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',terminal:'m4 5 6 7-6 7m9 0h7',network:'M9 2h6v6H9zM2 17h6v5H2zm14 0h6v5h-6zM12 8v4M5 17v-5h14v5',router:'M3 10h18v10H3zM7 10V3m10 7V3M7 15h.01M11 15h.01',lock:'M5 10h14v12H5zM8 10V6a4 4 0 0 1 8 0v4',check:'m5 12 4 4L20 5',port:'M4 2h16v20H4zM7 6h10v9h-3v4h-4v-4H7zm3 0v3m4-3v3',plus:'M12 4v16M4 12h16'};
let serial=0;
return baseclass.extend({
 icon(name){const el=E('span',{'class':'st-icon','aria-hidden':'true'});el.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+(icons[name]||icons.router)+'"/></svg>';return el;},
 head(title,desc,icon){return E('div',{'class':'st-head'},[E('div',{},[E('div',{'class':'st-title',role:'heading','aria-level':'2'},[title]),E('p',{},[desc])]),this.icon(icon)]);},
 card(title,desc,children,icon){return E('section',{'class':'st-card'},[E('div',{'class':'st-card-head'},[icon?this.icon(icon):'',E('div',{},[E('h3',{},[title]),desc?E('p',{'class':'st-muted'},[desc]):''])]),...children]);},
 field(label,input,help){const id=input.id||'chester-field-'+(++serial);input.id=id;return E('div',{'class':'st-field'},[E('label',{for:id},[label]),input,help?E('small',{},[help]):'']);},
 toggle(label,input,help){input.setAttribute('role','switch');const id=input.id||'chester-field-'+(++serial);input.id=id;input.classList.add('st-switch');return E('label',{'class':'st-toggle',for:id},[E('span',{},[E('strong',{},[label]),help?E('small',{},[help]):'']),input]);},
 button(label,handler,extra){return E('button',Object.assign({type:'button','class':'st-button',click:handler},extra||{}),[label]);},
 footer(button,note){return E('div',{'class':'st-footer'},[note?E('span',{'class':'st-muted'},[note]):'',button]);},
 stat(label,value,icon){return E('div',{'class':'st-stat'},[this.icon(icon),E('div',{},[E('span',{},[label]),E('strong',{},[value])])]);},
 sheet(children,extra){return E('div',{'class':'chester-settings '+(extra||'')},[E('link',{rel:'stylesheet',href:L.resource('chester-ui/settings.css')+'?v=085eddba2b5d'}),...children]);}
});
