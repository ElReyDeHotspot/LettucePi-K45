const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../payload/www/luci-static/resources/chester-ui/link-result.js'),'utf8');
const E=(tag,attrs,children)=>({tag,attrs,children});
const api=new Function('baseclass','E',source)({extend:x=>x},E);
function node(){return{children:[],className:'',title:'stale',replaceChildren(){this.children=[]},append(x){this.children.push(x)},classList:{add(){}}};}
const n=node();api.render(n,null,null);assert(JSON.stringify(n.children).includes('No completed M-Lab test yet.'));assert.equal(n.title,'');
api.render(n,{timestamp:1700000000,download:0,upload:20,latency:12,server:'test.example'},{message:'Testing upload…'});
let text=JSON.stringify(n.children);for(const v of ['Last M-Lab test','Download','Upload','Latency','0.0','20.0','12.0','Testing upload'])assert(text.includes(v),v);
api.render(n,{timestamp:1700000000,download:10,upload:5},{message:'Test cancelled'});text=JSON.stringify(n.children);assert(text.includes('Test cancelled')&&text.includes('Last M-Lab test')&&text.includes('—'));
console.log('PASS shared M-Lab results: zero speeds, missing latency, empty history and previous results during retries/cancellation.');
