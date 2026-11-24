'use strict';
'require baseclass';
function selection(status){if(!status||status.available!==true)return 'Unavailable';if(String(status.mode)==='0')return 'Off';if(String(status.mode)==='2')return 'Auto';if(String(status.mode)==='1')return ({20:'Minimum RPM',40:'Balanced',60:'Performance'})[Number(status.configured_percent)]||'Manual';return 'Unavailable';}
return baseclass.extend({selection});
