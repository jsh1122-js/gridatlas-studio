import * as T from './vendor/three.module.min.js';
import {buildPower} from './power-models.js';
import {addRackDetails,buildService,serviceGeometry,ringShape,bladeShape} from './service-models.js';

import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
const cube=new T.BoxGeometry(1,1,1);
const bevel=new RoundedBoxGeometry(1,1,1,1,.034);
bevel.userData.compat=cube;
let circuit,brushed;
function finishTextures() {
  if(circuit)return;
  let seed=314159;
  const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const surface=document.createElement('canvas');surface.width=surface.height=512;
  const c=surface.getContext('2d');c.fillStyle='#b6cbc2';c.fillRect(0,0,512,512);
  for(let i=0;i<39;i++){
    const x=8+random()*480,y=random()*500,end=Math.min(505,y+12+random()*96);
    for(let j=0;j<3;j++){
      c.lineWidth=1.6;c.strokeStyle=i%4?'#6c9584':'#d2d4ac';c.beginPath();c.moveTo(x+j*3,y);c.lineTo(x+j*3,end-12);
      c.lineTo(x+12+j*3,end);c.lineTo(x+36+j*3,end);c.stroke();c.fillStyle='#d0cca1';c.fillRect(x+35+j*3,end-1.5,3,3);
    }
  }
  for(let i=0;i<500;i++){const x=random()*512,y=random()*512;c.fillStyle=i%3?'#859c8b':'#e2d5a8';c.fillRect(x,y,1+random()*2,2);}
  circuit=new T.CanvasTexture(surface);circuit.colorSpace=T.SRGBColorSpace;circuit.anisotropy=4;
  const grain=document.createElement('canvas');grain.width=grain.height=256;const g=grain.getContext('2d');
  const im=g.createImageData(256,256);
  for(let y=0;y<256;y++){const row=155+random()*45;for(let x=0;x<256;x++){const v=row+random()*25,o=4*(256*y+x);im.data[o]=im.data[o+1]=im.data[o+2]=v;im.data[o+3]=255;}}
  g.putImageData(im,0,0);brushed=new T.CanvasTexture(grain);brushed.wrapS=brushed.wrapT=T.RepeatWrapping;brushed.repeat.set(2,2);
}

const cylinder=new T.CylinderGeometry(0.5,0.5,1,24);
const sphere=new T.SphereGeometry(0.5,12,8);
const palette={
  steel:[0x90a4af,.76,.32], trim:[0xd1dce2,.68,.26], dark:[0x28333d,.63,.39], black:[0x111b25,.42,.42],
  silver:[0xadb6b9,.8,.23], panel:[0x526777,.68,.38], rubber:[0x14212a,.04,.78], green:[0x125f53,.31,.42],
  pcb:[0x134d47,.28,.48], jade:[0x6bd4ac,.38,.24], brass:[0xb38b4a,.74,.29], copper:[0xbb7650,.7,.33],
  blue:[0x229cd0,.32,.25], hot:[0xe98555,.35,.3], ivory:[0xcad6cf,.42,.4], purple:[0x9882d9,.4,.32],
  led:[0x55f5bd,.19,.21], amber:[0xffbc5b,.28,.27], chip:[0x24313b,.65,.26]
};
const vec=(x,y,z)=>new T.Vector3(x,y,z);
export function buildModel(s) {
  finishTextures();
  const root=new T.Group(), parts=new Map(),stock=new Map(),picks=[],streams=[],rotors=[],labels=[],materials=[];
  const paletteMats=Object.fromEntries(Object.entries(palette).map(([key,[color,metalness,roughness]])=>{
    const mat=new T.MeshStandardMaterial({color,metalness,roughness,emissive:key==='led'?color:0,emissiveIntensity:.72});
    if(['steel','panel','trim','copper','dark','silver'].includes(key))mat.roughnessMap=brushed;
    if(key==='pcb'||key==='green')mat.map=circuit;
    materials.push(mat);return [key,mat];
  }));
  const groups=(key,travel=[0,0,0])=>{
    if(!parts.has(key)){const g=new T.Group();g.userData.travel=vec(...travel);root.add(g);parts.set(key,g);}
    return parts.get(key);
  };
  function item(key,geometry,color,at,size,rotation,customQuaternion) {
    const token=key+'/'+geometry.uuid+'/'+color;
    if(!stock.has(token))stock.set(token,{key,geometry,color,matrices:[]});
    const q=customQuaternion||new T.Quaternion().setFromEuler(new T.Euler(...(rotation||[0,0,0])));
    stock.get(token).matrices.push(new T.Matrix4().compose(vec(...at),q,vec(...size)));
  }
  const box=(k,x,y,z,w,h,d,m,r)=>item(k,Math.max(w,h,d)>.29 && Math.min(w,h,d)>.036 ? bevel : cube,m,[x,y,z],[w,h,d],r);
  const cyl=(k,x,y,z,diam,h,m,r)=>item(k,cylinder,m,[x,y,z],[diam,h,diam],r);
  function rod(k,a,b,width,m) {
    const va=vec(...a),vb=vec(...b),dir=vb.clone().sub(va),mid=va.clone().lerp(vb,.5);
    item(k,cylinder,m,mid.toArray(),[width,dir.length(),width],null,new T.Quaternion().setFromUnitVectors(vec(0,1,0),dir.normalize()));
  }
  function pipe(k,points,r,color,flow=false) {
    const path=new T.CatmullRomCurve3(points.map(p=>vec(...p)),false,'centripetal');
    const geometry=new T.TubeGeometry(path,Math.max(20,points.length*5),r,8,false);
    const mesh=new T.Mesh(geometry,paletteMats[color]);mesh.userData.key=k;groups(k).add(mesh);picks.push(mesh);
    if(flow) {
      const mat=new T.MeshBasicMaterial({color:color==='hot'?0xffe8b3:color==='purple'?0xf2dcff:0xadfff0});materials.push(mat);
      const beads=new T.InstancedMesh(sphere,mat,4);beads.frustumCulled=false;groups(k).add(beads);streams.push({beads,path,r});
    }
  }
  function sign(k,txt,x,y,z,width,fg='#cae8e5') {
    const surface=document.createElement('canvas');surface.width=640;surface.height=80;
    const c=surface.getContext('2d');c.fillStyle='#17242b';c.fillRect(0,0,640,80);c.fillStyle=fg;c.font='bold 44px monospace';c.textAlign='center';c.fillText(txt,320,56,607);
    const texture=new T.CanvasTexture(surface);texture.colorSpace=T.SRGBColorSpace;const material=new T.MeshBasicMaterial({map:texture});materials.push(material);
    const face=new T.Mesh(new T.PlaneGeometry(width,width/8),material);face.position.set(x,y,z);face.userData.key=k;groups(k).add(face);labels.push(face);picks.push(face);
  }
  function marking(k,txt,x,y,z,width,fg='#b3c5b8'){
    const tile=document.createElement('canvas');tile.width=512;tile.height=64;const ct=tile.getContext('2d');
    ct.fillStyle=fg;ct.font='bold 37px monospace';ct.textAlign='center';ct.fillText(txt,256,44,502);
    const tex=new T.CanvasTexture(tile);tex.colorSpace=T.SRGBColorSpace;
    const m=new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});materials.push(m);
    const mesh=new T.Mesh(new T.PlaneGeometry(width,width/8),m);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);groups(k).add(mesh);
  }
  function screw(k,x,y,z,r=.032){
    cyl(k,x,y,z,r*2,.022,'silver');box(k,x,y+.012,z,r*1.45,.005,r*.28,'black',[0,.47,0]);
  }
  function fan(k,x,y,z,r){
    cyl(k,x,y,z,r*2.14,.11,'silver',[Math.PI/2,0,0]);cyl(k,x,y,z+.07,r*1.99,.10,'black',[Math.PI/2,0,0]);
    const rotor=new T.Group();rotor.position.set(x,y,z+.14);groups(k).add(rotor);rotors.push(rotor);
    for(let i=0;i<7;i++){
      const vane=new T.Mesh(bladeShape,paletteMats.steel);
      vane.scale.setScalar(r);vane.rotation.z=i*2*Math.PI/7;vane.userData.key=k;rotor.add(vane);picks.push(vane);
    }
    for(const factor of [.82,1.38,1.97])item(k,ringShape,'trim',[x,y,z+.24],[r*factor,r*factor,r*factor]);
    cyl(k,x,y,z+.18,r*.42,.10,'dark',[Math.PI/2,0,0]);
  }
  function housing(k,x,y,z,w,h,d){
    box(k,x,y-h/2,z,w,.08,d,'steel');box(k,x,y+h/2,z,w,.08,d,'steel');
    for(const sx of [-1,1])for(const sz of [-1,1])box(k,x+sx*(w/2-.035),y,z+sz*(d/2-.035),.075,h,.075,'trim');
    box(k,x,y,z-d/2+.02,w-.10,h-.10,.035,'dark');
  }
  function grip(k,x,y,z,length=.12){for(const dy of [-1,1])box(k,x,y+dy*length/2,z,.035,.04,.10,'silver');box(k,x,y,z+.05,.04,length,.035,'trim');}
  const gb=s.profile==='gb200'||s.profile==='gb300',ultra=s.profile==='gb300',nodes=gb?18:s.servers,gpus=gb?4:s.cards;
  const isRack=s.category==='rack';
  if(isRack && s.level==='rack') {
    addRackDetails(s,{groups,box,cyl,rod,pipe,sign});
    groups('frame');groups('fabric',[.53,0,-.30]);groups('power',[-.34,.23,0]);groups('cooling',[.45,0,-.25]);
    housing('frame',0,2.03,0,1.58,4.04,1.76);
    box('frame',-.78,2.03,-.10,.055,3.82,1.43,'panel');box('frame',0,.13,0,1.59,.14,1.81,'black');
    for(let y=.25;y<3.96;y+=.12)for(const x of [-.72,.72])box('frame',x,y,.906,.021,.045,.018,'black');
    const start=.45,spacing=gb?.090:Math.min(.32,2.94/nodes);
    for(let i=0;i<nodes;i++){
      const k='unit-'+(i+1),y=gb?start+i*spacing+(i>=9?.77:0):start+i*spacing;
      groups(k,[0,0,i+1===s.unit?1.25:.18]);const h=gb?.079:spacing*.84;
      box(k,0,y,.03,1.34,h,1.55,'dark');box(k,0,y,.827,1.33,h,.045,i+1===s.unit?'green':'steel');
      for(let v=0;v<8;v++){box(k,-.46+v*.111,y,.858,.065,h*.47,.023,'black');if(v%2===0)box(k,-.46+v*.111,y+.012,.873,.020,.011,.006,'led');}
      for(const x of [-.60,.60])box(k,x,y,.882,.052,h*.67,.07,'trim');
      if(!gb)for(let j=0;j<gpus;j++)box(k,-.39+j*.25,y+h*.46,0,.15,.06,1.1,'jade');
    }
    if(gb){for(let i=0;i<9;i++){const y=1.28+i*.081;box('fabric',0,y,.02,1.34,.069,1.56,'dark');box('fabric',0,y,.84,1.31,.062,.05,'black');for(let j=0;j<10;j++)box('fabric',-.5+j*.111,y,.87,.073,.036,.02,'brass');}}
    if(gb){
      for(let i=0;i<4;i++){
        const y=3.18+i*.17;box('power',0,y,.1,1.35,.14,1.5,'dark');
        for(let j=0;j<5;j++){box('power',-.51+j*.256,y,.86,.21,.105,.05,'silver');box('power',-.49+j*.256,y,.89,.085,.053,.015,'black');}
      }
      for(const [x,m] of [[-.61,'blue'],[.60,'hot']]){
        pipe('cooling',[[x,.20,-.97],[x,1.27,-.99],[x,3.72,-.97],[x*.73,3.87,-.68]],.046,m,true);
        for(let i=0;i<18;i++)rod('cooling',[x,.47+i*.14,-.94],[x*.65,.48+i*.14,-.73],.033,'brass');
      }
      for(const y of [2.91,3.01]){
        box('fabric',0,y,.10,1.34,.075,1.45,'dark');
        for(let j=0;j<14;j++)box('fabric',-.56+j*.086,y,.845,.046,.030,.035,'silver');
      }
    }else{
      box('power',-.65,1.98,-.84,.12,3.48,.12,'black');
      for(let i=0;i<18;i++)box('power',-.65,.38+i*.172,-.91,.08,.077,.035,'brass');
      // Rear fan banks on air-cooled servers. Airflow exits at the back.
      for(let i=0;i<nodes;i++)for(let j=0;j<3;j++){
        const x=-.42+j*.39,y=start+i*spacing;
        cyl('cooling',x,y,-.78,Math.min(spacing*.65,.17),.10,'black',[Math.PI/2,0,0]);
        for(let v=0;v<3;v++)box('cooling',x,y,-.843,.023,.12,.018,'steel',[0,0,v*Math.PI/3]);
      }
      box('fabric',0,3.74,0,1.35,.12,1.48,'dark');
      for(let j=0;j<14;j++)box('fabric',-.56+j*.087,3.74,.76,.058,.056,.032,'silver');
    }
    for(let i=0;i<8;i++)pipe('fabric',[[-.29+i*.08,.45,-.90],[-.37+i*.09,1.51,-1.01],[-.28+i*.08,2.70,-.92]],.016,gb?'copper':'purple');
    sign('frame',gb?(ultra?'GB300  /  NVL72':'GB200  /  NVL72'):'PCIe  /  COMPUTE',0,3.99,.916,1.24);
  } else if(isRack && s.level==='tray') {
    groups('frame',[0,-.19,0]);groups('fabric',[.30,.12,-.30]);groups('cooling',[0,.65,.10]);groups('cpu',[0,.20,0]);
    box('frame',0,.18,0,3.55,.12,2.42,'steel');box('frame',0,.27,0,3.42,.075,2.28,'pcb');
    for(const x of [-1.73,1.73])box('frame',x,.31,0,.05,.29,2.43,'silver');
    box('frame',0,.30,1.21,3.50,.28,.065,'dark');sign('frame','COMPUTE  /  '+String(s.unit).padStart(2,'0'),0,.31,1.251,1.22);
    for(let i=0;i<22;i++){const x=-1.45+(i%11)*.285,z=-.96+Math.floor(i/11)*1.84;box('frame',x,.335,z,.20,.037,.075,'chip');}
    for(let i=0;i<gpus;i++){
      const k='gpu-'+(i+1),x=gb?(i%2-.5)*1.43:-1.18+i*.76,z=gb?(Math.floor(i/2)-.5)*.92:0;
      groups(k,[0,.38+.08*(i%2),0]);
      box(k,x,.37,z,gb?.73:.16,gb?.055:.52,gb?.61:1.65,'green');
      if(gb){box(k,x,.43,z,.55,.10,.44,'steel');box(k,x,.494,z,.41,.035,.34,'copper');
        marking(k,'GPU '+String(i+1).padStart(2,'0'),x,.515,z+.025,.32,'#49362a');
        for(let h=0;h<5;h++)box(k,x-.26,.42,z-.16+h*.07,.044,.047,.042,'black');
        for(const sx of [-1,1])for(const sz of [-1,1])cyl(k,x+sx*.31,.445,z+sz*.24,.045,.07,'brass');
      }else{box(k,x+.067,.64,z,.14,.43,1.50,'black');for(let v=0;v<21;v++)box(k,x+.148,.64,-.67+v*.066,.026,.35,.021,'steel');box(k,x,.41,.98,.19,.48,.045,'silver');}
    }
    for(let u=0;u<16;u++){
      const x=-1.55+u*.203;
      box('frame',x,.332,.87,.102,.025,.052,'black');box('frame',x-.039,.343,.875,.016,.018,.047,'brass');
      box('frame',x,.332,-.835,.072,.036,.043,'rubber');
    }
    for(const x of [-1.60,1.60])for(const z of [-.97,-.35,.36,.98])screw('frame',x,.34,z);
    if(gb){
      marking('frame',ultra?'GB300   /   BLACKWELL ULTRA':'COMPUTE BOARD   REV / REF',0,.317,.99,.98);
      for(let j=0;j<2;j++){const x= j?1.32:-1.32;box('cpu',x,.37,0,.39,.12,.55,'silver');}
      for(let i=0;i<2;i++){const x=i?.72:-.72;pipe('cooling',[[x-.17,.53,-.76],[x-.23,.57,-.36],[x+.13,.56,.05],[x+.18,.54,.74]],.037,i?'hot':'blue',true);}
    }
    for(let i=0;i<4;i++){const x=-1.22+i*.78;box('fabric',x,.42,-1.06,.45,.16,.34,'steel');box('fabric',x,.42,-1.24,.27,.09,.05,'black');}
  } else if(isRack) {
    groups('substrate',[0,-.32,0]);groups('package',[0,.05,0]);groups('thermal',[0,.84,0]);
    box('substrate',0,.22,0,2.56,.13,2.01,'pcb');
    for(const sx of [-1,1])for(const sz of [-1,1])cyl('substrate',sx*1.09,.31,sz*.82,.095,.05,'brass');
    for(let i=0;i<32;i++)for(const z of [-.86,.86])box('substrate',-1.01+i*.066,.30,z,.025,.026,.13,'brass');
    box('package',0,.41,0,1.61,.18,1.40,'chip');box('package',0,.53,0,1.27,.08,1.09,'silver');
    for(const side of [-1,1])for(let i=0;i<11;i++){
      const x=side*1.01,z=-.65+i*.12;box('substrate',x,.305,z,.112,.044,.043,'black');
      box('substrate',x+.039,.327,z,.019,.008,.040,'silver');
      box('substrate',x-.039,.327,z,.019,.008,.040,'silver');
    }
    for(let i=0;i<12;i++)for(let j=0;j<9;j++)cyl('substrate',-.78+i*.142,.14,-.58+j*.145,.045,.04,'brass');
    if(ultra){
      groups('hbm',[.43,.32,0]);
      for(const x of [-.69,.69])for(const z of [-.45,-.15,.15,.45]){
        box('hbm',x,.526,z,.145,.072,.17,'green');
        box('hbm',x,.568,z,.13,.016,.15,'chip');
      }
    }
    marking('package',ultra?'BLACKWELL ULTRA':gb?'BLACKWELL  /  GPU':'ACCELERATOR  /  GPU',0,.573,0,1.03,'#424951');
    marking('substrate','MODULE  /  REFERENCE',0,.295,.76,.91);
    if(gb){box('thermal',0,.64,0,1.65,.11,1.39,'copper');
      for(const x of [-.70,.70])for(const z of [-.54,.54])screw('thermal',x,.707,z,.054);
      for(let j=0;j<12;j++)box('thermal',-.55+j*.10,.702,.36,.026,.007,.24,'dark');
      marking('thermal','COLD PLATE  /  GPU '+String(s.gpu).padStart(2,'0'),0,.703,0,1.22,'#493529');for(let j=0;j<2;j++){const x=j?.61:-.61;pipe('thermal',[[x,.72,-.43],[x,.93,-.56],[x,.95,-1.03]],.075,j?'hot':'blue');cyl('thermal',x,.74,-.44,.18,.10,'brass');}}
    else {box('thermal',0,.64,0,1.73,.11,1.43,'copper');for(let j=0;j<26;j++)box('thermal',-.75+j*.06,.82,0,.029,.32,1.35,'silver');}
  } else if(['rowdist','pdu','psu','fan','network'].includes(s.category)){
    buildService(s,{groups,box,cyl,rod,pipe,housing,sign,grip,item,paletteMats,rotors,picks});
  } else if(['transformer','switchgear','sst','hvdc'].includes(s.category)){
    buildPower(s,{groups,box,cyl,rod,pipe,housing,sign,grip,screw});
  } else if(s.category==='ups'){
    groups('frame');groups('input',[-.37,.12,0]);groups('rectifier',[0,.22,.44]);groups('battery',[-.72,0,.23]);groups('inverter',[0,-.08,.65]);groups('bypass',[.45,.20,.04]);groups('output',[.46,0,.23]);
    housing('frame',.19,1.44,0,2.03,2.86,1.32);housing('battery',-1.45,1.17,0,.94,2.32,1.20);
    for(let i=0;i<6;i++){const y=.29+i*.32;box('battery',-1.46,y,0,.77,.24,1.06,'black');box('battery',-1.46,y,.55,.72,.19,.05,'panel');box('battery',-1.7,y,.59,.064,.073,.055,'hot');box('battery',-1.21,y,.59,.064,.073,.055,'blue');}
    for(let i=0;i<7;i++){const k=i<3?'inverter':'rectifier',y=.34+i*.245;box(k,.19,y,.03,1.77,.20,1.14,'dark');box(k,.19,y,.62,1.75,.18,.06,'steel');for(let j=0;j<14;j++)box(k,-.52+j*.091,y,.657,.042,.10,.013,'black');box(k,.93,y,.661,.040,.040,.012,'led');}
    box('bypass',.49,2.25,0,1.00,.58,1.13,'panel');box('bypass',.50,2.27,.59,.64,.27,.055,'black');box('bypass',.52,2.29,.623,.44,.12,.027,'jade');
    for(const [k,x] of [['input',-.62],['output',.98]])for(let i=0;i<3;i++)rod(k,[x+i*.064,.3,-.40],[x+i*.064,2.61,-.40],.046,'copper');
    const normal=s.condition==='mains',battery=s.condition==='battery';
    const pts=normal?[[-.71,2.63,.69],[-.65,1.57,.70],[.14,1.40,.71],[.17,.61,.71],[1.0,.49,.71]]:battery?[[-1.48,1.18,.67],[-1.04,1.18,.71],[-.64,.64,.71],[.16,.61,.71],[1.0,.49,.71]]:[[-.71,2.63,.69],[-.26,2.51,.72],[.59,2.50,.72],[1.0,2.37,.71],[1.0,.49,.71]];
    pipe(normal?'rectifier':battery?'battery':'bypass',pts,.037,battery?'hot':'blue',true);sign('frame','UPS  /  AC OUTPUT',.20,2.78,.69,1.35);
  } else if(s.category==='liquid'){
    groups('frame');groups('cdu',[-.37,.15,0]);groups('supply',[0,.26,.28]);groups('return',[0,.28,-.25]);groups('plates',[.48,.15,0]);groups('primary',[-.54,.12,.10]);
    housing('frame',-1.15,1.12,0,1.19,2.20,1.04);
    for(let i=0;i<17;i++)box('cdu',-1.15,.97,-.01+i*.029,.78,1.03,.024,'silver');
    for(const y of [.41,1.64])cyl('cdu',-1.14,y,.32,.37,.36,'panel',[Math.PI/2,0,0]);
    box('plates',.88,.43,0,1.72,.12,1.10,'pcb');
    for(const x of [.39,1.38])for(const z of [-.28,.28]){box('plates',x,.54,z,.49,.13,.39,'copper');cyl('plates',x-.14,.64,z,.085,.08,'brass');}
    pipe('supply',[[-.76,.47,.41],[-.47,.46,.75],[-.17,.51,.73],[.07,.68,.29],[.40,.68,.28],[1.39,.68,.28]],.053,'blue',true);
    pipe('return',[[1.39,.71,-.28],[.40,.71,-.28],[.09,.95,-.38],[-.27,1.61,-.42],[-.74,1.62,-.25]],.053,'hot',true);
    for(const [y,col] of [[.65,'blue'],[1.48,'hot']])pipe('primary',[[-2.19,y,-.37],[-1.91,y,-.38],[-1.68,y,-.22]],.072,col,true);
    sign('frame','CDU  /  HX',-1.15,2.08,.56,.93);
  } else {
    groups('frame');groups('coil',[-.55,.12,0]);groups('fan',[0,.30,.38]);groups('cold',[0,0,.48]);groups('rack',[.38,.12,0]);groups('hot',[0,.35,-.28]);
    housing('frame',-1.10,1.13,0,1.2,2.22,1.00);
    for(let i=0;i<25;i++)box('coil',-1.10,.29+i*.067,-.13,.9,.030,.54,'silver');
    for(let i=0;i<3;i++)fan('fan',-1.10,.46+i*.59,.41,.235);
    housing('rack',1.10,.99,0,1.02,1.93,.93);
    for(let i=0;i<10;i++){box('rack',1.10,.20+i*.16,0,.87,.12,.81,'black');box('rack',1.10,.20+i*.16,.43,.82,.09,.044,'steel');}
    for(const z of [.04,.31]){pipe('cold',[[-1.09,.53,.66],[-.84,.40,1.03],[.1,.31,1.02],[.85,.42,.96],[1.10,.56,.52+z]],.032,'blue',true);
      pipe('hot',[[1.10,1.14,-.56-z],[.92,1.96,-.73],[.1,2.26,-.77],[-.79,2.17,-.74],[-1.10,1.73,-.54]],.030,'hot',true);}
    sign('frame','CRAH  /  AIR',-1.10,2.08,.55,1.00);
  }
  for(const {key,geometry,color,matrices} of stock.values()) {
    const mesh=new T.InstancedMesh(geometry,paletteMats[color],matrices.length);
    matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.key=key;groups(key).add(mesh);picks.push(mesh);
  }
  const extent=new T.Box3().setFromObject(root),center=extent.getCenter(vec(0,0,0)),size=extent.getSize(vec(0,0,0));
  let selected='',line;
  const marker=new T.LineBasicMaterial({color:0x8bf6d6,transparent:true,opacity:.58});materials.push(marker);
  function select(key){
    if(selected===key)return;selected=key;
    if(line){line.geometry.dispose();line.removeFromParent();line=null;}
    const part=parts.get(key);if(!part)return;
    const bounds=new T.Box3().setFromObject(part);if(bounds.isEmpty())return;
    const dims=bounds.getSize(vec(0,0,0)).addScalar(.044),pos=bounds.getCenter(vec(0,0,0)).sub(part.position);
    const geo=new T.BoxGeometry(dims.x,dims.y,dims.z);line=new T.LineSegments(new T.EdgesGeometry(geo),marker);geo.dispose();line.position.copy(pos);part.add(line);
  }
  const transform=new T.Matrix4(),quat=new T.Quaternion();
  function tick(phase,split,load){
    for(const part of parts.values())part.position.copy(part.userData.travel).multiplyScalar(split);
    for(const fan of rotors)fan.rotation.z=phase*4.8;
    for(const {beads,path,r} of streams){
      beads.visible=load>0;if(!beads.visible)continue;
      for(let j=0;j<4;j++)beads.setMatrixAt(j,transform.compose(path.getPointAt((phase*.24+j*.25)%1),quat,vec(r*2.8,r*2.8,r*2.8)));
      beads.instanceMatrix.needsUpdate=true;
    }
  }
  const shared=new Set([cube,bevel,cylinder,sphere,...serviceGeometry]);
  function dispose(){const geometries=new Set();root.traverse(o=>{if(o.geometry&&!shared.has(o.geometry))geometries.add(o.geometry);if(o.isInstancedMesh)o.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>{if(m.map && m.map!==circuit)m.map.dispose();m.dispose();});}
  return {root,parts,picks,select,tick,dispose,center,size,hasFlow:streams.length>0||rotors.length>0};
}
