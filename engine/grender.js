// Hot Potato 3D – video maker
// usage: node grender.js <seed|auto> <out.mp4> [fps=30] [winner|any] [theme|any] [quality: fast|full]
//   seed 'auto'  = look for a lively game (at least one pass per round); otherwise replays exactly that game number
//   winner       = lion, tiger, bear, wolf, gorilla, fox, bull, panda (imposes who wins) or any
//   theme        = volcano, ice, jungle, space or any (any = picked from the game number)
//   quality fast = 3D drawn at 2/3 size then enlarged (text stays sharp); about 40 % faster, hardly visible. full = native 1080x1920
//   GAME=<folder holding index.html and music/> (default ./dist). PARTS=<n> parallel workers (default 2 = one per processor).
//   The music files are read through a small local web server, so the page works exactly as online.
// The video is rendered frame by frame by PARTS browsers at once (the game is fully determined by its number,
// so each browser replays the game silently up to its own slice, then draws it); the slices are then joined and the sound added.
const {chromium}=require('/opt/npm-tools/node_modules/playwright');const fs=require('fs'),http=require('http'),{spawn,execFileSync}=require('child_process'),path=require('path');
const DIR=path.resolve(process.env.GAME||'dist');
const serve=()=>new Promise(ok=>{const s=http.createServer((q,r)=>{const f=path.join(DIR,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(DIR)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}r.writeHead(200);fs.createReadStream(f).pipe(r)});s.listen(0,()=>ok(s))});
const ARGS=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
(async()=>{
  let seed=process.argv[2]||'auto';const outFile=process.argv[3]||'out.mp4',fps=+(process.argv[4]||30),skip=Math.round(60/fps);
  const pick=v=>v&&v!=='any'?v:null,winner=pick(process.argv[5]),theme=pick(process.argv[6]),rs=process.argv[7]==='full'?1:0.6667,PARTS=+(process.env.PARTS||2);
  const srv=await serve(),url='http://localhost:'+srv.address().port+'/index.html?rs='+rs+(process.env.STANDING?'&st='+encodeURIComponent(process.env.STANDING):''),t0=Date.now();
  const open=async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:ARGS});const p=await b.newPage({viewport:{width:600,height:1000}});
    await p.route(/googleapis|gstatic/,r=>r.abort());await p.goto(url);
    let m='loading';for(let i=0;i<150&&m==='loading';i++){m=await p.evaluate(()=>HP.musicReady());if(m==='loading')await p.waitForTimeout(200)}
    if(m!=='ok'){console.log('MUSIC NOT LOADED ('+m+'): check the music/ folder next to index.html');process.exit(1)}return{b,p}};
  // 1) choose the game and count its frames (no drawing: a few seconds)
  const first=await open();
  if(seed==='auto'){const r=await first.p.evaluate(([w,s0,v])=>HP.findSeed(w,s0,400,{void:v}),[winner,(Math.random()*2**32)>>>0,theme==='space']);
    if(!r){console.log('NO GAME FOUND');process.exit(1)}seed=r.seed;console.log('plan',JSON.stringify(r))}
  seed=+seed;
  const total=await first.p.evaluate(([s,t,k])=>{HP.start(s,t||undefined);let n=0;while(!HP.done()){for(let i=0;i<k;i++)HP.step();n++}return n},[seed,theme,skip]);
  console.log('seed',seed,'frames',total);
  // 2) render the slices in parallel
  const per=Math.ceil(total/PARTS),work=async(w,ctx)=>{const a=w*per,b=Math.min(total,a+per),tmp=outFile+'.part'+w+'.mp4';
    const {b:br,p}=ctx||await open();await p.evaluate(([s,t,n,k])=>{HP.start(s,t||undefined);for(let i=0;i<n*k;i++)HP.step()},[seed,theme,a,skip]);
    const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-preset','medium',tmp],{stdio:['pipe','inherit','inherit']});
    for(let i=a;i<b;i++){const d=await p.evaluate(k=>{for(let j=0;j<k-1;j++)HP.step();HP.frame();return document.getElementById('cv').toDataURL('image/jpeg',.93)},skip);
      if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64')))await new Promise(z=>ff.stdin.once('drain',z));if((i-a)%300===299)console.log('part',w,'frame',i-a+1,'/',b-a)}
    ff.stdin.end();await new Promise(z=>ff.on('close',z));
    let wav=null,info=null;if(w===PARTS-1){wav=await p.evaluate(()=>HP.audio());info=await p.evaluate(()=>HP.info())}
    await br.close();return{tmp,wav,info}};
  const res=await Promise.all(Array.from({length:PARTS},(_,w)=>work(w,w===0?first:null)));
  // 3) join the slices and add the sound
  const last=res[PARTS-1],list=outFile+'.list.txt',wavF=outFile+'.wav';
  fs.writeFileSync(list,res.map(r=>"file '"+path.resolve(r.tmp)+"'").join('\n'));fs.writeFileSync(wavF,Buffer.from(last.wav,'base64'));
  execFileSync('ffmpeg',['-v','error','-y','-f','concat','-safe','0','-i',list,'-i',wavF,'-c:v','copy','-c:a','aac','-b:a','256k','-shortest','-movflags','+faststart',outFile]);
  for(const r of res)fs.unlinkSync(r.tmp);fs.unlinkSync(list);fs.unlinkSync(wavF);
  srv.close();console.log('DONE',outFile,'in',Math.round((Date.now()-t0)/1000),'s',JSON.stringify(last.info));
})();
