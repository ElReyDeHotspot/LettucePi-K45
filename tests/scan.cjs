const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/view/lettucepi/scan.js'),'utf8');
const helpers=new Function('E',src.slice(src.indexOf('const display='),src.indexOf('return view.extend('))+';return {matches,bands,csv};')(()=>({}));
const rows=[{rat:'LTE',provider:'T-Mobile',mcc:'310',mnc:'260',band:'B2',arfcn:'650',pci:'10',rsrp:-100,source:'Serving'},{rat:'5G',provider:'AT&T',band:'n77',arfcn:'630720',pci:'12',rsrp:-90,source:'Detected'},{rat:'5G',provider:'AT&T',band:'n77',arfcn:'636096',pci:'12',rsrp:-95,source:'Detected'}];
assert(helpers.matches(rows[0],'t-mobile','LTE','T-Mobile'));assert(!helpers.matches(rows[0],'','5G',''));assert(!helpers.matches(rows[0],'Verizon','',''));assert(helpers.matches(rows[2],'636096','',''));
const groups=helpers.bands(rows);assert.equal(groups[0].band,'n77');assert.equal(groups[0].cells,2);assert.equal(groups[0].best,-90);
const csv=helpers.csv([{...rows[0],rsrp:0,provider:'Provider, "quoted"'}]);assert(csv.includes('"Provider, ""quoted"""'));assert(csv.includes('"0"'));assert(csv.includes('MCC'));
console.log('PASS scan filters, strongest band summaries, repeated NR channels and CSV quoting/zero values.');
