const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/overview-core.js','utf8');
const line=source.split('\n').find(line=>line.includes('const shortcuts='));
const shortcuts=new Function('L',line+'return shortcuts;')({url:(...parts)=>'/'+parts.join('/')});
assert.deepEqual(shortcuts,[
 ['APN','apn','/admin/modem/apn'],
 ['Band Lock','bandlock','/admin/modem/lockband'],
 ['AT Command','terminal','/admin/modem/at-debug'],
 ['Speedtest','speed','/admin/chester/ookla']
]);
assert(!source.includes('callHomeUpdateStatus'));
assert(source.includes("'class':'ch-shortcut ch-control'"),'Home links must reuse the Quick Controls component');
for(const icon of ['apn','bandlock','terminal'])assert(source.includes(icon+":'"));
console.log('PASS Home shortcuts: requested order, dedicated icons, correct destinations and no unused update polling.');
