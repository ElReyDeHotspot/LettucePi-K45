const fs=require('node:fs'),assert=require('node:assert/strict');
const chart=new Function('baseclass',fs.readFileSync(__dirname+'/../payload/www/luci-static/resources/chester-ui/traffic-chart.js','utf8'))({extend:o=>o});
let r=chart.render([]);assert.equal(r.ready,false);assert(!r.svg.includes('NaN'));assert(!r.svg.includes('class="ct-down"'));
r=chart.render([{time:1,down:0,up:0},{time:3,down:0,up:0}]);assert.equal(r.ready,true);assert(r.svg.includes('class="ct-down"'));assert(r.series.down[0].every(p=>p.y===216));
r=chart.render([{time:1,down:5,up:1},{time:3,down:null,up:2},{time:5,down:9,up:3},{time:7,down:4,up:0}]);assert.deepEqual(r.series.down.map(s=>s.length),[1,2]);assert.equal(r.series.up.length,1);
r=chart.render([{time:1,down:1,up:1},{time:20,down:2,up:2}],undefined,6);assert.equal(r.ready,false,'collection gaps must not become continuous traffic');
for(const values of [[0,100,0,100],[100,0,0,100],[0,1,2,3],[100,3,40,1]]){
 const data=values.map((down,i)=>({time:i*2,down,up:0}));const result=chart.render(data),points=result.series.down[0],path=chart.curve(points),parts=path.split(' C').slice(1);
 parts.forEach((piece,i)=>{const n=piece.split(' ').map(Number),low=Math.min(points[i].y,points[i+1].y)-.011,high=Math.max(points[i].y,points[i+1].y)+.011;assert(n[1]>=low&&n[1]<=high);assert(n[3]>=low&&n[3]<=high);});
}
r=chart.render([{time:1,down:4,up:1},{time:1,down:8,up:2},{time:3,down:9,up:2}]);assert.equal(r.series.down[0].length,2);assert(!/NaN|Infinity/.test(r.svg));assert.equal(chart.render(Array.from({length:200},(_,i)=>({time:i,up:i,down:i}))).series.up.flat().length,31);
console.log('PASS traffic chart: bounded cubic curves hit measured samples, preserve zeroes and gaps, avoid overshoot, and cap history at 31 points.');
