'use strict';
'require baseclass';
return baseclass.extend({
 render(node, result, status) {
  node.replaceChildren();node.className='fo-test-result';node.title='';
  if(status?.message){node.append(E('div',{'class':'fo-test-progress',style:'margin-bottom:8px;'+(status.error?'color:#df5268':'')},[status.message]));}
  if(result?.timestamp){
   node.classList.add('has-metrics');
   node.append(E('div',{'class':'fo-muted',style:'font-size:12px;margin-bottom:7px'},['Last M-Lab test']));
   [['Download',result.download,'Mbps'],['Upload',result.upload,'Mbps'],['Latency',result.latency,'ms']].forEach(m=>node.append(E('div',{'class':'fo-test-row'},[E('span',{},[m[0]]),E('strong',{},Number.isFinite(m[1])?[m[1].toFixed(1),E('small',{'class':'ios-unit'},[' '+m[2]])]:['—'])])));
   const date=new Date(result.timestamp*1000).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
   node.append(E('div',{'class':'fo-muted',style:'font-size:11px;margin-top:7px'},['M-Lab · '+date]));
   node.title='M-Lab NDT · '+(result.server||'')+' · '+new Date(result.timestamp*1000).toLocaleString();
  }else if(!status?.message)node.append(E('div',{'class':'fo-muted'},['No completed M-Lab test yet.']));
 }
});
