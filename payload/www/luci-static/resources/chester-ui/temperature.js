'use strict';
'require baseclass';
function fromC(value,unit){return unit==='F'?Number((Number(value)*9/5+32).toFixed(1)):Number(value);}
function toC(value,unit){return Math.round(unit==='F'?(Number(value)-32)*5/9:Number(value));}
function label(value,unit){return fromC(value,unit)+'°'+(unit==='F'?'F':'C');}
return baseclass.extend({fromC,toC,label});
