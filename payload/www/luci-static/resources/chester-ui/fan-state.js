'use strict';
'require baseclass';
function selection(status){if(!status||status.available!==true)return 'Unavailable';if(String(status.mode)==='0')return 'Off';if(String(status.mode)==='2')return 'Auto';if(String(status.mode)==='1')return ({20:'Minimum RPM',40:'Balanced',60:'Performance'})[Number(status.configured_percent)]||'Manual';return 'Unavailable';}
function running(status){return status?.available===true&&Number(status.enabled)>0&&typeof status.drive_percent==='number'&&Number.isFinite(status.drive_percent)&&status.drive_percent>0;}
return baseclass.extend({selection,running});
