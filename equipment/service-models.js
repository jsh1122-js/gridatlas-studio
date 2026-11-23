import * as T from './vendor/three.module.min.js';

const ringShape=new T.TorusGeometry(.5,.017,6,40);
const bladePath=new T.Shape();
bladePath.moveTo(-.05,.12);bladePath.quadraticCurveTo(-.20,.32,-.31,.61);
bladePath.quadraticCurveTo(-.16,.87,.21,.91);bladePath.quadraticCurveTo(.11,.63,.15,.33);
bladePath.quadraticCurveTo(.18,.20,.09,.12);bladePath.closePath();
const bladeShape=new T.ExtrudeGeometry(bladePath,{depth:.035,bevelEnabled:false,curveSegments:5});
export {ringShape,bladeShape};
// The fan grille is perforated geometry so its blades stay visible through the mesh.
function hexGrille(){
  const face=new T.Shape();face.absarc(0,0,.50,0,Math.PI*2,false);
  const pitch=.108;
  for(let row=-5;row<=5;row++)for(let col=-5;col<=5;col++){
    const x=(col+(row&1)*.5)*pitch,y=row*pitch*.866;
    if(Math.hypot(x,y)>.445)continue;
    const hole=new T.Path();
    for(let i=0;i<=6;i++){
      const a=-Math.PI/3*i+Math.PI/6,px=x+.047*Math.cos(a),py=y+.047*Math.sin(a);
      if(!i)hole.moveTo(px,py);else hole.lineTo(px,py);
    }
    face.holes.push(hole);
  }
  return new T.ShapeGeometry(face,28);
}
const grilleShape=hexGrille();
export const serviceGeometry=[ringShape,bladeShape,grilleShape];

export function addRackDetails(s,h){
  const {groups,box,cyl,rod,pipe,sign}=h;
  const gb=s.profile!=='pcie';
  groups('door',[.60,.05,.28]);groups('manager',[.24,0,-.30]);groups('pdu',[-.28,.12,-.15]);
  groups('psu',[0,.08,.64]);groups('fan',[.16,.15,.42]);groups('network',[.08,.19,.44]);
  // An ajar perforated wing leaves the compute trays visible. Its links form a real open mesh.
  const v=(fraction,y)=>[.77-.36*fraction,y,.91+.61*fraction];
  for(const y of [.22,3.88])rod('door',v(0,y),v(1,y),.055,'dark');
  for(const t of [0,1])rod('door',v(t,.22),v(t,3.88),.055,'panel');
  for(let i=0;i<5;i++)rod('door',v(.10+i*.20,.24),v(.10+i*.20,3.86),.011,'panel');
  for(let i=0;i<32;i++)rod('door',v(0,.29+i*.113),v(1,.29+i*.113),.012,'panel');
  rod('door',v(.93,1.84),v(.93,2.14),.048,'trim');
  for(const y of [.49,1.22,1.96,2.68,3.45]){
    box('manager',.78,y,-.65,.11,.055,.41,'panel');
    box('manager',.85,y,-.48,.055,.12,.055,'rubber');
  }
  for(let i=0;i<3;i++)pipe('manager',[[.65,3.07+i*.05,-.79],[.77,2.85,-.58+i*.035],[.80,1.88,-.62+i*.035],[.79,.62,-.62+i*.035],[.61,.45,-.75]],.015,'purple');
  box('pdu',-.78,1.97,-.57,.10,3.20,.22,'black');
  for(let i=0;i<10;i++)box('pdu',-.83,.56+i*.29,-.54,.037,.096,.12,gb?'copper':'steel');
  const y=gb?3.36:3.15;
  box('psu',-.36,y,.89,.48,.21,.13,'steel');box('psu',-.37,y,.97,.16,.105,.043,'black');
  box('psu',-.17,y,1.01,.064,.12,.044,'jade');sign('psu',gb?'PSU / SHELF':'PSU',-.39,y+.056,.995,.16);
  for(let j=0;j<2;j++){
    const x=-.28+j*.54,fy=gb?3.71:3.39;
    cyl('fan',x,fy,.94,.22,.055,'dark',[Math.PI/2,0,0]);
    for(let i=0;i<4;i++)box('fan',x,fy,.98,.015,.18,.012,'steel',[0,0,i*Math.PI/4]);
  }
  box('network',.41,gb?3.00:3.73,.85,.43,.083,.09,'panel');
  for(let j=0;j<4;j++)box('network',.264+j*.092,gb?3.00:3.73,.914,.061,.052,.04,'brass');
}
export function buildService(s,h){
  const {groups,box,cyl,rod,pipe,housing,sign,grip,item,paletteMats,rotors,picks}=h;
  const dc=s.architecture!=='交流 UPS',gb=s.profile!=='pcie';
  const ring=(key,x,y,z,d,m)=>item(key,ringShape,m,[x,y,z],[d,d,d]);
  function sockets(key,x,y,z,large=false){
    const w=large?.25:.20,h=large?.145:.115;
    box(key,x,y,z,w,h,.039,'panel');box(key,x,y,z+.022,w-.039,h-.026,.022,'black');
    for(const [dx,dy] of [[0,.024],[-.043,-.017],[.043,-.017]])
      box(key,x+dx,y+dy,z+.036,.016,.035,.01,'brass');
  }
  function rib(key,x,y,z,w,d,count){
    box(key,x,y-.11,z,w+.025,.055,d+.03,'silver');
    for(let i=0;i<count;i++)box(key,x-w/2+w*i/(count-1),y,z,.016,.24,d,'silver');
  }
  function faceBolt(key,x,y,z,r=.020){
    cyl(key,x,y,z,r*2,.017,'silver',[Math.PI/2,0,0]);
    for(const a of [.70,-.85])box(key,x,y,z+.012,r*1.4,.004,.006,'dark',[0,0,a]);
  }
  function pcbTrace(key,y,points,width=.008){
    for(let i=1;i<points.length;i++){
      const [x,z]=points[i-1],[x2,z2]=points[i],dx=x2-x,dz=z2-z;
      box(key,(x+x2)/2,y,(z+z2)/2,Math.hypot(dx,dz),.004,width,'brass',[0,-Math.atan2(dz,dx),0]);
    }
  }
  function discFan(key,x,y,z,r){
    const diameter=2*r;
    cyl(key,x,y,z,r*1.98,.020,'black',[Math.PI/2,0,0]);
    const rotor=new T.Group();rotor.position.set(x,y,z+.017);groups(key).add(rotor);rotors.push(rotor);
    for(let i=0;i<7;i++){const blade=new T.Mesh(bladeShape,paletteMats.steel);blade.scale.setScalar(r);blade.rotation.z=i*2*Math.PI/7;blade.userData.key=key;rotor.add(blade);picks.push(blade);}
    cyl(key,x,y,z+.028,r*.45,.027,'trim',[Math.PI/2,0,0]);
    item(key,grilleShape,'dark',[x,y,z+.055],[diameter,diameter,1]);
    ring(key,x,y,z+.058,diameter,'panel');
    for(const dx of [-.88,.88])for(const dy of [-.88,.88])faceBolt(key,x+dx*r,y+dy*r,z+.043,r*.085);
  }
  if(s.category==='rowdist'){
    groups('frame');groups('incoming',[-.24,.27,-.15]);groups('mainBreaker',[0,.15,.54]);groups('phaseBus',[.36,.10,-.24]);
    groups('branches',[.12,.03,.48]);groups('meter',[-.54,.14,.28]);groups('outgoing',[.28,-.10,.29]);
    housing('frame',0,1.54,0,1.70,2.98,1.12);
    // The hinged door is shown open alongside the panelboard.
    box('frame',-1.15,1.52,.82,.74,2.72,.059,'panel',[0,-.58,0]);grip('frame',-1.33,1.45,.79,.23);
    for(let j=0;j<6;j++)box('frame',-1.12,.40+j*.08,.88,.40,.023,.030,'black',[0,-.58,0]);
    box('meter',-1.12,2.18,.91,.45,.32,.060,'dark',[0,-.58,0]);box('meter',-1.13,2.20,.948,.31,.15,.026,'jade',[0,-.58,0]);
    const count=dc?2:4;
    for(let i=0;i<count;i++){
      const x=-.50+i/(count-1);
      cyl('incoming',x,3.08,-.08,.17,.17,'rubber');pipe('incoming',[[x,3.27,-.07],[x,2.90,-.06],[x*.77,2.71,.05],[x*.70,2.58,.16]],.039,'rubber');
      box('phaseBus',x,1.73,-.06,.094,1.72,.070,dc&&i?'panel':'copper');
      box('phaseBus',x,2.50,.11,.094,.064,.35,'copper');
    }
    box('mainBreaker',0,2.43,.24,1.06,.46,.40,'dark');box('mainBreaker',0,2.41,.464,.38,.21,.075,'black');
    box('mainBreaker',0,2.43,.516,.20,.105,.065,'jade');
    sign('mainBreaker',dc?'Q0    DC MAIN':'Q0    AC MAIN',0,2.60,.459,.43);
    for(const x of [-.46,.46])for(const y of [2.27,2.60])faceBolt('mainBreaker',x,y,.452);
    for(let i=0;i<count;i++){
      const x=-.50+i/(count-1);box('incoming',x,2.76,.12,.16,.09,.13,'ivory');
      sign('incoming',dc?['+','−'][i]:['L1','L2','L3','N'][i],x,2.76,.195,.12);
    }
    for(let j=0;j<3;j++){
      const y=.82+j*.42;
      box('branches',0,y,.22,1.42,.09,.19,'steel');
      for(let i=0;i<6;i++){
        const x=-.52+i*.207;
        box('branches',x,y+.045,.36,.174,.35,.24,'ivory');box('branches',x,y+.066,.494,.111,.086,.058,'black');
        box('branches',x,y+.18,.487,.081,.021,.02,dc?'amber':'blue');
        faceBolt('branches',x,y-.054,.487,.018);box('branches',x,y+.121,.491,.092,.017,.009,'steel');
        if(j===0){
          pipe('outgoing',[[x,y-.12,.33],[x,.58,.32],[x*.98,.40,.36],[x*1.18,.12,.55]],.025,'rubber');
          cyl('outgoing',x,.53,.326,.063,.068,i%2?'ivory':'amber');
          box('outgoing',x,.37,.365,.11,.13,.095,'panel');faceBolt('outgoing',x,.37,.421,.023);
        }
      }
    }
    for(const z of [.28,.45])box('outgoing',0,.39,z,1.32,.044,.026,'steel');
    sign('outgoing','X1       01      02      03      04      05      06',0,.24,.454,1.19);
    for(const [j,y] of [.82,1.24,1.66].entries())sign('branches','Q'+(1+j*6)+'        '+String(j*6+2)+'        '+String(j*6+3)+'        '+String(j*6+4)+'        '+String(j*6+5)+'        '+String(j*6+6),0,y+.256,.40,1.18);
    sign('frame',dc?'DC ROW / DISTRIBUTION':'AC ROW / DISTRIBUTION',0,2.92,.59,1.26);
    return;
  }
  if(s.category==='pdu'){
    const bar=dc||gb;
    groups('frame');groups('inlet',[-.24,.30,.12]);groups('rail',[.29,.05,-.16]);groups('outlets',[.28,0,.28]);groups('meter',[-.29,.06,.22]);groups('lead',[.28,0,.40]);
    box('frame',0,1.66,-.05,.44,3.12,.27,'dark');box('frame',-.22,1.67,.065,.032,3.07,.11,'trim');
    for(const y of [.15,3.18]){box('frame',0,y,-.12,.64,.082,.13,'steel');for(const x of [-.25,.25])cyl('frame',x,y,.001,.06,.05,'black',[Math.PI/2,0,0]);}
    if(bar){
      for(const [x,m] of [[-.083,'copper'],[.083,'brass']]){
        box('rail',x,1.64,.13,.095,2.70,.044,m);
        for(const y of [.59,1.23,1.89,2.53])box('frame',x,y,.087,.13,.05,.10,'ivory');
      }
      for(let i=0;i<7;i++){const y=.45+i*.35;box('outlets',0,y,.186,.30,.13,.09,'black');for(const x of [-.083,.083])box('outlets',x,y,.24,.05,.066,.026,'copper');}
      for(const x of [-.09,.09])pipe('inlet',[[x,3.00,.12],[x,3.24,.16],[x,3.39,.28],[x*1.9,3.44,.41]],.036,'rubber');
      box('lead',.04,1.16,.33,.29,.12,.23,'dark');
    }else{
      for(const x of [-.08,.08])box('rail',x,1.56,.055,.04,2.74,.04,'copper');
      for(let i=0;i<10;i++)sockets('outlets',0,.36+i*.23,.118,i%4===0);
      pipe('inlet',[[0,3.12,0],[0,3.37,0],[-.22,3.52,.15],[-.46,3.34,.28]],.055,'rubber');
      cyl('inlet',-.46,3.31,.29,.20,.21,'blue');box('lead',0,1.05,.23,.20,.13,.18,'black');
    }
    box('meter',0,2.80,.151,.34,.25,.08,'panel');box('meter',0,2.82,.204,.22,.092,.028,'jade');
    pipe('lead',[[.05,1.13,.37],[.15,1.11,.53],[.52,.91,.48],[.67,.73,.40]],.037,'rubber');
    sign('frame',bar?'DC BUS':'rPDU',0,3.08,.135,.33);
    return;
  }
  if(s.category==='psu'){
    groups('frame');groups('module',[0,.0,.88]);groups('connector',[-.24,.04,.59]);groups('converter',[0,.50,.19]);groups('cooling',[.31,.38,.05]);groups('backplane',[0,.12,-.52]);
    // Folded edge rails leave the withdrawn module's circuit board visible from above.
    box('frame',0,.14,0,2.87,.10,1.72,'steel');box('frame',0,.20,-.01,2.66,.040,1.53,'black');
    for(const x of [-1.402,1.402]){
      box('frame',x,.56,0,.060,.89,1.71,'steel');box('frame',x-Math.sign(x)*.08,1.00,0,.20,.057,1.71,'trim');
    }
    box('frame',0,.98,-.79,2.83,.075,.12,'steel');box('frame',0,1.00,.84,2.83,.089,.066,'panel');
    for(const x of [-1.30,1.30])faceBolt('frame',x,1.00,.881,.023);
    box('frame',.66,.60,0,1.15,.65,1.36,'panel');
    box('frame',.66,.60,.692,1.16,.65,.034,'dark');
    discFan('frame',.57,.59,.72,.23);
    for(let i=0;i<6;i++)box('frame',.66,.932,-.35+i*.14,.80,.008,.044,'dark');
    for(let i=0;i<6;i++)box('frame',1.08,.45+i*.045,.718,.19,.019,.015,'black');
    for(const x of [.18,1.16])for(const y of [.36,.84])faceBolt('frame',x,y,.716,.021);
    grip('frame',1.01,.68,.734,.23);sign('frame','PSU  02',1.02,.83,.718,.24);
    for(const x of [-1.28,-.08])box('frame',x,.33,0,.05,.08,1.44,'silver');
    box('module',-.66,.36,.39,1.12,.054,1.49,'steel');
    for(const x of [-1.19,-.13])box('module',x,.47,.38,.032,.24,1.45,'trim');
    box('module',-.66,.56,1.10,1.11,.42,.05,'dark');grip('module',-.25,.53,1.15,.22);
    box('module',-.25,.77,1.12,.15,.058,.08,'jade');
    for(const x of [-1.16,-.15])for(const y of [.40,.72])faceBolt('module',x,y,1.133,.018);
    // The U-shaped pull bail has two hinges and stands proud of the faceplate.
    for(const x of [-1.04,-.65]){cyl('module',x,.38,1.145,.065,.09,'silver',[Math.PI/2,0,0]);rod('module',[x,.38,1.16],[x,.34,1.31],.028,'silver');}
    rod('module',[-1.04,.34,1.31],[-.65,.34,1.31],.033,'trim');
    sign('module',dc?'DC IN   /   DC OUT':'AC IN   /   DC OUT',-.88,.74,1.133,.40);
    box('connector',-.89,.58,1.14,.38,.22,.095,'panel');
    if(dc){for(const x of [-.97,-.80])cyl('connector',x,.58,1.204,.074,.071,'brass',[Math.PI/2,0,0]);}
    else{
      box('connector',-.89,.58,1.187,.29,.164,.047,'black');
      for(const [dx,dy] of [[0,.038],[-.067,-.023],[.067,-.023]])box('connector',-.89+dx,.58+dy,1.231,.048,.015,.056,'brass');
    }
    box('converter',-.66,.405,.35,1.00,.035,1.30,'pcb');
    for(const x of [-.98,-.80]){cyl('converter',x,.52,.61,.14,.23,'black');cyl('converter',x,.64,.61,.12,.017,'silver');}
    box('converter',-.76,.56,.12,.32,.24,.25,'dark');for(let i=0;i<6;i++)box('converter',-.885+i*.05,.56,.25,.027,.18,.045,'copper');
    for(let i=0;i<6;i++){box('converter',-.98+i*.13,.46,-.08,.066,.05,.07,'chip');}
    for(const x of [-.98,-.80]){box('converter',x,.65,.61,.069,.005,.007,'black');box('converter',x,.65,.61,.009,.005,.060,'black');}
    for(let i=0;i<9;i++){
      const z=-.18+i*.025,x=-1.085+i*.033;
      pcbTrace('converter',.427,[[x,-.26],[x,z+.12],[x+.09,z+.21],[-.58,z+.21],[-.51,z+.28]],.007);
    }
    for(let i=0;i<6;i++){
      const z=.48+i*.042;
      pcbTrace('converter',.427,[[-.63,z],[-.48,z],[-.43,z+.045],[-.22,z+.045]],.007);
      const x=-.95+i*.13;
      box('converter',x,.45,-.211,.064,.042,.054,'chip');
      for(const side of [-1,1])for(const dx of [-.019,.019])box('converter',x+dx,.439,-.211+side*.031,.009,.011,.022,'silver');
    }
    for(let i=0;i<12;i++){
      const x=-1.01+i*.063,z=.847+(i%2)*.061;
      box('converter',x,.449,z,.040,.032,.022,i%3?'chip':'ivory');
      for(const dx of [-.022,.022])box('converter',x+dx,.444,z,.011,.015,.026,'silver');
    }
    for(const x of [-.91,-.62])for(const z of [.030,.203])cyl('converter',x,.433,z,.041,.022,'brass');
    for(let k=0;k<7;k++)box('converter',-.886+k*.039,.686,.12,.018,.016,.20,'copper');
    rib('cooling',-.37,.57,.33,.29,.49,9);discFan('cooling',-.46,.60,1.14,.18);
    box('backplane',0,.62,-.70,2.48,.57,.055,'pcb');
    for(const x of [-.66,.64]){box('backplane',x,.57,-.64,.76,.19,.08,'black');for(let i=0;i<13;i++)box('backplane',x-.30+i*.05,.58,-.58,.022,.084,.034,'brass');}
    for(let j=0;j<8;j++){const x=-1.04+j*.29;box('backplane',x,.78,-.662,.16,.036,.022,'chip');for(const dx of [-.07,.07])box('backplane',x+dx,.78,-.645,.022,.028,.011,'silver');}
    sign('frame',dc?'CONVERTER  /  DC-DC':'POWER SHELF  /  AC-DC',0,1.04,.91,1.03);
    return;
  }
  if(s.category==='fan'){
    groups('frame');groups('cartridge',[.09,.02,.22]);groups('guard',[0,.05,.81]);groups('impeller',[0,.06,.46]);groups('motor',[0,.06,-.16]);groups('connector',[-.21,.13,-.40]);groups('airflow',[.15,0,0]);
    housing('frame',0,.86,0,3.10,1.42,.92);
    for(const x of [-.91,0,.91]){
      box('cartridge',x,.86,.06,.82,.83,.16,'black');
      ring('cartridge',x,.86,.292,.81,'panel');
      for(const sx of [-.35,.35])for(const sy of [-.35,.35])cyl('cartridge',x+sx,.86+sy,.301,.054,.043,'silver',[Math.PI/2,0,0]);
      box('cartridge',x,1.25,.29,.30,.055,.08,'jade');
      const rotor=new T.Group();rotor.position.set(x,.86,.366);groups('impeller').add(rotor);rotors.push(rotor);
      for(let i=0;i<7;i++){const blade=new T.Mesh(bladeShape,paletteMats.steel);blade.scale.setScalar(.38);blade.rotation.z=i*Math.PI*2/7;blade.userData.key='impeller';rotor.add(blade);picks.push(blade);}
      cyl('motor',x,.86,.407,.23,.09,'dark',[Math.PI/2,0,0]);cyl('motor',x,.86,.462,.105,.046,'silver',[Math.PI/2,0,0]);
      for(const size of [.25,.42,.60,.77])ring('guard',x,.86,.506,size,'trim');
      for(const angle of [0,Math.PI/3,Math.PI*2/3])box('guard',x,.86,.505,.014,.81,.018,'steel',[0,0,angle]);
      box('connector',x,.83,-.31,.28,.15,.17,'pcb');for(let k=0;k<4;k++)box('connector',x-.09+k*.06,.83,-.42,.026,.075,.075,'brass');
    }
    for(const x of [-.62,.62])pipe('airflow',[[x,.47,.92],[x,.48,.55],[x,.51,.18],[x,.53,-.35],[x,.59,-.81]],.018,'blue',true);
    sign('frame','FAN WALL  /  AIRFLOW',0,1.49,.49,1.22);
    return;
  }
  const mg=s.operating==='management';
  groups('frame');groups('tor',[0,.26,-.04]);groups('optic',[-.10,.08,.48]);groups('patch',[0,0,.60]);groups('manager',[.29,.08,.19]);groups('nic',[0,-.08,.42]);
  housing('frame',0,1.07,0,2.94,2.0,1.18);
  box('tor',0,1.69,0,2.65,.29,.95,'panel');
  for(let i=0;i<16;i++){const x=-1.12+i*.149;box('tor',x,1.69,.53,.134,.109,.09,'steel');box('tor',x,1.69,.587,.096,.070,.032,'black');if(i%3===0)box('tor',x-.023,1.78,.53,.024,.02,.012,'led');}
  for(const x of [-1.26,1.26])for(const y of [1.60,1.80])faceBolt('tor',x,y,.504,.023);
  for(let i=0;i<16;i++){
    const x=-1.12+i*.149;
    for(let k=0;k<4;k++)box('tor',x-.029+k*.018,1.665,.604,.007,.031,.012,'brass');
    box('tor',x+.031,1.767,.555,.018,.014,.017,i===2?'led':'panel');
  }
  for(let group=0;group<4;group++)sign('tor',['01   02   03   04','05   06   07   08','09   10   11   12','13   14   15   16'][group],-.894+group*.596,1.586,.502,.46);
  for(let j=0;j<9;j++)box('tor',.79,1.843,-.31+j*.070,.46,.009,.030,'dark');
  box('nic',0,.43,0,2.60,.32,.86,'dark');box('nic',.69,.45,.47,.64,.22,.055,'silver');
  for(const x of [.53,.83]){box('nic',x,.46,.51,.19,.115,.048,'black');box('nic',x,.56,.515,.06,.025,.022,'jade');}
  if(!mg){for(const [x,y] of [[-.82,1.69],[.53,.46]]){
      for(let k=0;k<4;k++)box('optic',x-.042+k*.028,y+.063,.738,.013,.038,.132,'steel');
      box('optic',x,y,.65,.12,.09,.31,'silver');box('optic',x,y,.84,.104,.074,.10,'black');grip('optic',x+.03,y,.83,.07);
    }}else{
    for(const [x,y] of [[-.82,1.69],[.53,.46]]){box('optic',x,y,.65,.12,.105,.21,'ivory');box('optic',x,y+.064,.67,.067,.028,.093,'trim');}
  }
  for(const y of [.66,1.02,1.37]){box('manager',1.19,y,.52,.26,.05,.33,'panel');box('manager',1.32,y,.68,.055,.13,.055,'rubber');}
  const qty=mg?1:2;
  for(let i=0;i<qty;i++){
    const o=i*.036;pipe('patch',[[-.82+o,1.69,mg?.77:.91],[-.78+o,1.52,1.00],[.17,1.40+o,.97],[1.02+o,1.44,.82],[1.19+o,1.13,.75],[1.12+o,.70,.78],[.83,.70+o,.97],[.55+o,.47,mg?.77:.88]],mg?.031:.022,mg?'blue':'purple',true);
  }
  sign('frame',mg?'MANAGEMENT  /  ETHERNET':'NETWORK  /  OPTICAL',0,1.99,.64,1.44);
}
