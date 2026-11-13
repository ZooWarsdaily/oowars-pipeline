// loads the game's simulation (no graphics) into Node from index.html
const fs=require('fs');
module.exports=function(file){const s=fs.readFileSync(file,'utf8');
  const a=s.indexOf('/* roster'),b=s.indexOf("if(typeof module!=='undefined'");
  const pre=s.slice(s.indexOf('const TAU='),s.indexOf('\n',s.indexOf('function RNG'))+1);
  const helpers=[];for(const n of ['clamp','lerp','add','sub','mulS','lerp3','norm','dot','cross','len'])
    {const m=s.match(new RegExp('\\n(?:const '+n+'=|function '+n+'\\()[^\\n]*'));if(m)helpers.push(m[0])}
  const consts=[];for(const n of ['FUSE','INTRO','WIN_T','DT']){const m=s.match(new RegExp('(?:const|let) '+n+'=[^;]*;'));if(m&&s.slice(a,b).indexOf(m[0])<0)consts.push(m[0])}
  const code=pre+helpers.join('\n')+'\n'+consts.join('\n')+'\n'+s.slice(a,b)+'\nreturn{createGame,previewGame,findSeed,KINDS,ALL_KINDS,BAL,TRAIT};';
  return new Function(code)()}
