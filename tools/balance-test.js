// Balance test of Hot Potato 3D: node tools/balance-test.js <games> "" mixed|one  (100 = wins 1 game in 8)
// node tune.js <games> <bal json|''> <mode: mixed|one> -> win rates x8 (100 = fair)
const {fork}=require('child_process');const N=+process.argv[2],BAL=process.argv[3]?JSON.parse(process.argv[3]):null,mode=process.argv[4]||'mixed';
if(process.send){process.on('message',({from,to,bal,mode})=>{const S=require(__dirname+'/sim-load.js')(__dirname+'/../engine/dist/index.html');
  const B=Object.assign({},S.BAL,bal||{}),orig=S.ALL_KINDS.slice(0,8),neu=S.ALL_KINDS.slice(8),win={},play={},dur=[],tags=[];
  for(let g=from;g<to;g++){let x=(g*2654435761+99+(+process.env.OFF||0))>>>0;const r=()=>((x=(x*1103515245+12345)>>>0)/4294967296);
    let ks;if(mode==='one'){ks=orig.slice().sort(()=>r()-.5).slice(0,7).concat([neu[g%7]])}else ks=S.ALL_KINDS.slice().sort(()=>r()-.5).slice(0,8);
    const res=S.previewGame((g*2246822519+7+(+process.env.OFF||0))>>>0,{kinds:ks,bal:B});for(const k of ks)play[k]=(play[k]||0)+1;if(res.winner)win[res.winner]=(win[res.winner]||0)+1;dur.push(res.dur);tags.push(res.tags)}
  process.send({win,play,dur,tags});process.exit(0)});return}
const W=2,parts=[];let done=0;const acc={win:{},play:{},dur:[],tags:[]};
for(let w=0;w<W;w++){const c=fork(__filename,[]);c.send({from:Math.floor(N*w/W),to:Math.floor(N*(w+1)/W),bal:BAL,mode});c.on('message',m=>{for(const k in m.win)acc.win[k]=(acc.win[k]||0)+m.win[k];for(const k in m.play)acc.play[k]=(acc.play[k]||0)+m.play[k];acc.dur.push(...m.dur);acc.tags.push(...m.tags);
  if(++done===W){const o={};for(const k in acc.play)o[k]=+((acc.win[k]||0)/acc.play[k]*800).toFixed(1);acc.dur.sort((a,b)=>a-b);acc.tags.sort((a,b)=>a-b);o._dur=+acc.dur[N>>1].toFixed(1);o._tags=acc.tags[N>>1];o._played=acc.play;console.log(JSON.stringify(o))}})}
