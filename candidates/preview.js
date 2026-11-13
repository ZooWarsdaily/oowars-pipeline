// Renders approval pictures of the candidate animals with the real game engine (preview copy, game unchanged).
// node preview.js <outDir>
const {chromium}=require('/opt/npm-tools/node_modules/playwright');const fs=require('fs'),http=require('http'),path=require('path'),os=require('os');
const ROOT=path.resolve(__dirname,'..'),OUT=path.resolve(process.argv[2]||'/tmp/cand');fs.mkdirSync(OUT,{recursive:true});
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'prev-'));fs.cpSync(path.join(ROOT,'engine/dist'),TMP,{recursive:true});fs.copyFileSync(path.join(__dirname,'models.js'),path.join(TMP,'models.js'));
fs.writeFileSync(path.join(TMP,'preview.html'),fs.readFileSync(path.join(TMP,'index.html'),'utf8').replace('</body>','<script src="models.js"></script></body>'));
const MAP={lion:'elephant',tiger:'penguin',bear:'kangaroo',wolf:'turtle',gorilla:'crocodile',fox:'frog',bull:'rabbit'};
(async()=>{const s=http.createServer((q,r)=>{const f=path.join(TMP,decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end()}fs.createReadStream(f).pipe(r)}).listen(0);await new Promise(o=>s.on('listening',o));
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const p=await b.newPage({viewport:{width:600,height:1000}});
p.on('pageerror',e=>console.log('PAGE ERROR',e.message));await p.route(/googleapis|gstatic/,r=>r.abort());
await p.goto('http://localhost:'+s.address().port+'/preview.html?rs=1');await p.evaluate(()=>document.fonts.load("40px 'Lilita One'"));
await p.evaluate(m=>useCandidates(m),MAP);
const shot=async(name,fn,arg)=>{const d=await p.evaluate(fn,arg);fs.writeFileSync(path.join(OUT,name),Buffer.from(d.split(',')[1],'base64'));console.log('saved',name)};
// team photo in two decors
for(const th of ['jungle','ice','volcano','space'])await shot('team-'+th+'.png',t=>{HP.start(4242,t);for(let i=0;i<70;i++)HP.step();HP.frame();return document.getElementById('cv').toDataURL('image/png')},th);
// one solo portrait per candidate: team photo with everybody else moved off the platform
for(const [slot,k] of Object.entries(MAP)){
  await shot('solo-'+k+'.png',sl=>{HP.start(4242,'jungle');for(let i=0;i<70;i++)HP.step();
    const A=V.G.animals,me=A.find(a=>a.k===sl),front=A.filter(a=>a.row===0).sort((a,b)=>Math.abs(a.p[0])-Math.abs(b.p[0]))[0];
    const P=[front.p[0],front.p[1]];for(const a of A)if(a!==me)a.p=[80,80];me.p=P;me.row=0;
    HP.frame();return document.getElementById('cv').toDataURL('image/png')},slot)}
await b.close();s.close()})();
