'use strict';
'require baseclass';
return baseclass.extend({render:function(active){return E('nav',{'class':'ct-navigation','aria-label':'Traffic engine'},[['traffic','Live Traffic'],['protection','Block Lists']].map(([id,label])=>E('a',{href:L.url('admin/firewall/'+id),'class':active===id?'is-active':'','aria-current':active===id?'page':null},[label])));}});
