/* Engineering scene, authored in local schematic coordinates. Logical components represent the scheme. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const zones = ['none', 'it', 'cooling', 'power'];
  const zoneNames = {it:'数据机房', cooling:'冷却机组', power:'供配电区'};
  const pickKeys=[...zones,'rack','ups','sst','hvdc','transformer','liquid','air','switchgear'];
  pickKeys[12]='800v';pickKeys[13]='rowdist';pickKeys[14]='pdu';pickKeys[15]='psu';pickKeys[23]='fan';pickKeys[24]='network';pickKeys[25]='door';pickKeys[26]='server';pickKeys[27]='bus';pickKeys[28]='cable';pickKeys[29]='sub-incoming';pickKeys[30]='sub-transformer';pickKeys[31]='sub-switchgear';pickKeys[32]='sub-feeder';pickKeys[33]='sub-transformer-2';pickKeys[34]='sub-transformer-3';pickKeys[35]='sub-transformer-4';pickKeys[20]='rack:gb200';pickKeys[21]='rack:gb300';pickKeys[22]='rack:pcie';
  // Standalone facility groups use the red pick channel. Keep 16–19 for halls and existing equipment IDs intact.
  const firstCoolingPick=36,maxCoolingUnits=14;
  for(let i=0;i<maxCoolingUnits;i++)pickKeys[firstCoolingPick+i]='cooling-unit-'+(i+1);
  const isCoolingPick=id=>id>=firstCoolingPick&&id<firstCoolingPick+maxCoolingUnits;
  const rackTypes={gb200:['GB200','#75daca'],gb300:['GB300','#e7b172'],pcie:['PCIe','#85b8e3']};
  const equipmentTitles={rowdist:'列头配电',pdu:'机柜配电',psu:'机柜 PSU',fan:'EC 风扇',network:'ToR 交换机','800v':'800 V 直流柜',rack:'IT 机柜',ups:'UPS 电源柜',sst:'SST 变换柜',hvdc:'直流电源柜',transformer:'隔离变压器',liquid:'液冷 CDU',air:'机房风冷',switchgear:'配电柜'};
  const circuitIds={all:0,power:1,liquid:2,air:3,data:4,none:5};
  const family=(id)=>id<=3?id:id===4||id===24||(id>=20&&id<=22)?1:id===9||id===10||id===23||isCoolingPick(id)?2:3;
  const pickKey=id=>id>=16&&id<20?'hall-'+(id-16):pickKeys[id]||null;
  const positive=(v,fallback)=>Number.isFinite(Number(v))&&Number(v)>0?Number(v):fallback;
  function coolingUnitCount(config={}){
    const facility=positive(config?.it,100)*positive(config?.pue,1.25);
    return 2*clamp(Math.round(3+Math.log2(facility/40)),2,maxCoolingUnits/2);
  }
  function campusPlan(metrics,it,density){
    const l=metrics.layout||{},racks=Math.max(1,Math.ceil(positive(l.racks,positive(metrics.racks,it*1000/density))));
    const perHall=Math.max(1,Math.ceil(positive(l.racksPerHall,Math.min(racks,256))));
    const halls=Math.max(1,Math.ceil(positive(l.halls,Math.ceil(racks/perHall))));
    const last=Math.min(perHall,Math.max(1,Math.ceil(positive(l.lastHallRacks,racks-(halls-1)*perHall))));
    const widthM=positive(l.hallWidthM,Math.sqrt(Math.max(20,perHall*3.4)/1.65)),lengthM=positive(l.hallLengthM,widthM*1.65);
    const displayed=Math.min(halls,4),gap=3.45,capacity=77.5-gap*(displayed-1);
    const factor=Math.min(1.16,capacity/(widthM*displayed),53/lengthM);
    const dims=Array.from({length:displayed},(_,i)=>{
      const index=displayed<halls&&i===displayed-1?halls-1:i,installed=index===halls-1?last:perHall;
      const rackLimit=Math.min(installed,Math.max(1,Math.floor(positive(l.displayRacksPerHall,56))));
      const tail=index===halls-1,ratio=Math.sqrt(installed/perHall);
      const width=tail?positive(l.lastHallWidthM,widthM*ratio):widthM,length=tail?positive(l.lastHallLengthM,lengthM*ratio):lengthM;
      const mappedW=width*factor,mappedD=length*factor;
      return {index,installed,symbols:Math.min(rackLimit,64),w:clamp(mappedW,5.5,capacity/displayed),
        d:clamp(mappedD,8.8,53),widthM:width,lengthM:length,detailScale:mappedW<5.5||mappedD<8.8,points:{}};
    });
    const span=dims.reduce((v,h)=>v+h.w,0)+(displayed-1)*gap;
    let x=-23-span/2;
    for(const h of dims){h.x=x;h.y=-4-h.d/2;h.center=[x+h.w/2,h.y+h.d/2,2];x+=h.w+gap;}
    return {halls,perHall,last,racks,dims,whiteSpaceM2:l.whiteSpaceM2,grossM2:l.grossM2};
  }
  const colors = new Map();
  const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
  function color(hex) {
    if (!colors.has(hex)) {
      const n = parseInt(hex.replace('#',''),16);
      colors.set(hex,[(n>>16 & 255)/255,(n>>8 & 255)/255,(n & 255)/255]);
    }
    return colors.get(hex);
  }
  function normalized(a) {
    const n = Math.hypot(...a) || 1;
    return a.map(v=>v/n);
  }
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const difference = (a,b) => a.map((v,i)=>v-b[i]);
  const along = (p,v,m) => p.map((n,i)=>n+v[i]*m);
  const sun = normalized([-.56,-.64,.78]);
  const coating = new Map();
  for(const [index,items] of [
    [1,'#c9d4d5 #e0e8e8 #dce2df #acbdc3 #a7b9c1 #9caeb3 #c6d3d4 #bfcbd0 #c3d3d6 #6d818a #d3dcdd #abbbc1 #bdc9c8 #b3c5c4 #8fa6ad #869ba3 #c9d3d4 #a5b9be #bbc4bf'],
    [2,'#415f6e #67808a #83afb5 #365f70 #477987 #4a6a79 #304e60 #557a86 #8c9f9b #a9ae94'],
    [3,'#566870 #45545d #97a19f #9ba7a3 #9ba6a2 #97a3a1 #97a19f #8e9b9e #6b7c80'],
    [4,'#5f9280 #587f71 #80a891 #608f7e #4d7d67 #569477 #527e72 #83a280'],
    [5,'#78d9cd #a1e0d3 #ffe3a3 #f6d697 #73c8c7 #97cdda'],
    [7,'#cda661 #a87e54 #b89068 #d6ab79 #c5af8a #c79e70 #b68e5d'],
    [8,'#283e49 #2e4959 #476d79 #3e5963 #304b57'],[9,'#4c8a87'],[10,'#948263']
  ])for(const c of items.split(' '))coating.set(c,index);
  const eased=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
  const interval=(a,b,x)=>eased((x-a)/(b-a));
  function cutState(part,hall,cut){
    const progress=clamp(cut/.96,0,1);
    return {clip:24.3-57*interval(.19,.965,progress),lift:part===2?8.8*interval(0,.42,progress)*(1-.22*interval(.66,1,progress)):0};
  }

  function meshBuilder() {
    const buffer = [], faces = [];
    let group=0,part=0,hall=0,instance=-1,pivot=null,transform=null,flow=null,rigMeta=null;
    const world=p=>transform?[transform.dx+p[0]*transform.sx,transform.dy+p[1]*transform.sy,(transform.oz??(.43-.43*transform.sz))+p[2]*transform.sz]:p;
    function face(points,hex,lit=true) {
      if(transform)points=points.map(world);
      const spin=pivot?(transform?world([...pivot,0]).slice(0,2):pivot):null;
      const normal = normalized(cross(difference(points[1],points[0]),difference(points[2],points[0])));
      const mat=flow?flow.mat:pivot?6:coating.get(hex)||0, albedo=color(hex);
      const diffuse=Math.max(0,normal[0]*sun[0]+normal[1]*sun[1]+normal[2]*sun[2]);
      const lum=.53+diffuse*.46+Math.max(0,normal[2])*.12;
      const rgb=albedo.map((v,i)=>clamp(v*lum+[.004,.012,.027][i],0,1));
      for(let k=1;k<points.length-1;k++)for(const p of [points[0],points[k],points[k+1]]){
        const distance=flow?flow.start+(p[0]-flow.p[0])*flow.axis[0]+(p[1]-flow.p[1])*flow.axis[1]+(p[2]-flow.p[2])*flow.axis[2]:0;
        buffer.push(...p,...albedo,...normal,group,part+hall*.1,mat,...(rigMeta||spin||[[4,5,10].includes(part)?instance+1:distance,0]));
      }
      faces.push({points,rgb,group,normal,part,hall,mat,instance,pivot:spin,flow:flow?.start||0,rigId:rigMeta?.[0]||0,rigRole:rigMeta?.[1]||0});
    }
    function polygon(points,z,fill,lit=false){face(points.map(([x,y])=>[x,y,z]),fill,lit);}
    function rect(x,y,w,d,z,fill){polygon([[x,y],[x+w,y],[x+w,y+d],[x,y+d]],z,fill);}
    function prism(points,z,h,sides,top=sides){
      const cap=points.map(([x,y])=>[x,y,z+h]);
      if(top!==false)face(cap,top);
      for(let i=0;i<points.length;i++) {
        const j=(i+1)%points.length,p=points[i],q=points[j];
        face([[...p,z],[...q,z],cap[j],cap[i]],sides);
      }
    }
    function box(x,y,z,w,d,h,sides,top=sides){
      prism([[x,y],[x+w,y],[x+w,y+d],[x,y+d]],z,h,sides,top);
    }
    function circle(x,y,r,n=12){
      return Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*r,y+Math.sin(i*TAU/n)*r]);
    }
    function cylinder(x,y,z,r,h,side,top=side,n=12){prism(circle(x,y,r,n),z,h,side,top);}
    function beam(a,b,radius,fill,n=5){
      const v=normalized(difference(b,a)),u=normalized(cross(v,Math.abs(v[2])<.85?[0,0,1]:[0,1,0])),w=cross(v,u);
      const ring=p=>Array.from({length:n},(_,i)=>along(along(p,u,Math.cos(i*TAU/n)*radius),w,Math.sin(i*TAU/n)*radius));
      const aa=ring(a),bb=ring(b);
      for(let i=0;i<n;i++){const j=(i+1)%n;face([aa[i],aa[j],bb[j],bb[i]],fill);}
      face(bb,fill);
    }
    const shadow=(x,y,w,d,h,z,fill)=>polygon([[x,y],[x+w,y],[x+w+h*.60,y+h*.41],[x+w+h*.60,y+d+h*.41],[x+h*.60,y+d+h*.41],[x,y+d]],z,fill);
    function trace(points,mat,radius,hex){
      let start=0;
      for(let j=1;j<points.length;j++){
        const a=points[j-1],b=points[j],v=difference(b,a),aW=world(a),vW=difference(world(b),aW);
        const length=Math.hypot(...vW);if(length<.03)continue;
        const n=Math.ceil(length/2.5),axis=vW.map(k=>k/length);
        for(let k=0;k<n;k++){
          const here=along(a,v,k/n);flow={mat,start:start+length*k/n,p:world(here),axis};
          beam(here,along(a,v,(k+1)/n),radius,hex,6);
        }
        const xy=Math.hypot(v[0],v[1]);
        if(xy>2&&length>3.2){
          const forward=normalized(v),side=[-v[1]/xy,v[0]/xy,0],arrows=Math.max(1,Math.floor(length/11));
          for(let j=0;j<arrows;j++){
            const f=(j+.67)/arrows,tip=along(a,v,f);tip[2]+=.085;
            const base=along(tip,forward,-.94);flow={mat,start:start+length*f,p:world(tip),axis};
            for(const sign of [-1,1])beam(along(base,side,sign*.42),tip,Math.max(.085,radius*.58),hex,5);
          }
        }
        start+=length;
      }
      flow=null;
    }
    return {trace,world,rigTag:(id,role)=>{rigMeta=id?[id,role]:null;},setTransform:v=>{transform=v;},buffer,faces,face,polygon,rect,box,prism,beam,cylinder,circle,shadow,group:key=>{group=Math.max(0,pickKeys.indexOf(key));},part:(type,n=0,id=-1)=>{part=type;hall=n;instance=id;},rotor:(p)=>{pivot=p;}};
  }

  function buildCampus(project={},metrics={}){
    const config=project.config||{},it=Number(config.it)||100,pue=Number(config.pue)||1.25, density=Number(config.density)||50;
    const plan=campusPlan(metrics,it,density),halls=plan.dims.length,baseHeight=8.8+Math.min(2,Math.log10(it+1)*.66);
    const m=meshBuilder(),{box,prism,rect,polygon,shadow,beam,cylinder,circle,face}=m;
    const site=[[-75,-42],[-72,-45],[71,-45],[75,-41],[75,42],[71,46],[-72,46],[-75,42]];
    const anchors={},routes=[],layout={boundary:site,roads:[],buildings:[],equipment:[],trees:[],parking:[],curbs:[],posts:[],utilities:[]};
    const rectFootprint=(id,x,y,w,d)=>({id,x0:x,y0:y,x1:x+w,y1:y+d});
    function road(id,x,y,w,d){
      layout.roads.push(rectFootprint(id,x,y,w,d));
      rect(x,y,w,d,.105,'#45545d');
    }
    const mix=Array.isArray(project.rackMix)?project.rackMix.filter(r=>rackTypes[r?.profile]&&positive(r.count,0)>0):[];
    const shownRacks=plan.dims.reduce((total,h)=>total+h.symbols,0);let drawnRacks=0;
    m.group('none');
    prism(site,-2.75,1.68,'#263b49','#526875');
    prism(site.map(([x,y])=>[x*.998,y*.998]),-1.07,.21,'#668e99','#718990');
    prism(site,-.86,.71,'#435762','#74838a');
    prism(site.map(([x,y])=>[x*.997,y*.997]),-.15,.19,'#5e858d','#799094');
    rect(-71,-42,142,83,.07,'#566870');
    // Asphalt ring and cross streets; islands and curbs are separate raised surfaces.
    box(-65,-36,.09,86,64,.30,'#9ca5a3','#9ba6a2');
    box(27,-36,.09,37,32,.30,'#97a3a1','#9ba7a3');
    box(27,1,.09,37,27,.30,'#94a0a0','#97a19f');
    road('north-ring',-70,-41,140,5);road('west-ring',-70,-36,5,68);
    road('east-ring',64,-36,6,68);road('south-ring',-70,32,140,4);
    road('central-service',21,-36,6,68);road('plant-cross',27,-4,37,5);
    road('south-gate',15.7,36,7.1,10);
    for(let i=-66;i<65;i+=6) {
      rect(i,33.92,2.8,.16,.13,'#a8b4b5');
      rect(i,-39.6,2.8,.15,.13,'#a8b4b5');
    }
    for(let y=-36;y<32;y+=6){rect(67.2,y,.14,2.6,.13,'#a8b4b5');rect(-68.1,y,.14,2.6,.13,'#a8b4b5');}
    for(let x=-66;x<60;x+=10){
      const width=x<15?Math.min(8.4,15-x):8.4;
      if(x>=15&&x<24)continue;
      box(x,42.1,.07,width,1,.25,'#6a797c','#849894');layout.curbs.push(rectFootprint('perimeter-curb',x,42.1,width,1));
    }
    const clipped=(x,y,w,d,c=.55)=>[[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+d-c],[x+w-c,y+d],[x+c,y+d],[x,y+d-c],[x,y+c]];
    // Pedestrian and perimeter details provide an architectural scale reference.
    let prng=27;
    const random=()=>((prng=(prng*1664525+1013904223)>>>0)/4294967296);
    function tree(x,y,scale=1){
      const h=(3.6+random()*1.3)*scale,r=(1.25+random()*.46)*scale;
      polygon(circle(x+.65,y+.42,r*1.16,9),.16,'#536766');
      layout.trees.push(rectFootprint('trunk',x-.18,y-.18,.36,.36));
      cylinder(x,y,.15,.18,h*.63,'#697164','#7d8271',6);
      const palettes=['#4d7d67','#569477','#527e72','#83a280'];
      function crown(cx,cy,cz,rad,tall,tint){
        const rings=[];
        for(let j=0;j<=4;j++){const t=j*Math.PI/4,rr=rad*Math.max(.04,Math.sin(t));rings.push(Array.from({length:8},(_,k)=>{const a=(k+.22*(j%2))*TAU/8;return [cx+Math.cos(a)*rr,cy+Math.sin(a)*rr,cz-Math.cos(t)*tall];}));}
        for(let j=0;j<4;j++)for(let k=0;k<8;k++){const n=(k+1)%8;face([rings[j][k],rings[j][n],rings[j+1][n],rings[j+1][k]],palettes[(tint+(j===3?1:0))%4]);}
      }
      crown(x,y,h*.69,r*.95,h*.38,Math.floor(random()*3));crown(x-r*.51,y+r*.11,h*.61,r*.62,h*.25,0);
      crown(x+r*.40,y-r*.31,h*.65,r*.65,h*.29,1);
    }
    for(let x=-63;x<=65;x+=7.1)if(x<13||x>30)tree(x,39.4,.87+random()*.2);
    for(let x=-61;x<65;x+=9)tree(x,-42.3,.74);
    for(let y=-29;y<=26;y+=9)tree(-72.25,y,.84);
    function fence(x1,y1,x2,y2,count){
      for(let i=0;i<=count;i++){
        const t=i/count,x=x1+(x2-x1)*t-.075,y=y1+(y2-y1)*t-.075;
        layout.posts.push(rectFootprint('fence-post',x,y,.15,.15));box(x,y,.12,.15,.15,1.65,'#96a5a7');
      }
      for(const h of [.82,1.7])beam([x1,y1,h],[x2,y2,h],.055,'#809298',4);
    }
    fence(-72,-42,72,-42,38);fence(72,-42,72,42,21);fence(-72,-42,-72,41,21);fence(-71,43,15,43,23);fence(24,43,70,43,12);
    for(let x=17;x<24;x+=.85)rect(x,32.3,.38,3.3,.16,'#bfc7c1');
    layout.buildings.push(rectFootprint('gatehouse',23.1,37.50,4.5,3.35));
    box(23.4,37.8,.12,3.9,2.8,2.45,'#aab9c0','#cfdbd9');box(23.4,40.59,1.15,3.9,.09,1.0,'#395661');box(23.1,37.5,2.55,4.5,3.35,.2,'#b2c5c8','#dfeded');
    for(const x of [-61,-41,-21,-1,24.6,39,59]){
      layout.posts.push(rectFootprint('light-pole',x-.16,36.44,.32,.32));
      cylinder(x,36.6,.13,.16,4.9,'#657a80','#a6b2ae',6);beam([x,36.6,4.9],[x,35,5.36],.12,'#9aacac');
      box(x-.22,34.65,5.22,.44,.9,.16,'#495c67','#c4d0c9');rect(x-.17,34.7,.34,.75,5.23,'#ffe3a3');
    }
    for(let j=0;j<8;j++){const px=-61+j*3.9;rect(px,28.1,.14,3.0,.13,'#a7b2aa');}
    for(const [px,py,tone] of [[-56,28.3,'#c8d1cd'],[-42,28.3,'#6d8994'],[34,36.4,'#c4cdc8']]){
      layout.parking.push(rectFootprint('parked-car',px-.05,py,1.77,3.5));
      box(px,py,.18,1.72,3.5,.57,'#546674',tone);box(px+.16,py+.6,.74,1.39,1.92,.46,'#4a6a79',tone);
      box(px-.05,py+.35,.17,.17,.62,.34,'#33444a');box(px-.05,py+2.54,.17,.17,.62,.34,'#33444a');
    }
    // Representative halls retain the selected scheme's rack count and room order.
    m.group('it');
    const pad=.9,w=25,y=-31,d=54;
    function roofFan(x,y,z,wide){
      box(x,y,z,wide,3.15,.74,'#9caeb3','#c6d3d4');
      for(let j=0;j<2;j++){
        const cx=x+wide*(j+.5)/2,cy=y+1.58,r=Math.min(wide/4-.14,1.14);
        cylinder(cx,cy,z+.73,r+.05,.15,'#7b9196','#738790',12);
        polygon(circle(cx,cy,r*.78,12),z+.902,'#536c77');
        m.rotor([cx,cy]);
        for(let k=0;k<3;k++){const a=k*TAU/3;
          polygon([[cx,cy],[cx+Math.cos(a)*r*.65,cy+Math.sin(a)*r*.65],[cx+Math.cos(a+.62)*r*.62,cy+Math.sin(a+.62)*r*.62]],z+.925,'#8b9da2');
        }
        m.rotor(null);
        cylinder(cx,cy,z+.92,r*.21,.08,'#acbdc3','#c3d0d2',8);
      }
    }
    for(let b=0;b<halls;b++){
      const x=0,floor=.86,height=baseHeight+[1.65,-.25,.8,0][b],hall=plan.dims[b];
      hall.sz=clamp(Math.min(hall.w/15,hall.d/23),.30,1);
      m.setTransform({sx:hall.w/w,sy:hall.d/d,sz:hall.sz,dx:hall.x,dy:hall.y-y*hall.d/d});m.group('it');
      const mark=(key,pos)=>{hall.points[key]=m.world(pos);};
      m.part(0,b);
      shadow(x-.4,y-.4,w+.8,d+.8,height,.42,'#687a7f');
      const envelopeStart=m.faces.length;
      prism(clipped(x-pad,y-pad,w+2*pad,d+2*pad),.43,.41,'#7c8b90','#b2bdba');
      prism(clipped(x,y,w,d),floor,.9,'#485f70','#83989e');
      {
        m.part(1,b);
        box(x,y,floor+.9,w,d,height-.88,'#a7b9c1',false);
        for(const wallX of [x-.04,x+w-.08]){
          box(wallX,y+.4,floor+1.15,.13,d-.8,.37,'#536b77');
          box(wallX,y+.4,floor+5.70,.13,d-.8,.45,'#486574');
          for(let j=0;j<14;j++){
            const yy=y+1+j*3.72;
            box(wallX-.07,yy,floor+1.6,.21,.14,height-1.73,'#aebdc1');
            if(j%2===0)box(wallX-.08,yy+.3,floor+2.5,.23,2.75,1.65,'#67808a');
          }
        }
        for(const yy of [y-.09,y+d-.01]){
          box(x+.55,yy,floor+1.55,w-1.1,.13,3.65,'#415f6e','#668795');
          for(let j=x+.72;j<x+w-.25;j+=2.35)box(j,yy-.04,floor+1.55,.14,.23,3.8,'#bdc9cc');
          box(x+.50,yy-.015,floor+3.95,w-1,.21,.12,'#93a7b0');
        }
        // Tinted curtain wall and a projecting metal canopy at the main entrance.
        const front=y+d+.16;
        for(let k=0;k<7;k++){
          const wx=x+.75+k*(w-1.35)/7,ww=(w-1.35)/7-.20;
          box(wx,front,floor+1.42,ww,.18,height-3.55,['#365f70','#477987','#4a6a79','#557a86'][k%4]);
          if(k===1||k===5)box(wx+.11,front+.19,floor+5.16,ww-.22,.06,.22,'#f6d697');
        }
        for(const hh of [3.65,6.15])box(x+.4,front+.15,floor+hh,w-.8,.29,.11,'#aab6b7');
        box(x+w*.19,front+.12,floor+4.10,w*.58,1.72,.37,'#6d818a','#d3dcdd');
        for(const xx of [x+w*.22,x+w*.73])cylinder(xx,front+1.4,floor+.05,.11,4.03,'#a5b8b8','#bbc6c4',7);
        // Double-height west facade with reflective window bands and alternating sunshades.
        box(x-.11,y+.72,floor+2.02,.18,d-1.44,3.45,'#365f70');
        for(let j=0;j<22;j++){
          const yy=y+1+j*2.41;
          box(x-.20,yy,floor+1.90,.41,.14,4.18,'#bdc9c8');
          if(j%5===1)box(x-.22,yy+.2,floor+3.15,.05,1.88,.27,'#ffe3a3');
        }
        const roof=floor+height;
        m.part(2,b);
        box(x-.36,y-.32,roof-.38,w+.72,d+.64,.60,'#c3d3d6','#e0e8e8');
        box(x+.48,y+.48,roof+.22,w-.96,d-.96,.09,'#b8c7ca','#c9d4d5');
        for(let j=1;j<d-1;j+=1.65)rect(x+.63,y+j,w-1.26,.065,roof+.335,'#b0bfc3');
        for(const xx of [x+.24,x+w-.55])box(xx,y+.20,roof+.24,.30,d-.4,.21,'#899fa6','#dfe9e7');
        for(const yy of [y+.25,y+d-.55])box(x+.30,yy,roof+.24,w-.6,.3,.21,'#899fa6','#dfe9e7');
        const equipmentW=Math.min(6.0,w*.32);
        for(let j=0;j<5;j++){
          const yy=y+5.0+j*9.2;
          roofFan(x+w*.22-equipmentW/2,yy,roof+.35,equipmentW);
          if((j+b)%3===0){
            const xx=x+w*.70-equipmentW/2;
            box(xx,yy-.4,roof+.35,equipmentW+1.05,5.4,1.7,'#869ba3','#bfcbd0');
            for(let slit=0;slit<7;slit++)rect(xx+.3,yy+slit*.62,equipmentW+.4,.22,roof+2.07,'#687e88');
          }else roofFan(x+w*.73-equipmentW/2,yy,roof+.35,equipmentW);
        }
        // Raised spine, skylight panes and regular joints.
        box(x+w*.45,y+2.0,roof+.34,w*.10,d-4,1.08,'#889ba4','#acbdc3');
        hall.roofAnchor=m.world([x+w*.50,y+d*.50,roof+1.43]);
        for(let j=0;j<9;j++)rect(x+w*.456,y+3.0+j*5.3,w*.084,3.7,roof+1.43,'#83afb5');
        for(let j=0;j<3;j++){
          const panelY=y+3+j*16;
          box(x+w*.59,panelY,roof+.34,.52,12.4,.38,'#76949f','#becbcd');
          for(let k=0;k<4;k++)box(x+w*.59-.1,panelY+1+k*3.0,roof+.32,.73,.15,.51,'#8298a0');
        }
        m.part(1,b);
        // Turquoise horizontal shading fins also identify the computing volumes.
        box(x+.38,y+d+.05,floor+5.12,w-.76,.47,.43,'#41a7a8','#87d0c8');
        box(x-.27,y+1,floor+5.12,.34,d-2,.42,'#57999b','#8dbdb7');
        for(let j=0;j<7;j++){
          const xx=x+1.15+j*(w-2.7)/7;
          box(xx,y+d+.15,floor+1.0,.19,.38,4.07,'#c6d0d0','#d8e2df');
        }
      }
      const envelope={id:'hall-'+b,x0:Infinity,y0:Infinity,x1:-Infinity,y1:-Infinity};
      for(let j=envelopeStart;j<m.faces.length;j++)for(const [px,py] of m.faces[j].points){
        envelope.x0=Math.min(envelope.x0,px);envelope.y0=Math.min(envelope.y0,py);
        envelope.x1=Math.max(envelope.x1,px);envelope.y1=Math.max(envelope.y1,py);
      }
      layout.buildings.push(envelope);
      {
        m.part(3,b);
        rect(x+.26,y+.26,w-.52,d-.52,floor+.94,'#607a89');
        box(x,y,floor+.9,w,.45,2.7,'#98aeb8','#d5e1e2');box(x,y+d-.35,floor+.9,w,.35,.72,'#97acb8','#cfdfdf');
        for(const xx of [x,x+w-.28])box(xx,y+.35,floor+.9,.28,d-.72,1.5,'#93aab7','#cedbdd');
        const lanes=clamp(Math.ceil(Math.sqrt(hall.symbols*.52)),1,6),rackCount=Math.ceil(hall.symbols/lanes);
        const rowD=(d-20)/rackCount,laneW=(w-3.4)/lanes,rackW=Math.min(laneW*.60,2.8);
        const demoLane=Math.floor((lanes-1)/2),demoRow=Math.min(rackCount-1,Math.floor(rackCount*.55));
        let demo=null;hall.rackPoints=[];hall.rowSources=[];
        for(let q=0;q<lanes;q++){
          const xx=x+1.7+q*laneW;
          m.part(3,b);m.group('it');
          if(q%2===0)rect(xx-.60,y+1.1,.22,d-16,floor+.97,'#4ca4a8');
          for(let j=0;j<rackCount;j++){
            if(q*rackCount+j>=hall.symbols)break;
            const yy=y+2.5+j*rowD,rackD=Math.min(rowD-.26,3.55);
            const sample=mix.length?globalThis.GridRackMix?.profileAt?.(mix,drawnRacks,shownRacks):null;
            const profile=typeof sample==='string'?sample:sample?.profile,style=rackTypes[profile];
            drawnRacks++;
            const rackKey=style?'rack:'+profile:'rack',at=[xx+rackW*.5,yy+rackD*.52,floor+4.14],id=q*rackCount+j;
            const min=m.world([xx,yy,floor+.97]),max=m.world([xx+rackW,yy+rackD,floor+4.13]);
            hall.rackPoints[id]={pos:m.world(at),key:rackKey,rowIndex:q,columnIndex:j,min,max};
            if(j===0&&q!==demoLane){
              // Each row has its own illustrative distribution panel at the service end.
              const dx=xx+.03,dy=-30.35,ww=Math.min(rackW+.28,laneW*.78),dd=1.54,bz=floor+.98;
              m.part(10,b,q);m.group('rowdist');
              box(dx,dy,bz,ww,dd,3.18,'#627c85','#acb9bc');box(dx+.12,dy+dd,bz+.28,ww-.24,.13,2.6,'#47616c','#82989b');
              for(let z=0;z<5;z++)box(dx+.22,dy+dd+.13,bz+.46+z*.40,ww-.44,.08,.14,'#b39b77');
              hall.rowSources[q]={pos:m.world([dx+ww*.5,dy+dd*.55,bz+3.2])};
            }
            if(q===demoLane&&j===demoRow){mark('rack',at);hall.rackType=style?profile:null;hall.demoRackIndex=id;demo={xx,yy,depth:rackD,id};}
            m.part(4,b,id);m.group(rackKey);
            box(xx,yy,floor+.96,rackW,rackD,3.15,'#2e4959','#6c858e');
            box(xx+.15,yy-.02,floor+2.98,rackW-.3,.09,.12,'#63c4c5');
            rect(xx+.25,yy+.23,rackW-.5,rackD-.38,floor+4.12,'#304b57');
            rect(xx+.12,yy+.10,rackW-.24,style?Math.min(.46,rackD*.24):.16,floor+4.14,style?style[1]:'#78d9cd');
            for(let v=0;v<3;v++)rect(xx+.36,yy+.58+v*.50,rackW-.72,.13,floor+4.14,'#71878b');
          }
        }
        m.part(3,b);
        m.group('it');
        m.part(12,b);
        // Service ladders, rack branches and overhead ducts follow the selected cooling system.
        const liquid=config.cooling==='冷板液冷',hybrid=config.cooling!=='风冷'&&!liquid;
        for(let q=0;q<lanes;q++){
          const xx=x+1.7+(q+1)*laneW-.78,hasWater=liquid||(hybrid&&q%2===0);
          if(hasWater){
            for(const [k,tone] of ['#4d989e','#ab9271'].entries()){
              const px=xx+k*.25;
              beam([px,y+2.1,floor+4.85],[px,y+d-16.0,floor+4.85],.13,tone,6);
              for(let j=0;j<4;j++){
                const yy=y+4.9+j*(d-25)/3;
                beam([px,yy,floor+4.85],[px-.31,yy,floor+4.25],.08,tone,5);
              }
            }
          }else{
            box(xx-.33,y+2.7,floor+4.85,.73,d-19.4,.50,'#869ba3','#bbc4bf');
            for(let yy=y+4;yy<y+d-17;yy+=5.1)box(xx-.45,yy,floor+4.60,.96,.95,.25,'#71878c','#b7c6c7');
          }
        }
        m.part(3,b);
        // The service gallery shares the hall footprint with the IT rows.
        // Cutaway devices are schematic footprints; equipment counts come from the design.
        const z=floor+.99;
        box(.42,7.0,z,w-.84,15.5,.16,'#5b7178','#819494');
        for(const px of [7.85,16.5])box(px,7.2,z+.16,.23,15.05,1.06,'#70828a','#b2c0bf');
        box(.5,14.5,z+.17,w-1,.18,.8,'#7f9197','#cad3ce');
        const conversion=config.architecture==='SST 800V 直流'?'sst':config.architecture==='交流 UPS'||!config.architecture?'ups':config.architecture==='800V 直流'?'800v':'hvdc';
        const cells=[
          ['transformer',1.1,8.0,5.6,4.8],['switchgear',8.65,8.05,6.3,4.6],[conversion,17.15,7.9,6.45,5.0],
          ['air',1.1,15.45,7.1,5.45]
        ];
        if(config.cooling!=='风冷')cells.push(['liquid',10.05,15.55,6.6,5.15]);
        for(const [key,px,py,bw,bd] of cells){
          m.group(key);
          if(key===(config.cooling==='风冷'?'air':'liquid')){
            hall.facilityWater=[-.30,.30].map(delta=>m.world([px+bw*.50+delta,py+bd+.12,z+2.05]));
            for(const delta of [-.30,.30])beam([px+bw*.50+delta,py+bd,z+2.05],[px+bw*.50+delta,py+bd+.12,z+2.05],.13,'#7faaa8',6);
          }
          box(px-.16,py-.16,z+.16,bw+.32,bd+.32,.36,'#607178','#a1aeae');
          if(key==='transformer'){
            box(px+.49,py+.32,z+.53,bw-.98,bd-.64,2.15,'#748c92','#aab3ae');
            for(let j=0;j<7;j++)box(px,py+.32+j*.57,z+.70,bw,.18,1.85,'#8c9f9c','#bcc7bc');
            for(let j=0;j<3;j++){const xx=px+bw*(j+.5)/3;cylinder(xx,py+bd*.50,z+2.67,.22,1.26,'#8f8273','#b9af91',9);
              for(let k=0;k<3;k++)cylinder(xx,py+bd*.50,z+2.9+k*.3,.36,.13,'#a09279','#c4b89c',9);
              cylinder(xx,py+1.30,z+2.67,.21,.58,'#809497','#bcbbb0',8);cylinder(xx,py+1.30,z+3.03,.28,.10,'#98a8a8','#bec3b9',8);}
          }else if(key==='liquid'){
            box(px,py,z+.53,bw,bd,2.9,'#558a93','#98b8b2');
            for(let j=0;j<2;j++){const xx=px+1.35+j*3.03;
              cylinder(xx,py+bd*.5,z+3.43,.89,.33,'#648c92','#b9c9bc',14);
              beam([xx,py+bd+.12,z+2.05],[xx,py+bd+.55,z+2.05],.27,j?'#d1a376':'#6dc9bc',8);}
            box(px+.55,py+bd,z+1.63,1.4,.13,.68,'#234b52');rect(px+.25,py+.18,bw-.5,.21,z+3.45,'#8fd0c2');
          }else if(key==='air'){
            box(px,py,z+.53,bw,bd,2.85,'#708fa1','#adbcc2');
            m.group('fan');
            for(let j=0;j<2;j++){const xx=px+bw*(j+.5)/2,yy=py+bd*.5,rr=1.30;
              if(j===0)mark('fan',[xx,yy,z+3.71]);
              cylinder(xx,yy,z+3.38,rr,.24,'#7f949d','#536977',16);m.rotor([xx,yy]);
              for(let k=0;k<4;k++){const a=k*TAU/4;polygon([[xx,yy],[xx+Math.cos(a)*rr*.9,yy+Math.sin(a)*rr*.9],[xx+Math.cos(a+.8)*rr*.70,yy+Math.sin(a+.8)*rr*.70]],z+3.64,'#becac6');}m.rotor(null);
              cylinder(xx,yy,z+3.66,.28,.13,'#506a74','#c5d1cc',10);
              for(let k=0;k<3;k++){const ang=k*Math.PI/3,dx=Math.cos(ang)*rr,dy=Math.sin(ang)*rr;
                beam([xx-dx,yy-dy,z+3.75],[xx+dx,yy+dy,z+3.75],.045,'#738a94',4);}
            }
            m.group('air');
            for(let j=0;j<7;j++)box(px+.25+j*.91,py+bd-.02,z+.93,.47,.13,1.72,'#49636e');
          }else{
            const panels=key==='switchgear'?5:key==='sst'?2:3;
            const side=key==='ups'?'#606e83':key==='sst'?'#5f898a':key==='hvdc'||key==='800v'?'#758997':'#7d8585';
            for(let j=0;j<panels;j++){const xx=px+j*bw/panels,ww=bw/panels-.11;
              box(xx,py,z+.53,ww,bd,3.20,side,'#aab8ba');
              box(xx+.12,py+bd-.02,z+1.70,Math.max(.23,ww-.23),.10,.63,'#3d525a');
              box(xx+.18,py+bd+.07,z+2.09,.19,.09,.13,key==='switchgear'?'#edc88a':'#73c8c7');
              for(let k=0;k<4;k++)rect(xx+.17,py+.55+k*.61,Math.max(.15,ww-.32),.18,z+3.75,'#637985');
            }
          }
          mark(key,key==='air'?[px+bw*.51,py+.30,z+3.39]:[px+bw*.50,py+bd*.52,z+(key==='transformer'?3.55:3.85)]);
        }
        m.group('it');
        // The representative branch is continuous from its source to a particular enclosure.
        // All routes and redundant feed labels are local schematic assumptions.
        if(demo){
          const rx=demo.xx,ry=demo.yy,rd=demo.depth,rear=ry+rd,rTop=floor+4.13;
          const ac=conversion==='ups',pA=rx+.17,pB=rx+rackW-.17,pY=rear+.16,netY=ry+.38;
          const rowX=clamp(rx-.35,1.0,20.5),rowY=3.4,rowW=3.35,rowD=2.7,rowTop=z+4.30;
          const tHigh=z+5.25,powerX=rx+rackW+.42,dataX=rx-.61;
          // Freestanding row distribution equipment: warm breaker covers for AC, guarded +/- bars for DC.
          m.part(10,b,demoLane);m.group('rowdist');box(rowX-.16,rowY-.14,z+.04,rowW+.32,rowD+.28,.26,'#617781','#95a6a5');
          box(rowX,rowY,z+.30,rowW,rowD,4.0,ac?'#63778a':'#557b83','#abbcbd');
          for(let k=0;k<2;k++){
            const px=rowX+k*rowW/2+.10,ww=rowW/2-.19;
            box(px,rowY+rowD-.01,z+.57,ww,.15,3.41,'#405768','#78929a');
            for(let j=0;j<5;j++)box(px+.16,rowY+rowD+.13,z+.95+j*.42,ww-.34,.11,.20,ac?'#d9b174':k?'#82abc5':'#bc8f78');
            box(px+.20,rowY+rowD+.13,z+3.30,ww-.4,.1,.31,'#89c1be');
          }
          for(let j=0;j<6;j++)rect(rowX+.2,rowY+.23+j*.34,rowW-.4,.1,rowTop+.02,'#708a92');
          mark('rowdist',[rowX+rowW*.55,rowY+rowD*.55,rowTop+.05]);hall.rowSources[demoLane]={pos:hall.points.rowdist};m.part(5,b,demo.id);
          // A/B outlet strips or DC branch bars are mounted just outside the rack rear side.
          m.group('pdu');
          for(const [px,tone] of [[pA,'#e2aa6e'],[pB,'#85b9ce']]){
            box(px-.12,pY-.05,z+.25,.24,.26,3.05,'#374d59',tone);
            for(let j=0;j<7;j++)box(px-.09,pY+.20,z+.47+j*.34,.18,.08,.15,tone);
            cylinder(px,pY+.08,rTop+.04,.15,.19,'#516873',tone,8);
          }
          // Rack power shelf: two cassettes with a rear handle, status strip and intake perforations.
          const serviceY=rear+.35,serviceW=Math.max(.95,rackW-.5),sx=rx+(rackW-serviceW)/2;
          m.group('psu');box(sx-.08,serviceY-.22,rTop-.96,serviceW+.16,.85,1.17,'#435b66','#a9b7b7');
          for(let j=0;j<2;j++){
            const xx=sx+j*serviceW/2,ww=serviceW/2-.05;
            box(xx,serviceY+.49,rTop-.80,ww,.25,.79,'#81969b','#bec8c7');
            for(let k=0;k<4;k++)box(xx+.08+k*Math.max(.09,(ww-.2)/4),serviceY+.75,rTop-.59,.055,.05,.30,'#3b545d');
            box(xx+.04,serviceY+.78,rTop-.22,ww-.08,.08,.065,'#8fd8c9');
            rect(xx+.07,serviceY-.10,Math.max(.10,ww-.14),.57,rTop+.235,'#889a9d');
            for(let k=0;k<4;k++)rect(xx+.11,serviceY-.03+k*.105,Math.max(.10,ww-.22),.045,rTop+.241,'#445d66');
            box(xx+.11,serviceY+.32,rTop+.245,Math.max(.15,ww-.22),.16,.12,j?'#86bcb6':'#bc956a');
            beam([xx+.08,serviceY+.78,rTop-.53],[xx+ww-.08,serviceY+.78,rTop-.53],.045,'#c1ccc7',5);
          }
          mark('psu',[sx+serviceW*.52,serviceY+.35,rTop+.23]);
          // Demarcation/power tap box is a separate, identifiable pick target on the overhead branch.
          const tapY=rear+1.36;
          m.group('pdu');box(powerX-.30,tapY-.43,tHigh-.49,.65,.87,.50,'#767c77','#d1ac78');
          box(powerX+.22,tapY-.28,tHigh-.49,.17,.55,.35,'#9c967f','#d6b77f');mark('pdu',[powerX,tapY,tHigh+.03]);
          // Dedicated data equipment: top-of-rack switch, copper access and an overhead fiber uplink.
          m.group('network');box(rx-.07,ry-.32,rTop+.04,rackW+.14,1.05,.57,'#526878','#94abb5');
          for(let k=0;k<6;k++){
            const xx=rx+.06+k*(rackW-.12)/6;
            box(xx,ry-.36,rTop+.15,Math.max(.1,(rackW-.35)/6),.10,.19,'#273d49');
            rect(xx,ry-.22,(rackW-.35)/6,.11,rTop+.625,k<3?'#c4a1d7':'#92bcb4');
          }
          mark('network',[rx+rackW*.49,ry+.13,rTop+.64]);
          // Short NIC patch lead and panel at the rack rear; the separate optical uplink terminates at the row patch field.
          const opticX=clamp(rowX-3.30,.30,20),opticY=3.4;
          box(opticX,opticY,z+.27,2.20,2.2,3.94,'#58697d','#9aa8b7');
          for(let q=0;q<5;q++){box(opticX+.14,opticY+2.2,z+.88+q*.57,1.92,.14,.34,'#425267');for(let k=0;k<5;k++)box(opticX+.22+k*.35,opticY+2.32,z+.98+q*.57,.20,.06,.12,'#c9aad8');}
          function ladder(x1,y1,x2,y2,alt,half,tone){
            const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy);if(len<.4)return;
            const nx=-dy/len,ny=dx/len,rail=(s,zz,r,col)=>beam([x1+nx*s,y1+ny*s,zz],[x2+nx*s,y2+ny*s,zz],r,col,4);
            rail(-half,alt,.083,tone);rail(half,alt,.083,tone);
            const steps=Math.max(1,Math.floor(len/1.15));
            for(let j=0;j<=steps;j++){const t=j/steps,xx=x1+t*dx,yy=y1+t*dy;
              beam([xx-nx*half,yy-ny*half,alt],[xx+nx*half,yy+ny*half,alt],.056,tone,4);
              if(j%5===0){
                beam([xx-nx*half,yy-ny*half,alt-.11],[xx+nx*half,yy+ny*half,alt-.11],.09,'#b7c5c2',4);
                for(const side of [-1,1])beam([xx+side*nx*half,yy+side*ny*half,alt],[xx+side*nx*half,yy+side*ny*half,alt+.66],.042,'#87999e',4);
              }
            }
          }
          m.part(12,b);m.group('it');
          const fromRowX=rowX+rowW*.68,fromRowY=rowY+rowD*.51;
          const trunkY=6.40;
          ladder(3.8,trunkY,20.4,trunkY,tHigh-.22,.32,'#9a9382');
          ladder(3.8,10.3,20.2,10.3,tHigh-.22,.30,'#9a9382');ladder(20.2,10.3,20.2,trunkY,tHigh-.22,.30,'#9a9382');
          if(conversion!=='sst')ladder(3.8,10.3,3.8,trunkY,tHigh-.22,.30,'#9a9382');
          ladder(fromRowX,fromRowY,powerX,fromRowY,tHigh-.22,.33,'#a49881');
          ladder(dataX,opticY+.92,opticX+1.05,opticY+.92,tHigh+.36,.29,'#8b9aab');
          // Independent rack-side supports carry the power ladder and the communications basket.
          for(const [rail,other,yy,height] of [[powerX,powerX+.48,tapY+1.30,tHigh],[dataX,dataX-.35,opticY+.90,tHigh+.58]]){
            beam([other,yy,z],[other,yy,height+.62],.094,'#9cadad',4);
            beam([other,yy,height+.62],[rail,yy,height+.62],.08,'#b3c1c2',4);
            beam([rail,yy,height+.62],[rail,yy,height-.20],.052,'#7e9296',4);
          }
          ladder(powerX,tapY,powerX,fromRowY,tHigh-.22,.33,'#a49881');
          ladder(dataX,netY,dataX,opticY+.92,tHigh+.36,.29,'#8b9aab');
          // Two continuous adjacent feeders branch at the overhead tap, then descend to the two rack strips.
          const paths={conversion,rackIndex:demo.id},port=(p)=>m.world(p);
          hall.powerPaths=paths;
          // Local cable centerlines feed both the solid geometry and the journey. Internal passages are separate.
          function powerCable(key,points,radius,tone){
            m.trace(points,9,radius,tone);paths[key]=points.map(port);
          }
          const wall=[24.19,y+d+.06,z+.82],elbow=[24.19,21.89,z+.82],ceiling=tHigh+.72;
          const incomer=[11.42,10.78,z+3.86],out=[11.90,10.3,z+3.84],primary=[3.90,10.40,z+3.93],secondary=[3.90,9.30,z+3.25];
          const convertIn=[20.2,10.3,z+3.94],convertOut=[19.5,9.5,z+3.96],rowIn=[fromRowX,fromRowY,rowTop+.04];
          paths.entry=port(wall);paths.switchInside=[incomer,[11.42,10.65,z+3.14],[11.9,10.3,z+3.14],out].map(port);
          box(23.82,y+d-.16,z+.38,.73,.36,.86,'#697d84','#a1adb0');
          ladder(24.19,21.89,24.19,13.64,ceiling-.23,.30,'#88959a');ladder(24.19,13.64,11.42,13.64,ceiling-.23,.30,'#88959a');
          powerCable('roomIn',[wall,elbow,[24.19,21.89,ceiling],[24.19,13.64,ceiling],[11.42,13.64,ceiling],[11.42,10.78,ceiling],incomer],.13,'#a99c79');
          if(conversion==='sst'){
            powerCable('toConverter',[out,[out[0],out[1],tHigh],[20.2,10.3,tHigh],convertIn],.14,'#bc985f');
          }else{
            powerCable('toTransformer',[out,[out[0],out[1],tHigh],[3.90,10.3,tHigh],[3.90,10.40,tHigh],primary],.14,'#bc985f');
            paths.transformerInside=[primary,[primary[0],primary[1],z+2.03],[secondary[0],secondary[1],z+1.85],secondary].map(port);
            powerCable('toConverter',[secondary,[3.90,9.30,tHigh],[3.90,trunkY,tHigh],[20.2,trunkY,tHigh],[20.2,10.3,tHigh],convertIn],.14,'#bc985f');
          }
          paths.converterInside=[convertIn,[20.2,10.3,z+2.84],[19.5,9.5,z+2.84],convertOut].map(port);
          powerCable('rowInput',[convertOut,[19.5,9.5,tHigh+.22],[19.5,trunkY,tHigh+.22],[fromRowX,trunkY,tHigh+.22],[fromRowX,fromRowY,tHigh+.22],rowIn],.15,'#cfad77');
          const rowSource=hall.rowSources[demoLane].pos;paths.rowOutputs={};
          for(const feed of ['A','B']){
            const output=[rowSource[0]+(feed==='A'?-.075:.075),rowSource[1],rowSource[2]+.035];
            paths.rowOutputs[feed]=[port(rowIn),[output[0],output[1],output[2]-.12*hall.sz],output];
          }
          for(const [sign,rail] of [[-1,pA],[1,pB]]){
            const lateral=powerX+sign*.12,off=sign*.15;
            m.trace([[fromRowX+off,fromRowY,rowTop+.04],[fromRowX+off,fromRowY,tHigh],[lateral,fromRowY,tHigh],[lateral,tapY,tHigh],[lateral,tapY,tHigh-.66],[rail,tapY,tHigh-.66],[rail,pY,tHigh-.66],[rail,pY,rTop+.23]],9,.095,sign<0?'#d4af71':'#a98e6c');
            m.trace([[rail,pY,rTop-.12],[rail,pY+.31,rTop-.12],[sx+serviceW*(sign<0?.25:.75),pY+.31,rTop-.12],[sx+serviceW*(sign<0?.25:.75),serviceY+.48,rTop-.12]],9,.065,'#cdac76');
          }
          const entry=rx+rackW*.76;
          m.trace([[entry,rear+.100,rTop-1.4],[entry,rear+.47,rTop-1.4],[rx+rackW+.10,rear+.47,rTop-1.4],[rx+rackW+.10,netY,rTop-1.4],[rx+rackW+.10,netY,rTop+.34],[rx+rackW-.05,netY,rTop+.34]],14,.075,'#adb0cd');
          m.trace([[rx+.21,netY,rTop+.55],[rx+.21,netY,tHigh+.52],[dataX,netY,tHigh+.52],[dataX,opticY+.9,tHigh+.52],[opticX+1.05,opticY+.9,tHigh+.52],[opticX+1.05,opticY+.9,z+4.28]],13,.13,'#a78acc');
          // Liquid lines run on a third offset, with separate supply and return terminations at the rack manifold.
          const serviceX=rx+rackW+.93,tz=tHigh-.8;
          if(config.cooling!=='风冷'){
            m.trace([[12,19.4,z+3.49],[12,19.4,tz],[9.2,19.4,tz],[9.2,6.75,tz],[serviceX,6.75,tz],[serviceX,rear+.55,tz],[serviceX,rear+.55,rTop-.55],[rx+rackW+.01,rear+.55,rTop-.55]],10,.14,'#54ada9');
            m.trace([[rx+rackW+.01,rear+.87,rTop-.82],[serviceX+.27,rear+.87,rTop-.82],[serviceX+.27,rear+.87,tz],[serviceX+.27,7.10,tz],[9.6,7.10,tz],[9.6,18.8,tz],[12.9,18.8,tz],[12.9,18.8,z+3.51]],12,.14,'#ae86aa');
          }
          // Air travels through the supply plenum then the adjacent cold aisle to the representative rack intake.
          const low=z+.41,aisle=rx-.39;
          m.trace([[4.65,18.0,z+3.75],[4.65,18.0,z+4.33],[.76,18.0,z+4.33],[.76,5.2,z+4.33],[.76,5.2,low],[aisle,5.2,low],[aisle,ry+rd*.45,low],[rx-.04,ry+rd*.45,z+.80]],11,.17,'#719db5');
        }
        m.part(12,b);m.group('it');
        const header=y+1.25;
        box(x+.65,header,floor+4.65,w-1.30,.48,.55,'#a87e54','#cda661');
        for(let i=0;i<3;i++)box(x+.74+i*(w-1.8)/3,header+.1,floor+1,.44,.22,3.65,'#879ca1');
        for(let j=0;j<4;j++){
          const yy=y+3+j*(d-6)/3;
          box(x+.12,yy,floor+1.0,.36,.36,5.3,'#c6d6d8');box(x+w-.49,yy,floor+1.0,.36,.36,5.3,'#bfced3');
          beam([x+.28,yy+.16,floor+6.15],[x+w-.28,yy+.16,floor+6.15],.135,'#a7c4c8',4);
        }
      }
    }
    m.setTransform(null);m.part(0);
    const middle=plan.dims[Math.floor((halls-1)/2)];anchors.it=middle.roofAnchor;
    // Plant yard: fan openings, service panels, piping, physically separate from the hall roofs.
    m.group('cooling');
    const chillCount=coolingUnitCount(config)/2,coolingBounds={};
    const chW=29/chillCount-1.1,chD=10.7;
    for(let r=0;r<2;r++)for(let j=0;j<chillCount;j++){
      const x=29+j*(chW+1.1),y=-33+r*13,key='cooling-unit-'+(r*chillCount+j+1);
      // Center of the first fan hub is on the rendered unit and remains distinct from its neighbors.
      anchors[key]=[x+chW/2,y+2.72,4.50];
      coolingBounds[key]={min:[x-.2,y-.2,.43],max:[x+chW+.2,y+chD+.2,4.50]};
layout.equipment.push(rectFootprint('chiller-'+r+'-'+j,x-.20,y-.20,chW+.40,chD+.40));
      m.group('none');shadow(x,y,chW,chD,3.2,.42,'#687c81');
      m.group(key);box(x-.2,y-.2,.43,chW+.4,chD+.4,.48,'#74848a','#a8b7b8');
      box(x,y,.91,chW,chD,3.0,'#91a4a8','#bdcbc9');
      box(x-.05,y+chD-.08,3.38,chW+.1,.20,.42,'#b89068','#d6ab79');
      for(let i=0;i<7;i++){const yy=y+.45+i*1.42;box(x-.04,yy,1.32,.12,.57,1.94,'#607881');}
      const rad=Math.min(chW*.40,2.1);
      for(let f=0;f<2;f++){
        const cx=x+chW/2,cy=y+2.72+f*5.2;
        cylinder(cx,cy,3.9,rad+.13,.42,'#849b9f','#c5af8a',16);
        polygon(circle(cx,cy,rad*.88,16),4.34,'#415b65');
        m.rotor([cx,cy]);
        for(let k=0;k<5;k++){
          const a=k*TAU/5;
          polygon([[cx,cy],[cx+Math.cos(a)*rad*.85,cy+Math.sin(a)*rad*.85],[cx+Math.cos(a+.52)*rad*.69,cy+Math.sin(a+.52)*rad*.69]],4.37,'#c3ccc6');
        }
        m.rotor(null);
        cylinder(cx,cy,4.35,rad*.22,.15,'#97afb2','#c0d0ce',10);
      }
    }
    m.group('cooling');
    const headers=[];
    function utility(id,kind,points,radius,hex,animated=false){
      layout.utilities.push({id,kind,points,radius});
      if(animated)m.trace(kind==='return'?[...points].reverse():points,kind==='return'?12:kind==='power'?9:10,radius,hex);
      else for(let j=1;j<points.length;j++)beam(points[j-1],points[j],radius,hex,6);
    }
    // Supply and return remain separate on the west side of the plant. Short branches land on individual units.
    for(let side=0;side<2;side++){
      const kind=side?'return':'supply',tone=side?'#ae92a2':'#78aaa9',hx=27.47+side*.57,z=1.29+side*.36;
      const header=[hx,-5.33-side*.62,z];headers.push(header);
      utility('plant-'+kind,kind,[[hx,-33+chD+.52+side*.45,z],header],.16,tone);
      for(let row=0;row<2;row++){
        const y=-33+row*13,front=y+chD,manifold=front+.52+side*.45;
        const end=29+(chillCount-1)*(chW+1.1)+chW*.40+side*.36;
        utility('header-'+kind+'-'+row,kind,[[hx,manifold,z],[end,manifold,z]],.13,tone);
        for(let j=0;j<chillCount;j++){
          const branchX=29+j*(chW+1.1)+chW*.40+side*.36;
          utility('chiller-port-'+kind+'-'+row+'-'+j,kind,[[branchX,manifold,z],[branchX,front,z]],.087,tone);
        }
      }
    }
    if(config.cooling==='风冷')for(let j=0;j<2;j++){
      const y=-29+j*7;layout.equipment.push(rectFootprint('air-aux-'+j,59,y,2.8,5.3));
      box(59,y,.45,2.8,5.3,3.0,'#879ba6','#bbcacb');
    }
    if(config.cooling==='冷板液冷')for(let j=0;j<3;j++){
      const y=-30+j*6;layout.equipment.push(rectFootprint('water-tank-'+j,58.35,y-1.65,3.3,3.3));
      cylinder(60,y,1,1.65,3.9,'#7b9ca5','#bfcecf',16);
    }
    anchors.cooling=[44,-20,5.0];
    const yardUnits=clamp(Math.round(2+Math.log2((Number(metrics.facility)||it*pue)/80)),2,4);
    const yard=GridYard.build(m,anchors,yardUnits,halls);layout.station=rectFootprint('substation',29,2.6,33,24);
    layout.equipment.push(...yard.footprints);
    // The north–south service road is crossed in sleeves below its paving. Both shoulders remain clear.
    const ductY=25.78,ductStep=.47;
    m.part(0);m.group('none');
    for(let i=0;i<halls;i++){
      const hall=plan.dims[i],path=hall.powerPaths,feederIndex=halls-1-i,feeder=yard.feeders[feederIndex],terminal=feeder.terminal,wall=path.entry;
      path.feederIndex=feederIndex;
      const laneY=ductY+feederIndex*ductStep,riser=[wall[0],wall[1]+.50,1.36],depth=-.68;
      const enter=[27.55,laneY,depth],exit=[20.45,laneY,depth];
      const before=[terminal,[terminal[0],24.81,1.41],[terminal[0],laneY,1.36],[27.70,laneY,1.36],enter];
      const sleeve=[enter,exit],after=[exit,[20.27,laneY,1.36],[riser[0],laneY,1.36],riser,[riser[0],riser[1],wall[2]],wall];
      path.outdoorSections=[before,sleeve,after];
      for(const [j,points] of path.outdoorSections.entries())utility('feeder-'+i+'-'+j,'power',points,.13,'#ab9670',true);
      for(const x of [20.12,27.42])rect(x,laneY-.16,.38,.32,.43,'#b69b78');
      for(const [xMin,xMax] of [[riser[0],20.0],[27.94,terminal[0]]]){
        for(let x=xMin+2.5;x<xMax;x+=7.5)box(x-.09,laneY-.18,1.18,.18,.36,.18,'#707f84','#bac5bd');
      }
      routes.push({points:[...before,...after],color:'#ffd38b'});
    }
    // One facility-water pair per scheme, branching from the common trunks into each hall gallery.
    // The rack-secondary CDU loop is generated separately inside the hall.
    for(let side=0;side<2;side++){
      const kind=side?'return':'supply',tone=side?'#a88d9d':'#6d9c9a',head=headers[side];
      const y=head[1],depth=-.78,west=19.72+side*.55,frontY=24.76+side*.48,z=.71+side*.31;
      const destinations=plan.dims.map(h=>h.facilityWater[side]);
      const trunk=[[head[0],y,head[2]],[27.43,y,depth],[20.57,y,depth],[west,y,z],[west,frontY,z],[Math.min(...destinations.map(p=>p[0])),frontY,z]];
      utility('facility-'+kind,kind,trunk,.105,tone,true);routes.push({points:trunk,color:side?'#d8abba':'#86efe0'});
      for(let i=0;i<halls;i++){
        const hall=plan.dims[i],dst=destinations[i],edgeY=hall.y+hall.d+.15;
        const branchR=Math.min(.095,Math.abs(hall.facilityWater[1][0]-hall.facilityWater[0][0])*.32);
        const outdoor=[[dst[0],frontY,z],[dst[0],edgeY,z],[dst[0],edgeY,dst[2]]];
        utility('hall-water-'+kind+'-'+i,kind,outdoor,branchR,tone,true);
        m.part(3,i);m.group(config.cooling==='风冷'?'air':'liquid');
        utility('hall-water-port-'+kind+'-'+i,kind,[outdoor.at(-1),dst],branchR,tone,true);
        m.part(0);m.group('none');
      }
    }
    const model={plan,layout,coolingBounds,vertices:new Float32Array(m.buffer),faces:m.faces,anchors,routes};
    model.getPowerTour=(options={},openIndex=0)=>{
      const index=clamp(Number.isInteger(openIndex)?openIndex:0,0,halls-1),hall=plan.dims[index],p=hall.powerPaths;
      const branchIndex=clamp(Math.trunc(Number(options.yardUnit)||1)-1,0,yard.transformers.length-1);
      const main=yard.transformers[branchIndex],feeder=yard.feeders[p.feederIndex],rack=hall.rackPoints[p.rackIndex];
      const profile=rack.key.split(':')[1]||project.rackStudy?.profile||'gb200';
      const modules=profile==='pcie'?2*Math.min(4,project.rackStudy?.servers||6):4;
      const slot=clamp(Math.trunc(Number(options.slot)||(options.feed==='B'?2:1)),1,modules),feed=slot%2?'A':'B';
      const ac=p.conversion==='ups',titles={ups:'交流 UPS',sst:'SST 800 V 直流变换柜','800v':'800 V 集中整流柜',hvdc:'集中式 HVDC 柜'};
      const stops=[],segment=(kind,points)=>({kind,points});
      function stop(key,title,text,scope,segments){
        const points=[];
        for(const block of segments)for(const point of block.points){
          const last=points.at(-1);
          if(!last||Math.hypot(...difference(point,last))>.000001)points.push(point);
        }
        stops.push({key,title,text,scope,segments,points,point:points.at(-1)});
      }
      const cable=pts=>segment('cable',pts),enclosed=pts=>segment('enclosed',pts),transfer=pts=>segment('transfer',pts);
      stop('sub-incoming','站内进线端子','从园区内的进线端子出发。画面跟随三相导体中的一相，其他两相并列布置。','yard',[cable(yard.incoming)]);
      stop(main.key,(branchIndex+1)+' 号主变压器','沿所选主变的一次引线到高压套管。一次与二次绕组通过磁场传能，穿过变压器的段落表示能量转换。','yard',[cable(main.primary),transfer(main.coupling)]);
      const end=main.secondary.at(-1),inputBus=main.bus;
      stop('sub-switchgear','站内中压开关设备','二次侧引线从套管下引，沿槽道接入这台主变对应的进线间隔，再进入封闭母线。壳内按中心线示意。','yard',[cable(main.secondary),enclosed([end,[inputBus[0],inputBus[1],2.53],inputBus])]);
      stop('sub-feeder','机房 '+(hall.index+1)+' 的站内馈线','沿站内母线到所选出线间隔，经开关触头送入该机房馈线柜。柜内路径表示电气连接。','yard',
        [enclosed([main.bus,feeder.bus,...feeder.breaker.slice(1)]),cable(feeder.lead),enclosed(feeder.port)]);
      stop('hall-entry','第 '+(hall.index+1)+' 间机房进线','沿园区内部电缆通道转弯，追踪到本机房的穿墙套管。沿车道两侧可见线缆，中间一段从道路下方的套管穿过。','yard',[cable(p.outdoorSections[0]),enclosed(p.outdoorSections[1]),cable(p.outdoorSections[2])]);
      stop('switchgear','机房中压开关柜','电缆从墙边上翻到桥架，再下引至机房中压进线端。进出接点间为柜内一次回路示意。','hall',[cable(p.roomIn),enclosed(p.switchInside)]);
      if(p.toTransformer)stop('transformer','机房配电变压器','机房中压进线接至配变高压侧。绕组经磁场耦合，低压交流从另一组端子引出。','hall',[cable(p.toTransformer),transfer(p.transformerInside)]);
      const explanation={ups:'配变送入低压交流，UPS 在本方案中向列级配电输出连续交流。',sst:'中压交流直接接至 SST，在功率电子变换与高频隔离后输出 800 V 直流。','800v':'工频配变的交流输出送至集中整流装置，得到 800 V 直流。',hvdc:'工频配变输出交流，集中式 HVDC 整流后向直流母线送电。'}[p.conversion];
      stop(p.conversion,titles[p.conversion],explanation+'柜内段按原理示意。','hall',[cable(p.toConverter),transfer(p.converterInside)]);
      stop('rowdist','第 '+(rack.rowIndex+1)+' 列'+(ac?'交流列头柜':'直流列端配电柜'),'沿设施输出桥架到这一列机柜的进线端。本次跟随 '+feed+' 路支路，柜内按母排与分支端子示意。','hall',[cable(p.rowInput),enclosed(p.rowOutputs[feed])]);
      return {hallIndex:index,hallNumber:hall.index+1,rackIndex:p.rackIndex,profile,slot,feed,yardUnit:branchIndex+1,architecture:config.architecture||'交流 UPS',stops};
    };
    const rigCache=new Map();
    model.getRackRig=(rig,apply=true)=>{
      if(!rig||!Number.isInteger(rig.hallIndex)||!Number.isInteger(rig.rackIndex)||!rig.topology)return null;
      const hall=plan.dims[rig.hallIndex],rack=hall?.rackPoints[rig.rackIndex];if(!rack)return null;
      const t=rig.topology,signature=[rig.hallIndex,rig.rackIndex,t.id,t.profile,t.architecture,t.modules?.length,t.servers?.length,t.perServer,rig.boardServerId||''].join('/');
      let entry=rigCache.get(signature);
      if(!entry){
        entry=buildRackRig(hall,rack,rig);
        if(rigCache.size>=2)rigCache.delete(rigCache.keys().next().value);
        rigCache.set(signature,entry);
      }
      if(apply)entry.updateState(rig);
      return entry;
    };
    return model;
  }

  // A single, lazily generated rack remains in the same world coordinates and depth buffer as its hall.
  function buildRackRig(hall,rack,request){
    const t=request.topology,h=request.hallIndex,id=request.rackIndex,min=rack.min,max=rack.max;
    const size=max.map((v,i)=>v-min[i]),center=min.map((v,i)=>v+size[i]/2),m=meshBuilder();
    const xf={dx:min[0],dy:min[1],oz:min[2],sx:size[0]/10,sy:size[1]/8,sz:size[2]/18};
    const {box,beam,rect}=m; m.setTransform(xf);
    const assets=[null],map=new Map(),anchors={},edgePoints={},paths=new Set(request.highlight||[]);
    const doorNode={id:t.id+'-DOOR',kind:'door',label:'前检修门'};
    const frameNode={id:t.id,kind:'rack',label:t.label};
    function role(n){
      if(n.id===request.highlightStep)return 4;
      if(n.id===request.selectedId)return 3;
      if(!paths.has(n.id))return 0;
      return n.kind==='rowdist'||n.kind==='pdu'?1:2;
    }
    function item(n,part=6,customRole=null){
      if(!n)return 0;
      let i=map.get(n.id);if(!i){i=assets.length;map.set(n.id,i);assets.push(n);}
      m.part(part,h);m.group(n.kind==='gpu'?'server':n.kind);m.rigTag(i,customRole===null?role(n):customRole);return i;
    }
    const put=(n,pos)=>{anchors[n.id]=m.world(pos);};
    const metal='#9cabb2',edge='#becbd0',body='#293c47',slot='#192b34',dark='#354b58';
    item(frameNode);put(frameNode,[4.3,4,9.1]);
    box(0,0,0,10,8,.40,dark,'#82919a');box(0,0,17.66,10,8,.34,'#657b88','#a8b7bf');
    box(9.62,.18,.37,.32,7.64,17.29,'#3a525d','#7c8d93');
    box(.21,.02,.43,9.50,.18,17.07,'#4b606c','#8798a0');box(.21,7.8,.43,9.5,.18,17.07,'#4b606c','#8798a0');
    for(const xx of [.12,9.48])for(const yy of [.18,7.48])box(xx,yy,.34,.34,.34,17.35,'#607886',metal);
    for(const yy of [.49,7.28]){
      box(.44,yy,.64,.24,.20,16.05,'#8f9c9f',metal);
      for(let i=0;i<25;i++)box(.415,yy+.033,.88+i*.62,.04,.13,.17,'#283b44');
    }
    // Two mesh-faced leaves swing into the physical service aisle. Hinges remain on their frame posts.
    const hinges=[m.world([-.035,.20,0]),m.world([-.035,7.8,0])];
    for(let side=0;side<2;side++){
      const y0=side?4.03:.22,wide=3.75,part=side?11:7;
      item(doorNode,part);box(-.165,y0,.44,.13,wide,17.14,'#344954','#768892');
      for(const yy of [y0+.04,y0+wide-.15])box(-.25,yy,.46,.10,.14,17.10,'#697f8a',edge);
      for(const zz of [.5,9.35,17.22])box(-.25,y0+.12,zz,.10,wide-.22,.23,'#657a85',metal);
      for(let q=0;q<29;q++)for(let k=0;k<3;k++)box(-.184,y0+.27+k*1.12,.98+q*.55,.028,.90,.17,'#1b2d37');
      const latchY=side?y0+.25:y0+wide-.47;
      box(-.31,latchY,8.2,.22,.20,1.35,'#7a8e99','#c0cbd0');box(-.43,latchY+.035,8.52,.15,.13,.68,'#9caeb3',edge);
      const hy=side?7.76:.18;
      for(const zz of [1.2,8.6,15.7])beam([-.06,hy,zz],[-.06,hy,zz+.92],.13,'#91a1a8',8);
    }
    put(doorNode,[-.15,4.0,8.9]);
    // Compute tray fronts sit behind the vertical feeds, with separate chassis and I/O faces.
    const serverYMin=1.12,serverYMax=6.80,servers=t.servers;
    const low=.95,region=10.30,unitH=region/Math.max(1,servers.length);
    let boardBounds=null;
    const board=request.boardServerId,pcie=t.profile==='pcie',gpuLocations={},serverPorts={};
    // The indicated board is unfolded toward the service aisle for inspection. A rear section stays at its rack connector.
    function boardDetail(server,bottom){
      const floor=bottom+.09,powerZ=floor+.17,front=-4.78;
      boardBounds=[];
      for(const x of [front-.23,1.10])for(const y of [.96,6.99])for(const z of [bottom-.12,bottom+(pcie?1.66:.63)])boardBounds.push(m.world([x,y,z]));
      item(server);
      box(front,1.14,bottom,5.64,5.62,.09,'#6a7b82','#a7b5ac');
      box(front+.10,1.24,floor,5.37,5.39,.14,'#22564a','#438575');
      for(const y of [1.15,6.64])box(front,y,bottom+.05,5.60,.11,.22,'#849493',edge);
      for(const y of [1.43,6.23])box(front-.07,y,bottom+.045,.10,.39,.20,'#acb9b1',metal);
      for(const x of [-4.4,-3.58,-2.76,-1.94,-1.12,-.30]){
        box(x,1.55,powerZ-.035,.49,.22,.12,'#424a52','#67716e');
        box(x+.04,1.60,powerZ+.09,.39,.12,.035,'#b09063');
      }
      if(!pcie){
        for(const y of [2.62,4.98]){
          box(-.57,y-.39,powerZ-.025,.74,.77,.10,'#617677','#9aa8a0');
          box(-.49,y-.30,powerZ+.074,.57,.60,.07,'#916e56','#bd9e7d');
        }
      }
      for(const g of t.gpus.filter(g=>g.serverId===server.id)){
        item(g);
        if(pcie){
          const x=-2.55,y=1.95+g.index*1.24;
          box(x-1.54,y-.095,powerZ-.04,3.27,.19,.19,'#303e42','#998b64');
          box(x-1.50,y-.042,powerZ+.12,3.15,.082,1.03,'#27644f','#75937a');
          box(x-.46,y-.094,powerZ+.37,.86,.052,.52,'#3a4348','#73848a');
          box(x-.29,y-.14,powerZ+.46,.55,.048,.32,'#9da6a0','#d4c79f');
          for(let n=0;n<5;n++)box(x+.65+n*.12,y-.10,powerZ+.32,.06,.09,.60,'#576a70','#849595');
          box(x-1.54,y-.14,powerZ+.10,.12,.29,1.16,'#8999a0',edge);
          gpuLocations[g.id]=[x,y-.14,powerZ+.62];
        }else{
          const x=-3.86+Math.floor(g.index/2)*1.75,y=2.64+(g.index%2)*2.31;
          box(x-.58,y-.56,powerZ-.03,1.16,1.12,.12,'#315648','#638a70');
          box(x-.47,y-.44,powerZ+.09,.94,.88,.12,'#2f383c','#737e82');
          box(x-.245,y-.245,powerZ+.21,.49,.49,.075,'#a5afa7','#d6d4b9');
          for(const side of [-1,1])for(let k=0;k<4;k++)box(x+side*.35-.047,y-.32+k*.18,powerZ+.215,.094,.137,.04,'#455057','#62716f');
          gpuLocations[g.id]=[x,y,powerZ+.285];
        }
        put(g,gpuLocations[g.id]);
      }
    }
    for(const server of servers){
      const bottom=low+server.index*unitH,high=Math.min(1.55,unitH-.075),z=bottom+high*.5;
      item(server);put(server,[.58,4.0,z]);
      serverPorts[server.id]=[.54,6.56,z];
      if(server.id===board){
        boardDetail(server,bottom);
        item(server);box(.86,serverYMin,bottom,6.49,serverYMax-serverYMin,high,'#536d76','#8da2a7');
        continue;
      }
      box(.65,serverYMin,bottom,6.70,serverYMax-serverYMin,high,'#536d76','#8da2a7');
      box(.50,serverYMin+.07,bottom+.044,.16,serverYMax-serverYMin-.14,high-.075,'#304b56','#a8b4b6');
      for(let j=0;j<7;j++)box(.459,serverYMin+.51+j*.49,bottom+high*.35,.048,.33,Math.max(.045,high*.28),'#182f39');
      for(const yy of [serverYMin+.18,serverYMax-.34])box(.36,yy,bottom+high*.13,.16,.13,high*.62,'#9eafb1','#c4cfc9');
      box(.43,serverYMax-.62,bottom+high*.58,.04,.15,Math.max(.05,high*.15),'#83cfc4');
    }
    // A and B are separately pickable. The active module's traced supply is colored independently.
    for(const pdu of t.pdus){
      const yy=pdu.feed==='B'?7.04:.54;item(pdu);put(pdu,[.26,yy+.21,7.8]);
      box(.24,yy,.77,.50,.42,15.9,'#344d58','#93a4ad');
      box(.215,yy+.027,.94,.05,.10,15.35,pdu.feed==='A'?'#c09a68':'#719eaf');
      for(let j=0;j<13;j++){
        const zz=1.24+j*1.10;
        box(.19,yy+.14,zz,.08,.23,.58,'#586d72','#8c9e9d');
        box(.14,yy+.19,zz+.11,.06,.12,.29,'#263c47');
      }
    }
    // Distinct power-supply bays, retention handles, contacts and perforated enclosure panels.
    const slots=t.modules,rows=Math.ceil(slots.length/2),rackY0=1.20,slotW=2.78;
    const upper=17.28,room=5.52,step=room/rows,slotH=Math.min(1.95,step-.18);
    const moduleLoc={};
    for(const md of slots){
      const j=md.index,yy=rackY0+(j%2)*2.90,zz=upper-(Math.floor(j/2)+1)*step+.06;
      item(frameNode);box(.63,yy-.05,zz-.14,7.3,slotW+.10,.14,'#536873',metal);
      box(6.35,yy+.05,zz,1.25,slotW-.10,slotH,'#394f5c','#6f858c');
      item(md,8);put(md,[.31,yy+slotW*.50,zz+slotH*.53]);moduleLoc[md.id]=[.24,yy+slotW*.53,zz+slotH*.5];
      box(.41,yy+.04,zz+.05,5.76,slotW-.08,slotH-.09,'#7a8d94','#adbcc1');
      box(.245,yy,zz,.23,slotW,slotH,'#657e87','#c4cece');
      for(let v=0;v<3;v++)for(let k=0;k<6;k++){
        const zc=zz+.20+v*(slotH-.46)/3;
        box(.215,yy+.22+k*.24,zc,.04,.14,Math.max(.07,slotH*.09),'#243d48');
      }
      for(let k=0;k<8;k++)rect(.99+k*.58,yy+.23,.29,slotW-.46,zz+slotH-.021,'#73888e');
      const hy=yy+slotW-.52,hz=zz+slotH*.25,hh=slotH*.48;
      beam([.19,hy,hz],[-.035,hy,hz],.076,'#cfcec2',6);
      beam([-.035,hy,hz],[-.035,hy,hz+hh],.076,'#c6c8bf',6);
      beam([-.035,hy,hz+hh],[.19,hy,hz+hh],.076,'#c6c8bf',6);
      box(.09,yy+.15,zz+slotH-.26,.16,.50,.12,md.feed==='A'?'#d6a266':'#77b1c0');
      box(.19,yy+1.0,zz+slotH-.23,.055,.17,.09,'#98d7c0');
      for(let k=0;k<4;k++)box(6.17,yy+.44+k*.43,zz+slotH*.30,.18,.18,slotH*.29,'#bd9c65',metal);
    }
    const buses=t.buses||[];
    for(const bus of buses){
      const n=Math.max(1,buses.length),zz=n>1?serverPorts[bus.serverIds[0]][2]+.18:10.96;
      item(bus);put(bus,[.71,6.81,zz]);
      if(n>1)box(.65,6.58,zz-.09,1.25,.40,.20,'#af8e67','#d0b482');
      else{box(.67,6.56,1.05,.26,.25,15.47,'#a88b65','#cfb385');box(.67,6.53,zz,.26,.55,.23,'#a58b68','#d6bb8b');}
    }
    // Each edge is tied to the topology source and destination. No spatial nearest-neighbor inference.
    const lookup=new Map([t.rowdist,...t.pdus,...slots,...buses,...servers,...t.gpus].map(n=>[n.id,n]));
    function wire(e,points,radius,hex,world=false){
      const from=lookup.get(e.from),to=lookup.get(e.to);if(!from||!to)return;
      const traced=paths.has(from.id)&&paths.has(to.id),upstream=from.kind==='rowdist'||from.kind==='pdu';
      const wireNode={id:e.id,kind:'cable',label:from.label+' → '+to.label,from:e.from,to:e.to,upstream};
      item(wireNode,6,request.highlightStep===e.id?4:traced?(upstream?1:2):0);
      if(world)m.setTransform(null);
      edgePoints[e.id]=points.map(p=>m.world(p));
      anchors[e.id]=edgePoints[e.id][Math.floor(points.length/2)];
      for(let k=1;k<points.length;k++){
        if(Math.hypot(...difference(points[k],points[k-1]))<=.004)continue;
        // Package-side contacts are part of the GPU pick surface, including the exact path endpoint.
        if(to.kind==='gpu'&&k===points.length-2)item(to);
        beam(points[k-1],points[k],radius,hex,5);
      }
      if(world)m.setTransform(xf);
    }
    const source=hall.rowSources[rack.rowIndex]?.pos||hall.points.rowdist;
    if(source)anchors[t.rowdist.id]=source;
    item(t.rowdist);
    const boardEdges=board?t.boardEdges.filter(e=>e.from===board):[];
    for(const e of [...t.edges,...boardEdges]){
      const from=lookup.get(e.from),to=lookup.get(e.to);if(!from||!to)continue;
      if(from.kind==='rowdist'&&to.kind==='pdu'&&source){
        const pin=m.world([.44,to.feed==='A'?.76:7.23,16.39]),offset=to.feed==='A'?-.075:.075,ceiling=max[2]+size[2]*.26;
        const trayX=max[0]+Math.max(.20,size[0]*.17)+offset,topX=max[0]-size[0]*.14,exit=[source[0]+offset,source[1],source[2]+.035];
        wire(e,[exit,[exit[0],exit[1],ceiling],[trayX,exit[1],ceiling],[trayX,pin[1],ceiling],[topX,pin[1],ceiling],[topX,pin[1],pin[2]],[pin[0],pin[1],pin[2]]],Math.max(.018,Math.min(.054,size[2]*.014)),to.feed==='A'?'#a99b83':'#79929a',true);
      }else if(from.kind==='pdu'&&to.kind==='psu'){
        const dst=moduleLoc[to.id],left=from.feed==='A',pY=left?.76:7.23,tipY=left?dst[1]-.75:dst[1]+.62;
        wire(e,[[.44,pY,16.39],[.44,pY,dst[2]-.46],[.45,pY,dst[2]-.46],[.17,pY,dst[2]-.46],[.11,tipY,dst[2]-.34],[.25,tipY,dst[2]-.13]],.074,left?'#a79070':'#7796a2');
      }else if(from.kind==='psu'&&to.kind==='bus'){
        const v=moduleLoc[from.id],yy=6.64,zz=buses.length===1?10.96:serverPorts[to.serverIds[0]][2]+.18;
        const tipY=from.feed==='A'?v[1]-.75:v[1]+.62;
        wire(e,[[.25,tipY,v[2]-.13],[.61,tipY,v[2]-.13],[.61,v[1],v[2]],[6.22,v[1],v[2]],[7.77,v[1],v[2]],[7.77,yy,v[2]],[7.77,yy,zz],[.91,yy,zz]],.073,'#9f8972');
      }else if(from.kind==='bus'&&to.kind==='server'){
        const dst=serverPorts[to.id],zz=dst[2],busZ=buses.length===1?10.96:serverPorts[from.serverIds[0]][2]+.18;
        wire(e,[[.91,6.64,busZ],[.85,6.64,busZ],[.85,6.64,zz],[.64,6.86,zz],dst],.057,'#9f9787');
      }else if(from.kind==='server'&&to.kind==='gpu'&&gpuLocations[to.id]){
        const dst=gpuLocations[to.id],src=serverPorts[from.id],plane=low+from.index*unitH+.255;
        const lane=6.33-to.index*.105,x=dst[0]-.72;
        const regZ=pcie?dst[2]-.16:plane+.18;
        item(to);
        // The regulator beside this package is drawn on the PCIe card or on the NVL tray board.
        if(pcie){
          box(x-.14,dst[1]+.012,regZ-.11,.28,.09,.23,'#6c6854','#b4a17b');
          box(x+.18,dst[1]+.038,regZ-.10,.18,.065,.17,'#343e43','#606969');
        }else{
          box(x-.14,dst[1]-.14,plane,.28,.28,.18,'#676a60','#a79774');
          box(x+.16,dst[1]-.10,plane,.17,.20,.08,'#343f41','#61716b');
        }
        wire(e,[src,[.37,src[1],src[2]],[.37,lane,plane],[x,lane,plane],[x,dst[1],plane],[x,dst[1],regZ],[x+.17,dst[1],regZ],[dst[0],dst[1],regZ],dst],.035,'#d6a76d');
      }
    }
    const laneCount=hall.rackPoints.findIndex(p=>p.rowIndex===1),perLane=laneCount===-1?hall.rackPoints.length:laneCount;
    const first=hall.rackPoints[0].pos,nextLane=hall.rackPoints[perLane]?.pos||first,nextColumn=perLane>1?hall.rackPoints[1].pos:first;
    const grid=[first[0],first[1],nextLane[0]-first[0],nextColumn[1]-first[1]];
    const extractionVector=[-size[0]*.54,0,0],palette=new Uint8Array(256*4);
    let priorPath,priorStep;
    const geometry={vertices:new Float32Array(m.buffer),faces:m.faces,assets,anchors,edgePoints,boardBounds,center,size,grid,perLane,frontYaw:-Math.PI/2,hinge:hinges[0],hinges,
      extractionVector,selectedIndex:0,selectedId:null,ownerRow:rack.rowIndex,rowRole:0,rowLocal:map.get(t.rowdist.id),doorId:doorNode.id,palette,stateVersion:0,
      updateState(rig){
        if(geometry.stateVersion&&priorPath===rig.highlight&&priorStep===rig.highlightStep&&geometry.selectedId===rig.selectedId)return;
        priorPath=rig.highlight;priorStep=rig.highlightStep;geometry.selectedId=rig.selectedId;geometry.selectedIndex=map.get(rig.selectedId)||0;
        const ids=new Set(rig.highlight||[]);
        for(let i=1;i<assets.length;i++){
          const n=assets[i];
          const inPath=n.kind==='cable'?ids.has(n.from)&&ids.has(n.to):ids.has(n.id);
          const upstream=n.kind==='cable'?n.upstream:n.kind==='rowdist'||n.kind==='pdu';
          palette[i*4]=n.id===rig.highlightStep?4:n.id===rig.selectedId?3:inPath?(upstream?1:2):0;
        }
        geometry.rowRole=palette[geometry.rowLocal*4];geometry.stateVersion++;
      },
      anchor(nodeId,extension=0){const a=anchors[nodeId];if(!a)return null;return nodeId===geometry.selectedId?along(a,extractionVector,clamp(extension,0,1)):a.slice();}};
    return geometry;
  }

  const pitch0=.565,yaw0=-.61;
  function projectPoint(p,cam) {
    const u=p[0]*cam.ca-p[1]*cam.sa,v=p[0]*cam.sa+p[1]*cam.ca;
    return [cam.cx+u*cam.scale,cam.cy+(v*cam.sp-p[2]*cam.cp)*cam.scale,v*cam.cp+p[2]*cam.sp];
  }
  // Inspect only the unfolded board through any hall wall in front. Other scene pixels retain their depth.
  function boardWindow(detail,cam,width,height){
    if(!cam.rig?.boardInspect||!detail?.boardBounds)return null;
    const points=detail.boardBounds.map(p=>projectPoint(p,cam));
    const sx=width/cam.width,sy=height/cam.height;
    const x0=clamp(Math.floor(Math.min(...points.map(p=>p[0]))*sx),0,width),x1=clamp(Math.ceil(Math.max(...points.map(p=>p[0]))*sx),0,width);
    const y0=clamp(Math.floor(Math.min(...points.map(p=>p[1]))*sy),0,height),y1=clamp(Math.ceil(Math.max(...points.map(p=>p[1]))*sy),0,height);
    return x1>x0&&y1>y0?{x0,x1,y0,y1}:null;
  }
  function webRenderer(canvas) {
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,preserveDrawingBuffer:false,premultipliedAlpha:true});
    if(!gl)return null;
    const vertex=`
      attribute vec3 aPos,aColor,aNormal,aMeta;
      attribute vec2 aPivot;
      uniform vec4 uView,uScreen,uCuts,uRig,uPin,uPull,uWindow,uScope,uGrid;uniform float uOverlay,uPerLane;
      uniform float uCut,uTime,uPass;
      varying vec3 vColor,vWorld,vNormal,vTag;
      varying float vGate;varying vec3 vInfo;
      const vec3 light=normalize(vec3(-.56,-.64,.78));
      vec3 sunlight(vec3 p){vec3 right=normalize(vec3(.64,-.56,0.));return vec3(dot(p,right)/95.,dot(p,cross(light,right))/86.,-dot(p,light)/116.);}
      void main(){
        float part=floor(aMeta.y+.001),hall=fract(aMeta.y+.001)*10.;
        float localCut=hall<.5?uCuts.x:hall<1.5?uCuts.y:hall<2.5?uCuts.z:uCuts.w;
        float phase=clamp(localCut/.96,0.,1.);
        vec3 p=aPos,norm=aNormal;
        if(uOverlay>.5&&(part==7.||part==11.)){
          vec2 pin=part==7.?uPin.xy:uPin.zw;float a=(part==7.?1.:-1.)*1.46*uRig.z;
          mat2 rotation=mat2(cos(a),sin(a),-sin(a),cos(a));p.xy=pin+rotation*(p.xy-pin);norm.xy=rotation*norm.xy;
        }
        if(uOverlay>.5&&part==8.&&abs(aPivot.x-uRig.w)<.2)p+=uPull.xyz*uPull.w;
        if(aMeta.z>5.5&&aMeta.z<6.5){
          float angle=uTime*3.35+dot(aPivot,vec2(.2,.14));vec2 q=p.xy-aPivot;
          p.xy=aPivot+vec2(cos(angle)*q.x-sin(angle)*q.y,sin(angle)*q.x+cos(angle)*q.y);
        }
        if(part==2.)p.z+=8.8*smoothstep(0.,.42,phase)*(1.-.22*smoothstep(.66,1.,phase));
        vColor=aColor;vWorld=p;vNormal=norm;vTag=vec3(aMeta.x,part,aMeta.z);vInfo=vec3(floor(hall+.1),aPivot.x,aPivot.y);
        vGate=24.3-57.*smoothstep(.19,.965,phase);
        if(uPass==1.)gl_Position=vec4(sunlight(p),1.);
        else{
          float x=p.x*uView.x-p.y*uView.y,d=p.x*uView.y+p.y*uView.x,y=d*uView.z-p.z*uView.w;
          gl_Position=vec4(x*uScreen.x+uScreen.z,-y*uScreen.y+uScreen.w,-(d*uView.w+p.z*uView.z)/360.,1.);
        }
        bool removeBackground=false;
        if(uPass!=1.&&uRig.x>=0.&&uOverlay<.5){
          float distanceHall=vInfo.x-uRig.x;
          if(part==12.||part==5.||aMeta.z>=9.)removeBackground=true;
          if((part==1.||part==2.)&&distanceHall*uView.y>.05)removeBackground=true;
          if(part==4.&&abs(distanceHall)<.2){
            float index=aPivot.x-1.,q=floor(index/uPerLane),j=mod(index,uPerLane);
            vec2 offset=uGrid.xy+vec2(q*uGrid.z,j*uGrid.w)-uWindow.xy;
            float ahead=dot(offset,vec2(uView.y,uView.x)),right=dot(offset,vec2(uView.x,-uView.y));
            if(ahead>.12*uWindow.w&&abs(right)<uScope.z*.87)removeBackground=true;
          }
        }
        bool replaceRack=uPass!=1.&&uOverlay<.5&&abs(vInfo.x-uRig.x)<.1&&(part==4.||part==5.)&&abs(aPivot.x-1.-uRig.y)<.1;
        if(removeBackground||replaceRack||(part>=3.&&localCut<.002)||(part>=1.&&part<=2.&&phase>.999))gl_Position=vec4(4.,4.,4.,1.);
      }`;
    const fragment=`
      precision highp float;
      varying vec3 vColor,vWorld,vNormal,vTag;
      varying float vGate;varying vec3 vInfo;
      uniform float uPass,uCut,uTime,uLoad,uShadowScale,uCircuit,uObserve;uniform vec4 uCuts,uAim,uRig,uWindow,uScope;uniform float uOverlay,uSource;
      uniform vec3 uSelection;
      uniform vec4 uView;
      uniform sampler2D uShadow,uRoles;
      const vec3 light=normalize(vec3(-.56,-.64,.78));
      float blocked(vec2 uv,float z){vec4 enc=texture2D(uShadow,uv);return step(dot(enc.rg,vec2(1.,1./255.))+.00076,z);}
      float shadowAt(vec3 p){
        vec3 right=normalize(vec3(.64,-.56,0.));
        vec2 uv=vec2(dot(p,right)/95.,dot(p,cross(light,right))/86.)*.5+.5;
        float d=.5-dot(p,light)/232.,r=uShadowScale;
        return (blocked(uv+vec2(-r,-r)*.75,d)+blocked(uv+vec2(r,-r)*.75,d)+blocked(uv+vec2(-r,r)*.75,d)+blocked(uv+vec2(r,r)*.75,d))*.25;
      }
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*4375.5453);}
      void main(){
        float part=vTag.y,mat=vTag.z;
        bool realPanel=uRig.x>=0.&&part==10.&&abs(vInfo.x-uRig.x)<.2&&abs(vInfo.y-uScope.x-1.)<.2;
        if(part>=1.&&part<=2.&&vWorld.y>vGate)discard;
        float channel=mat>=13.?4.:mat==9.?1.:mat==11.?3.:2.;
        if(mat>=9.&&(uCircuit>4.5||uPass!=0.||(uObserve>.5&&abs(channel-uObserve)>.25)))discard;
        if(uPass==1.){vec2 enc=fract(gl_FragCoord.z*vec2(1.,255.));enc.x-=enc.y/255.;gl_FragColor=vec4(enc,0.,1.);return;}
        if(uPass==2.){
          if(uOverlay>.5||realPanel){gl_FragColor=vec4((realPanel?uSource:vInfo.y)/255.,0.,1./255.,1.);return;}
          float hit=(part==1.||part==2.)&&vTag.x==1.?16.+vInfo.x:part==4.&&vTag.x<20.?4.:vTag.x;
          gl_FragColor=vec4(hit/255.,part==4.?vInfo.y/255.:0.,0.,1.);return;
        }
        vec3 n=normalize(vNormal),eye=vec3(uView.y*uView.w,uView.x*uView.w,uView.z),h=normalize(light+eye);
        float top=max(0.,n.z),nd=max(0.,dot(n,light)),nv=max(0.,dot(n,eye)),fres=pow(1.-nv,3.);
        float sh=shadowAt(vWorld+n*.025);
        vec3 hemi=mix(vec3(.47,.52,.57),vec3(.80,.85,.88),top);
        vec3 col=vColor*(hemi*.72+vec3(.49,.46,.40)*nd*(1.-sh*.82));
        col*=1.-sh*.17;
        if(mat==1.||mat==6.||mat==7.){
          float glint=pow(max(dot(n,h),0.),22.)*.34;
          col+=vec3(.12,.16,.18)*(fres+.23*top)+vec3(.88,.84,.72)*glint*(1.-sh);
          if(mat==7.)col+=vec3(.075,.032,.006);
          if(mat==1.&&top>.9)col+=vec3(.012)*sin(vWorld.y*3.4);
        }else if(mat==2.){
          vec3 ray=reflect(-eye,n);
          float stripes=smoothstep(.25,.86,sin(vWorld.x*.155-vWorld.y*.14+vWorld.z*.65+ray.x*3.)*.5+.5);
          vec3 sky=mix(vec3(.055,.16,.22),vec3(.45,.68,.70),clamp(.28+ray.z*.5+fres*.6+stripes*.26,0.,1.));
          col=mix(col,sky,.69);col+=vec3(.12,.19,.18)*smoothstep(.90,1.,stripes)*(1.-sh*.7);
        }else if(mat==3.){
          col*=.98+.045*hash(floor(vWorld.xy*2.7));col+=.012*vec3(.52,.72,.82)*sin(vWorld.y*.34);
        }else if(mat==4.)col+=vec3(.004,.046,.013)*(.2+nd);
        else if(mat==5.)col=vColor*(.66+uLoad*.34)+vColor*.07;
        else if(mat==8.)col+=vec3(.008,.030,.036)*fres;
        else if(mat>=9.){
          float bulb=pow(max(cos((vInfo.y-uTime*8.)*.55),0.),6.);
          vec3 ec=mat==9.?vec3(1.,.74,.38):mat==10.?vec3(.40,.99,.87):mat==11.?vec3(.43,.75,1.):mat==12.?vec3(.98,.65,.85):mat==13.?vec3(.76,.65,1.):vec3(.73,.82,.96);
          col=mix(col,ec,.25+(.18+.55*bulb)*step(.001,uLoad)+step(.5,uCircuit)*.15);
          if(uCircuit>.5&&abs(channel-uCircuit)>.2)col=mix(vec3(.17,.21,.235),col,.12);
        }
        float localCut=vInfo.x<.5?uCuts.x:vInfo.x<1.5?uCuts.y:vInfo.x<2.5?uCuts.z:uCuts.w;
        if(part>=1.&&part<=2.&&localCut>.18&&localCut<.96){
          float rim=1.-smoothstep(.06,.35,abs(vGate-vWorld.y));col=mix(col,vec3(.54,.92,.87),rim*.8);
        }
        bool outdoorCooling=vTag.x>=${firstCoolingPick}.&&vTag.x<${firstCoolingPick+maxCoolingUnits}.;
        float family=vTag.x<3.5?vTag.x:(vTag.x==4.||vTag.x==24.||(vTag.x>=20.&&vTag.x<=22.))?1.:(vTag.x==9.||vTag.x==10.||vTag.x==23.||outdoorCooling)?2.:3.;
        float selected=family<.5?0.:family<1.5?uSelection.x:family<2.5?uSelection.y:uSelection.z;
        vec3 accent=vTag.x<1.5?vec3(.16,.68,.67):(vTag.x<2.5||outdoorCooling)?vec3(.93,.56,.24):vec3(.33,.58,.91);
        col=col*(1.+selected*.04)+accent*selected*(.034+.095*fres);
        if(uAim.w>.5&&abs(vTag.x-uAim.w)<.25){
          vec3 ds=vWorld-uAim.xyz;float local=outdoorCooling?1.:exp(-dot(ds,ds)*.083);
          col+=vec3(.10,.22,.19)*local*(.46+fres);
        }
        if(part==12.&&mat<9.&&uObserve>.5){float gray=dot(col,vec3(.24,.56,.20));col=mix(vec3(gray*.75,gray*.82,gray*.86),col,.18);}
        float role=realPanel?uScope.y:0.;
        if(uOverlay>.5)role=texture2D(uRoles,vec2((vInfo.y+.5)/256.,.5)).r*255.;
        if(uRig.x>=0.&&uOverlay<.5&&!realPanel){
          float gray=dot(col,vec3(.25,.57,.18));col=mix(vec3(gray*.81,gray*.91,gray),col,.34)*.81;
        }
        if(uOverlay>.5){
          float fill=.77+.24*max(dot(n,eye),0.)+.12*top+.08*nd;
          col=vColor*fill+vec3(.021,.034,.042)+.11*pow(max(dot(n,h),0.),18.);
        }
        if(role>.5){
          vec3 tone=role<1.5?vec3(.99,.56,.19):role<2.5?vec3(.18,.86,.76):role<3.5?vec3(1.,.78,.30):vec3(.76,.91,1.);
          col=mix(col,tone,role>=2.5?.60:.49)+tone*(.11+.15*fres);
        }
        gl_FragColor=vec4(clamp(col,0.,1.),1.);
      }`;
    const shaders=[];
    function compile(type,src){
      const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
      shaders.push(shader);return shader;
    }
    const prog=gl.createProgram();gl.attachShader(prog,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(prog,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('场景着色器连接失败');
    gl.useProgram(prog);
    const vb=gl.createBuffer(),detailBuffer=gl.createBuffer(),U={};
    for(const n of ['View','Screen','Cut','Time','Pass','Load','ShadowScale','Selection','Shadow','Circuit','Cuts','Aim','Rig','Pin','Pull','Scope','Window','Source','Overlay','Grid','PerLane','Roles','Observe'])U[n]=gl.getUniformLocation(prog,'u'+n);
    const attrs=[['aPos',3,0],['aColor',3,12],['aNormal',3,24],['aMeta',3,36],['aPivot',2,48]].map(([n,k,off])=>[gl.getAttribLocation(prog,n),k,off]);
    const shadowSize=Math.min(1536,gl.getParameter(gl.MAX_TEXTURE_SIZE));
    function texture(size,data,height=size){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,height,0,gl.RGBA,gl.UNSIGNED_BYTE,data);return t;
    }
    const fallback=texture(1,new Uint8Array([255,255,255,255])),shadow=texture(shadowSize,null);
    const fb=gl.createFramebuffer(),rb=gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadow,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
    const hasShadow=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.activeTexture(gl.TEXTURE1);
    const roles=texture(256,new Uint8Array(1024),1);gl.uniform1i(U.Roles,1);gl.activeTexture(gl.TEXTURE0);
    let count=0,lastShadow=-10,model=null,detail=null,uploaded=null,paletteVersion=-1;
    let chunks=[];
    function spatialChunks(vertices){
      const out=[],stride=14,block=1536,n=vertices.length/stride;
      for(let first=0;first<n;first+=block){
        const end=Math.min(n,first+block);
        let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity;
        for(let v=first*stride;v<end*stride;v+=stride){
          const x=vertices[v],y=vertices[v+1],z=vertices[v+2],part=Math.floor(vertices[v+10]+.001);
          if(vertices[v+11]===6){
            const cx=vertices[v+12],cy=vertices[v+13],r=Math.hypot(x-cx,y-cy);
            x0=Math.min(x0,cx-r);x1=Math.max(x1,cx+r);y0=Math.min(y0,cy-r);y1=Math.max(y1,cy+r);
          }else{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
          z0=Math.min(z0,z);z1=Math.max(z1,z+(part===2?8.8:0));
        }
        out.push({first,end,x:(x1+x0)/2,y:(y1+y0)/2,z:(z1+z0)/2,rx:(x1-x0)/2,ry:(y1-y0)/2,rz:(z1-z0)/2});
      }
      return out;
    }
    function layer(buffer,n,overlay,cam){
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for(const [a,k,offset] of attrs){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,k,gl.FLOAT,false,56,offset);}
      gl.uniform1f(U.Overlay,overlay);
      if(!cam||cam.width/cam.scale>85){gl.drawArrays(gl.TRIANGLES,0,n);return;}
      const {ca,sa,sp,cp,scale,cx,cy,width,height}=cam;let first=-1,end=0;
      for(const c of chunks){
        const x=cx+(c.x*ca-c.y*sa)*scale,y=cy+((c.x*sa+c.y*ca)*sp-c.z*cp)*scale;
        const rx=(Math.abs(ca)*c.rx+Math.abs(sa)*c.ry)*scale+2;
        const ry=((Math.abs(sa)*c.rx+Math.abs(ca)*c.ry)*sp+c.rz*cp)*scale+2;
        if(x+rx>=0&&x-rx<=width&&y+ry>=0&&y-ry<=height){if(first<0)first=c.first;end=c.end;}
        else if(first>=0){gl.drawArrays(gl.TRIANGLES,first,end-first);first=-1;}
      }
      if(first>=0)gl.drawArrays(gl.TRIANGLES,first,end-first);
    }
    function renderLayers(cam){
      layer(vb,count,0,cam);
      if(!detail)return;
      const board=boardWindow(detail,cam,canvas.width,canvas.height);
      if(board){
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(board.x0,canvas.height-board.y1,board.x1-board.x0,board.y1-board.y0);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.SCISSOR_TEST);
      }
      layer(detailBuffer,detail.vertices.length/14,1);
    }
    function draw(cam,selected,pick=false){
      gl.useProgram(prog);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.DITHER);gl.disable(gl.BLEND);
      const active=cam.rig;detail=model?.getRackRig(active)||null;
      if(detail){
        if(uploaded!==detail){
          gl.bindBuffer(gl.ARRAY_BUFFER,detailBuffer);gl.bufferData(gl.ARRAY_BUFFER,detail.vertices,gl.STATIC_DRAW);
          uploaded=detail;paletteVersion=-1;
        }
        if(detail.stateVersion!==paletteVersion){
          gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,roles);
          gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,256,1,gl.RGBA,gl.UNSIGNED_BYTE,detail.palette);
          gl.activeTexture(gl.TEXTURE0);paletteVersion=detail.stateVersion;
        }
        const [a,b]=detail.hinges,sz=detail.size;
        gl.uniform4f(U.Rig,active.hallIndex,active.rackIndex,clamp(active.door||0,0,1),detail.selectedIndex);
        gl.uniform4f(U.Pin,a[0],a[1],b[0],b[1]);gl.uniform4f(U.Pull,...detail.extractionVector,clamp(active.extraction||0,0,1));
        gl.uniform4f(U.Window,...detail.center,Math.max(...sz));gl.uniform4f(U.Scope,detail.ownerRow,detail.rowRole,sz[1]*.85+sz[0]*.75,sz[2]*.80+sz[1]*.28);
        gl.uniform1f(U.Source,detail.rowLocal);gl.uniform4fv(U.Grid,detail.grid);gl.uniform1f(U.PerLane,detail.perLane);
      }else{gl.uniform4f(U.Rig,-10,-10,0,0);gl.uniform4f(U.Window,0,0,0,1);gl.uniform4f(U.Scope,-10,0,1,1);}
      gl.uniform4f(U.View,cam.ca,cam.sa,cam.sp,cam.cp);
      gl.uniform4f(U.Screen,2*cam.scale/cam.width,2*cam.scale/cam.height,2*cam.cx/cam.width-1,1-2*cam.cy/cam.height);
      gl.uniform4fv(U.Cuts,cam.cuts);gl.uniform4fv(U.Aim,cam.aim);gl.uniform1f(U.Circuit,cam.circuit);gl.uniform1f(U.Observe,cam.observing||0);gl.uniform1f(U.Cut,cam.cut);gl.uniform1f(U.Time,cam.time);gl.uniform1f(U.Load,cam.load);gl.uniform3fv(U.Selection,cam.highlight);
      gl.uniform1i(U.Shadow,0);gl.uniform1f(U.ShadowScale,1.15/shadowSize);gl.activeTexture(gl.TEXTURE0);
      // The courtyard and hall shadows depend on roof removal. Cabinet animation uses its local material lighting.
      const shadowStep=cam.cuts.reduce((sig,v)=>sig*11+Math.round(v*10),0);
      if(hasShadow&&shadowStep!==lastShadow){
        gl.bindTexture(gl.TEXTURE_2D,fallback);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,shadowSize,shadowSize);
        gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(U.Pass,1);layer(vb,count,0);gl.bindFramebuffer(gl.FRAMEBUFFER,null);lastShadow=shadowStep;
      }
      gl.bindTexture(gl.TEXTURE_2D,hasShadow?shadow:fallback);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(U.Pass,pick?2:0);renderLayers(cam);
    }
    return {draw,upload(next){model=next;gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,model.vertices,gl.STATIC_DRAW);count=model.vertices.length/14;chunks=spatialChunks(model.vertices);lastShadow=-10;},
      pick(x,y,cam,selected){draw(cam,selected,true);const pix=new Uint8Array(4);gl.readPixels(clamp(Math.floor(x*canvas.width/cam.width),0,canvas.width-1),clamp(canvas.height-1-Math.floor(y*canvas.height/cam.height),0,canvas.height-1),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pix);draw(cam,selected);if(pix[2]===1&&detail){const n=detail.assets[pix[0]];return n?{key:n.kind,nodeId:n.id,hall:cam.rig.hallIndex,rack:cam.rig.rackIndex}:null;}return pix[1]?{key:pickKey(pix[0]),rack:pix[1]-1}:pickKey(pix[0]);},
      dispose(){gl.deleteFramebuffer(fb);gl.deleteRenderbuffer(rb);gl.deleteTexture(shadow);gl.deleteTexture(fallback);gl.deleteTexture(roles);gl.deleteBuffer(vb);gl.deleteBuffer(detailBuffer);for(const shader of shaders)gl.deleteShader(shader);gl.deleteProgram(prog);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
  }
  // The CPU renderer uses the same vertices, camera and per-pixel depth test.
  // Each visible pixel also records its component ID, including correct occlusion.
  function softwareRenderer(canvas){
    const ctx=canvas.getContext('2d');let model,frame,pixels,depth,ids,detail=null,paletteVersion=-1;
    const colorWord=(rgb,active)=>{
      const channel=(i)=>Math.round(255*clamp(active?rgb[i]*.904+[.033,.126,.111][i]:rgb[i],0,1));
      return (255<<24)|(channel(2)<<16)|(channel(1)<<8)|channel(0);
    };
    function draw(cam,selected){
      const width=canvas.width,height=canvas.height,sel=zones.indexOf(selected);
      if(!frame||width!==frame.width||height!==frame.height){
        frame=ctx.createImageData(width,height);pixels=new Uint32Array(frame.data.buffer);
        depth=new Float32Array(width*height);ids=new Uint16Array(width*height);
      }
      pixels.fill(0);depth.fill(-Infinity);ids.fill(0);
      const sx=width/cam.width,sy=height/cam.height,active=cam.rig;
      const rig=model.getRackRig(active);
      const roles=[null,[1,.57,.20],[.18,.87,.77],[1,.78,.30],[.78,.91,1]];
      function wash(rgb,role){const target=roles[role];return colorWord(rgb.map((v,k)=>target?v*(role>=3?.55:.68)+target[k]*(role>=3?.59:.40):v*1.06+.024),false);}
      if(rig!==detail||rig&&rig.stateVersion!==paletteVersion){
        detail=rig;
        if(detail){
          paletteVersion=detail.stateVersion;
          for(const f of detail.faces){f.rigRole=detail.palette[f.rigId*4];f.ink=wash(f.rgb.map(v=>Math.min(1,v*1.14+.023)),f.rigRole);f.activeInk=f.ink;}
        }
      }
      function triangle(a,b,c,ink,id){
        const edgeX=b[0]-a[0],edgeY=b[1]-a[1],sideX=c[0]-a[0],sideY=c[1]-a[1];
        const det=edgeX*sideY-edgeY*sideX;if(Math.abs(det)<.002)return;
        const x0=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])-.5)),x1=Math.min(width-1,Math.floor(Math.max(a[0],b[0],c[0])-.5));
        const y0=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])-.5)),y1=Math.min(height-1,Math.floor(Math.max(a[1],b[1],c[1])-.5));
        const ux=sideY/det,uy=-sideX/det,vx=-edgeY/det,vy=edgeX/det;
        const dx=x0+.5-a[0],dy=y0+.5-a[1],db=b[2]-a[2],dc=c[2]-a[2];
        let rowU=dx*ux+dy*uy,rowV=dx*vx+dy*vy;
        for(let y=y0;y<=y1;y++,rowU+=uy,rowV+=vy){
          let u=rowU,v=rowV,k=y*width+x0;
          for(let x=x0;x<=x1;x++,u+=ux,v+=vx,k++){
            if(u<-.000001||v<-.000001||u+v>1.000001)continue;
            const z=a[2]+u*db+v*dc;
            if(z>=depth[k]-.000004){pixels[k]=ink;depth[k]=z;if(id!==-1)ids[k]=id;}
          }
        }
      }
      const phase=Array.from({length:4},(_,h)=>[cutState(1,h,cam.cuts[h]),cutState(2,h,cam.cuts[h])]);
      const layers=detail?[model.faces,detail.faces]:[model.faces];
      for(const layer of layers){
        if(detail&&layer===detail.faces){
          const board=boardWindow(detail,cam,width,height);
          if(board)for(let y=board.y0;y<board.y1;y++)depth.fill(-Infinity,y*width+board.x0,y*width+board.x1);
        }
        for(const face of layer){
        const {part,hall,mat}=face,zone=face.group||0,isOuter=part===1||part===2;
        const overlay=Boolean(face.rigId),owner=detail&&hall===active.hallIndex;
        if(owner&&!overlay&&(part===4||part===5)&&face.instance===active.rackIndex)continue;
        const panel=owner&&!overlay&&part===10&&face.instance===detail.ownerRow;
        if(detail&&!overlay){
          if(part===12||part===5||mat>=9||((part===1||part===2)&&(hall-active.hallIndex)*cam.sa>.05))continue;
          if(owner&&part===4){
            const rr=model.plan.dims[hall].rackPoints[face.instance];if(rr){
              const dx=rr.pos[0]-detail.center[0],dy=rr.pos[1]-detail.center[1],sz=detail.size;
              if(dx*cam.sa+dy*cam.ca>.12*Math.max(...sz)&&Math.abs(dx*cam.ca-dy*cam.sa)<(sz[1]*.85+sz[0]*.75)*.87)continue;
            }
          }
        }
        if(part>=3&&cam.cuts[hall]<.002)continue;
        const channel=mat>=13?4:mat===9?1:mat===11?3:2;if(mat>=9&&(cam.circuit===5||cam.observing&&cam.observing!==channel))continue;
        const cs=isOuter?phase[hall][part-1]:null;
        if(cs&&cs.clip<-32.3)continue;
        let points=face.points;
        if(cs&&cam.cuts[hall]>0){
          const output=[];
          for(let i=0;i<points.length;i++){
            const a=points[i],b=points[(i+1)%points.length],keepA=a[1]<=cs.clip,keepB=b[1]<=cs.clip;
            if(keepA)output.push(a);
            if(keepA!==keepB){const t=(cs.clip-a[1])/(b[1]-a[1]);output.push([a[0]+t*(b[0]-a[0]),cs.clip,a[2]+t*(b[2]-a[2])]);}
          }
          points=output;if(points.length<3)continue;
        }
        const pt=face.pivot,angle=pt?cam.time*3.35+pt[0]*.2+pt[1]*.14:0,csA=pt?Math.cos(angle):0,snA=pt?Math.sin(angle):0;
        const p=points.map(v=>{
          let w=v;
          if(overlay&&(part===7||part===11)){
            const side=part===7?0:1,hinge=detail.hinges[side],a=(side?-1:1)*1.46*clamp(active.door||0,0,1);
            const x=v[0]-hinge[0],y=v[1]-hinge[1];w=[hinge[0]+Math.cos(a)*x-Math.sin(a)*y,hinge[1]+Math.sin(a)*x+Math.cos(a)*y,v[2]];
          }
          if(overlay&&part===8&&face.rigId===detail.selectedIndex)w=along(w,detail.extractionVector,clamp(active.extraction||0,0,1));
          if(pt){const x=v[0]-pt[0],y=v[1]-pt[1];w=[pt[0]+csA*x-snA*y,pt[1]+snA*x+csA*y,v[2]];}
          if(cs&&cs.lift)w=[w[0],w[1],w[2]+cs.lift];
          const q=projectPoint(w,cam);q[0]*=sx;q[1]*=sy;return q;
        });
        const focusNear=cam.aim[3]===zone&&zone>0&&(isCoolingPick(zone)||Math.hypot(face.points[0][0]-cam.aim[0],face.points[0][1]-cam.aim[1])<3);
        let ink=(zone>0&&cam.highlight[family(zone)-1]>.35)||focusNear?face.activeInk:face.ink;
        if(detail&&!overlay&&!panel||part===12&&mat<9&&cam.observing)ink=face.contextInk;
        if(panel&&detail.rowRole)ink=wash(face.rgb,detail.rowRole);
        if(mat>=9&&cam.load>0){
          if(Math.cos((face.flow-cam.time*8)*.55)>.6)ink=mat===9?0xff72ceff:mat===10?0xffc5f69e:mat===11?0xffffbe7f:mat===12?0xffe4a9ef:mat===13?0xfff2b5d0:0xffffdfc7;
        }
        if(mat>=9&&cam.circuit!==0&&cam.circuit!==channel)ink=0xff41382e;
        const id=overlay||panel?0x8000|(panel?detail.rowLocal:face.rigId):mat>=9?-1:isOuter&&zone===1?16+hall:zone>=29?0x4000|zone:part===4?((zone<20?4:zone)|((face.instance+1)<<5)):zone;
        for(let i=1;i<p.length-1;i++)triangle(p[0],p[i],p[i+1],ink,id);
        }
      }
      ctx.putImageData(frame,0,0);
    }
    return {draw,upload(m){model=m;for(const f of model.faces){f.ink=colorWord(f.rgb,false);f.activeInk=colorWord(f.rgb,true);const l=.25*f.rgb[0]+.57*f.rgb[1]+.18*f.rgb[2];f.contextInk=colorWord(f.rgb.map((v,i)=>(.66*l*[.81,.91,1][i]+.34*v)*.81),false);}},
      pick(x,y,cam){const id=ids&&ids[Math.floor(y*canvas.height/cam.height)*canvas.width+Math.floor(x*canvas.width/cam.width)];if(id&0x8000){const n=detail?.assets[id&0x7fff];return n?{key:n.kind,nodeId:n.id,hall:cam.rig.hallIndex,rack:cam.rig.rackIndex}:null;}if(id&0x4000)return pickKey(id&0x3fff);return id>31?{key:pickKey(id&31),rack:(id>>5)-1}:pickKey(id);},
      dispose(){model=frame=pixels=depth=ids=null;}};
  }

  function drawGround(canvas,cam){
    const ctx=canvas.getContext('2d'),{width:w,height:h}=cam;
    ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.clearRect(0,0,w,h);
    const grid=ctx.createRadialGradient(cam.cx,cam.cy,0,cam.cx,cam.cy,Math.max(w,h)*.61);
    grid.addColorStop(0,'rgba(105,170,176,.21)');grid.addColorStop(.54,'rgba(94,148,159,.12)');grid.addColorStop(1,'rgba(75,114,130,0)');
    ctx.strokeStyle=grid;ctx.lineWidth=.65;ctx.beginPath();
    function line(a,b){const p=projectPoint(a,cam),q=projectPoint(b,cam);ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);}
    for(let i=-320;i<=320;i+=8){line([i,-320,-2.01],[i,320,-2.01]);line([-320,i,-2.01],[320,i,-2.01]);}
    ctx.stroke();
    const corners=[[-73,-43],[72,-43],[74,-39],[74,42],[71,45],[-72,45],[-75,41],[-75,-39]];
    ctx.save();ctx.shadowColor='rgba(3,9,18,.85)';ctx.shadowBlur=14;ctx.shadowOffsetY=8;
    ctx.beginPath();corners.forEach(([x,y],i)=>{const p=projectPoint([x+1.1,y+1.1,-2.1],cam);if(i===0)ctx.moveTo(...p.slice(0,2));else ctx.lineTo(...p.slice(0,2));});
    ctx.closePath();ctx.fillStyle='#172938';ctx.fill();ctx.restore();
  }

  function mount(container,options={}){
    const wrapper=document.createElement('div');
    wrapper.style.cssText='position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate;touch-action:none;user-select:none;cursor:grab;background:radial-gradient(ellipse at 50% 52%,#213742 0%,#142836 43%,#0e1d2c 68%,#0c1726 90%);';
    wrapper.tabIndex=0;wrapper.setAttribute('role','group');wrapper.setAttribute('aria-label','三维园区方案模型。拖动旋转，滚轮缩放，方向键切换视角，Home 键复位。');
    container.append(wrapper);
    function makeCanvas(){const c=document.createElement('canvas');c.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';c.setAttribute('aria-hidden','true');return c;}
    const ground=makeCanvas();let scene=makeCanvas();wrapper.append(ground,scene);
    const labelColors={it:'#77dfd7',cooling:'#ebae70',power:'#95b9e6'},labels={};
    let project={},metrics={},mode='campus',selected=null,openIndex=0,circuit='all',yaw=yaw0,pitch=pitch0,zoom=1;
    let cam=null,model=null,renderer=null,signature='',scheduled=0,dirty=true,disposed=false;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    let playing=!media.matches,cut=0,cutTarget=0,fx=0,fy=0,fz=0,activeTime=0,prev=0,groundKey='',delayed=0,inViewport=true;
    let wanted={yaw,pitch,zoom,fx:0,fy:0,fz:0};const highlight=[0,0,0],cuts=[0,0,0,0];
    let travel=null,focusKey=null,aim=[0,0,0,0],returnView=null,lastPick=null,restorePending=null;
    const cameraKeys=['yaw','pitch','zoom','fx','fy','fz'];
    let queuedRack,pendingMove=null,focusSignature='',projectionSignature='',labelSignature='',rackRevision=0,rackOrigin=null,nextRackOrigin=null;
    const shortestAngle=(from,to)=>from+Math.atan2(Math.sin(to-from),Math.cos(to-from));
    let tourPlan=null,tourModel=null,layoutView=false;
    const hallPins=[];
    const tourCamera=GridPowerCamera.mount(wrapper,{pose:()=>({yaw,pitch,zoom,fx,fy,fz}),requestDraw,onInspect:step=>options.onTourInspect?.(step)});
    const rackView=GridRackView.mount(wrapper,{
      getRoom:()=>({project,model,hallIndex:openIndex}),
      moveCamera:rackCamera,captureCamera:()=>{
        const state=nextRackOrigin||cameraState();
        if(!nextRackOrigin&&cutTarget===1&&cut<.5)state.camera={...wanted};
        nextRackOrigin=null;rackOrigin=state;return state;
      },
      restoreCamera:view=>{
        rackOrigin=null;
        if(pendingMove){startPendingMove();return;}
        cancelTravel();focusKey=null;focusSignature='';aim=[0,0,0,0];
        wanted={...view.camera};requestDraw();
      },
      redraw:requestDraw,onChange:state=>{rackRevision++;options.onRackChange?.(state);}
    });
    function rackCamera({pts,angle,pitch:tilt,kind}){
      if(!pts.length)return;
      cancelTravel();
      const width=wrapper.clientWidth||800,height=wrapper.clientHeight||400;
      const cs=Math.cos(angle),sn=Math.sin(angle),sp=Math.sin(tilt),cp=Math.cos(tilt);
      const projected=pts.map(([x,y,z])=>[x*cs-y*sn,(x*sn+y*cs)*sp-z*cp]);
      const edges=axis=>[Math.min(...projected.map(p=>p[axis])),Math.max(...projected.map(p=>p[axis]))];
      const [x0,x1]=edges(0),[y0,y1]=edges(1);
      const base=Math.min(width/190,height/Math.max(107,15+165*sp));
      const zoomTarget=clamp(Math.min(width*(kind==='circuit'?.72:.70)/Math.max(.18,x1-x0),height*.71/Math.max(.22,y1-y0))/base,.7,320);
      const z=pts.reduce((acc,p)=>acc+p[2],0)/pts.length,midX=(x0+x1)*.5,depth=((y0+y1)*.5+z*cp)/sp;
      const dest={yaw:yaw+Math.atan2(Math.sin(angle-yaw),Math.cos(angle-yaw)),pitch:tilt,zoom:zoomTarget,fx:midX*cs+depth*sn,fy:depth*cs-midX*sn,fz:z};
      if(media.matches){wanted=dest;({yaw,pitch,zoom,fx,fy,fz}=dest);}
      else{travel={start:{yaw,pitch,zoom,fx,fy,fz},dest,at:performance.now(),ms:kind==='circuit'?730:640,resolve:()=>{}};wanted=dest;}
      requestDraw();
    }
    function fitLayout(){
      const w=wrapper.clientWidth||800,h=wrapper.clientHeight||420,tilt=Math.PI/2-.015;
      const base=Math.min(w/190,h/(15+165*Math.sin(tilt)));
      wanted={yaw:shortestAngle(yaw,0),pitch:tilt,zoom:Math.min(w*.94/150,h*.83/91)/base,fx:0,fy:1,fz:0};
    }
    function setLayoutView(on){
      on=Boolean(on)&&mode==='campus';
      if(layoutView===on)return;
      cancelPendingMove();cancelTravel();returnView=null;lastPick=null;focusKey=null;focusSignature='';
      layoutView=on;wrapper.dataset.layout=String(on);
      if(on)fitLayout();
      else{hallPins.forEach(b=>b.hidden=true);focus(null);}
      options.onLayoutChange?.(on);labelSignature='';requestDraw();
    }
    function layoutLabels(){
      for(let i=0;i<hallPins.length;i++){
        const h=model.plan.dims[i],pin=hallPins[i],p=projectPoint([h.center[0],h.center[1],5],cam);
        const n=String(h.index+1).padStart(2,'0');pin.textContent=cam.width<600?n:'机房 '+n;
        pin.hidden=!layoutView||p[0]<8||p[0]>cam.width-8||p[1]<12||p[1]>cam.height-12;
        pin.style.left=p[0]+'px';pin.style.top=p[1]+'px';
      }
    }
    function preparePowerTour(settings={}){
      if(dirty||!model)rebuild();
      const hall=model.getPowerTour(settings,openIndex);
      if(!hall)return [];
      const branch={hallIndex:openIndex,rackIndex:hall.rackIndex,slot:hall.slot};
      const cabinet=rackView.getJourneyPlan({...branch,serverNumber:settings.serverNumber,gpuNumber:settings.gpuNumber})||rackView.getJourneyPlan(branch);
      if(!cabinet)return [];
      const inside=cabinet.stops.filter(s=>s.key!=='rowdist').map(s=>({...s,title:s.label,text:s.description,scope:'rack'}));
      const stops=[...hall.stops,...inside];
      if(!stops.length||!stops.every(s=>s.points?.length&&s.points.every(p=>p.length===3&&p.every(Number.isFinite))))return [];
      tourPlan={...hall,stops,cabinet};tourModel=model;
      return stops;
    }
    function setTourStop(step){
      if(dirty)rebuild();
      if(!tourPlan||model!==tourModel)return false;
      if(layoutView)setLayoutView(false);
      cancelTravel();cancelPendingMove();queuedRack=null;rackView.cancelTour();
      if(openIndex!==tourPlan.hallIndex){rackView.clear();openIndex=tourPlan.hallIndex;cuts.fill(0);}
      if(step.scope==='rack'){
        const {slot,serverNumber,gpuNumber}=tourPlan.cabinet;
        if(!rackView.prepareJourney({hallIndex:openIndex,rackIndex:tourPlan.rackIndex,slot,serverNumber,gpuNumber}))return false;
        rackView.setJourneyStep(step.key);rackView.cancelTour();
      }else if(rackView.rig)rackView.clear();
      cancelTravel();
      focusKey=null;focusSignature='';returnView=null;lastPick=null;
      aim=[...step.points.at(-1),Math.max(0,pickKeys.indexOf(step.key))];
      return true;
    }
    function tourView(step){
      const rig=step.scope==='rack'&&rackView.rig&&model.getRackRig(rackView.rig);
      const end=step.key==='gpu',server=step.key==='server';
      const board=end||server;
      const angle=rig?rig.frontYaw+(board ? .20 : .37):(step.scope==='yard' ? -.65 : -.93);
      const tilt=rig?(board ? .63 : .38):(step.scope==='yard' ? .66 : .85);
      const w=wrapper.clientWidth||800,h=wrapper.clientHeight||420;
      const base=Math.min(w/190,h/Math.max(107,15+165*Math.sin(tilt)));
      const rackHeight=rig?rig.size[2]:1;
      const span=rig?rackHeight*({pdu:1.72,psu:.72,bus:.92,server:.67,gpu:.54}[step.key]||1):
        step.scope==='yard'?20:step.key==='switchgear'?25:14;
      return {yaw:angle,pitch:tilt,zoom:clamp(Math.min(w*.78,h*.96)/(span*base),.7,820)};
    }
    function followPowerTour(request){
      if(request.signal.aborted||!setTourStop(request.step))return Promise.resolve(false);
      return tourCamera.play(request,tourView(request.step));
    }
    function inspectTourLoad(step){
      if(!setTourStop(step))return false;
      const target=step.points.at(-1),v=tourView(step);
      wanted={yaw:shortestAngle(yaw,v.yaw),pitch:v.pitch,zoom:v.zoom,fx:target[0],fy:target[1],fz:target[2]};
      requestDraw();return true;
    }
    function openRack(slot,index){
      if(mode!=='cutaway')return false;
      cancelPendingMove();cancelTravel();
      if(!rackView.rig&&returnView)nextRackOrigin=returnView;
      returnView=null;focusKey=null;focusSignature='';aim=[0,0,0,0];
      if(!model||dirty){queuedRack={slot,index};requestDraw();return true;}
      const opened=rackView.enter(index);
      if(opened&&slot)rackView.selectSlot(slot);
      return opened;
    }
    function cancelTravel(){
      if(travel){const old=travel;travel=null;wanted={yaw,pitch,zoom,fx,fy,fz};old.resolve(false);}
    }
    function cameraState(){
      return {version:1,mode,circuit,selected,hallNumber:(model?.plan.dims[openIndex]?.index??openIndex)+1,openIndex,
        camera:{yaw,pitch,zoom,fx,fy,fz}};
    }
    function getViewState(){return returnView?{...returnView,camera:{...returnView.camera}}:cameraState();}
    function restoreViewState(v){
      if(!v||v.version!==1||!v.camera||!cameraKeys.every(k=>Number.isFinite(v.camera[k]))||!['campus','cutaway'].includes(v.mode))return false;
      cancelPendingMove();if(rackView.rig)rackView.clear();
      if(!model||dirty){restorePending=v;requestDraw();return true;}
      cancelTravel();returnView=null;lastPick=null;focusKey=null;focusSignature='';aim=[0,0,0,0];
      let index=model.plan.dims.findIndex(h=>h.index+1===v.hallNumber);if(index<0)index=clamp(Math.trunc(v.openIndex)||0,0,model.plan.dims.length-1);
      openIndex=index;mode=v.mode;circuit=Object.hasOwn(circuitIds,v.circuit)?v.circuit:'all';selected=zones.includes(v.selected)?v.selected:null;
      cutTarget=mode==='cutaway'?1:0;cuts.fill(0);cuts[openIndex]=cutTarget;cut=cutTarget;
      const cc=v.camera;wanted={yaw:cc.yaw,pitch:clamp(cc.pitch,.24,1.18),zoom:clamp(cc.zoom,.52,24),fx:clamp(cc.fx,-95,95),fy:clamp(cc.fy,-75,75),fz:clamp(cc.fz,0,30)};
      ({yaw,pitch,zoom,fx,fy,fz}=wanted);
      requestDraw();return true;
    }
    function cancelPendingMove(){
      if(!pendingMove)return;
      const old=pendingMove;pendingMove=null;old.resolve(false);
    }
    function equipmentAnchor(key,includeRig=true){
      if(!model||typeof key!=='string')return null;
      const h=model.plan.dims[openIndex],rig=includeRig&&rackView.rig;
      if(rig){
        const geometry=model.getRackRig(rig),n=geometry?.anchor(key,rig.extraction);
        if(n)return n;
        const t=rig.topology,psu=t.modules.find(v=>v.id===rig.selectedId)||t.modules[0];
        const node={rack:t,rowdist:t.rowdist,pdu:t.pdus.find(v=>v.id===psu?.pduId),psu,bus:t.buses.find(v=>v.id===psu?.busId),server:t.servers.find(v=>psu?.serverIds.includes(v.id))}[key];
        if(node&&geometry?.anchors[node.id])return geometry.anchor(node.id,rig.extraction);
      }
      if(Object.hasOwn(model.anchors,key))return model.anchors[key];
      if(!h||mode!=='cutaway')return null;
      if(lastPick?.key===key)return lastPick.pos;
      if(key.startsWith('rack:'))return h.rackPoints.find(n=>n.key===key)?.pos||null;
      return Object.hasOwn(h.points,key)?h.points[key]:null;
    }
    function getEquipmentProjection(keys){
      const out={};if(!cam||!Array.isArray(keys))return out;
      for(const key of keys){
        const pt=equipmentAnchor(key);if(!pt)continue;
        const [x,y,depth]=projectPoint(pt,cam);out[key]={x,y,depth};
      }
      return out;
    }
    function startPendingMove(){
      const req=pendingMove;if(!req||!model||dirty||disposed)return;
      const directRig=rackView.rig&&Object.hasOwn(model.getRackRig(rackView.rig).anchors,req.key);
      const target=equipmentAnchor(req.key,Boolean(directRig));
      if(!target){pendingMove=null;req.resolve(false);return;}
      if(rackView.rig&&!directRig){rackView.leave();requestDraw();return;}
      pendingMove=null;
      const {key,peers}=req,points=[target,...peers.map(k=>equipmentAnchor(k,Boolean(directRig))).filter(Boolean)];
      if(!returnView){
        returnView=rackOrigin||cameraState();
        if(!rackOrigin&&mode==='cutaway'&&cut<.55)returnView.camera={...wanted};
      }
      cancelTravel();
      focusKey=key;focusSignature=req.signature;aim=[...target,Math.max(0,pickKeys.indexOf(key))];
      const wide=points.length>1,yard=key.startsWith('sub-')||Object.hasOwn(model.anchors,key);
      const nearParts=['network','psu','pdu'],pair=peers.length===1&&points.length===2&&
        ((key.startsWith('rack')&&nearParts.includes(peers[0]))||(peers[0].startsWith('rack')&&nearParts.includes(key)));
      const small=pair||['pdu','psu','network','fan'].includes(key);
      const W=wrapper.clientWidth||850,H=wrapper.clientHeight||440;
      const cooler=!wide&&model.coolingBounds[key];
      const tilt=cooler?.76:yard?(wide?.68:.55):pair?.72:wide?.89:small?.83:.76;
      let angle=yard?-.67:small?-.81:-.94;
      // Keep the chain near horizontal even if the two connected devices are far apart.
      if(wide){
        const far=points.slice(1).reduce((a,v)=>Math.hypot(v[0]-target[0],v[1]-target[1])>Math.hypot(a[0]-target[0],a[1]-target[1])?v:a);
        const dx=far[0]-target[0],dy=far[1]-target[1];
        if(Math.hypot(dx,dy)>2){
          let aligned=shortestAngle(angle,-Math.atan2(dy,dx));
          if(Math.abs(aligned-angle)>Math.PI/2)aligned=shortestAngle(angle,aligned+Math.PI);
          angle+=clamp(aligned-angle,-.88,.88)*.80;
        }
      }
      if(pair){
        const [dx,dy,dz]=points[1].map((v,i)=>v-target[i]),startAngle=angle;
        let best=-1;
        for(const offset of [0,-.55,.55,-1.0,1.0]){
          const a=startAngle+offset,ca=Math.cos(a),sa=Math.sin(a);
          const separation=Math.hypot(dx*ca-dy*sa,(dx*sa+dy*ca)*Math.sin(tilt)-dz*Math.cos(tilt));
          const score=separation/(1+Math.abs(offset)*.09);
          if(score>best){best=score;angle=a;}
        }
      }
      const cs=Math.cos(angle),sn=Math.sin(angle),sp=Math.sin(tilt),cp=Math.cos(tilt);
      const project=p=>[p[0]*cs-p[1]*sn,(p[0]*sn+p[1]*cs)*sp-p[2]*cp];
      const boundsPoints=cooler?[cooler.min[0],cooler.max[0]].flatMap(x=>[cooler.min[1],cooler.max[1]].flatMap(y=>
        [cooler.min[2],cooler.max[2]].map(z=>[x,y,z]))):points;
      const xy=boundsPoints.map(project),x0=Math.min(...xy.map(p=>p[0])),x1=Math.max(...xy.map(p=>p[0])),y0=Math.min(...xy.map(p=>p[1])),y1=Math.max(...xy.map(p=>p[1]));
      const base=Math.min(W/190,H/Math.max(107,15+165*sp));
      const zone=zones.includes(key),h=model.plan.dims[openIndex],hallUnit=clamp(Math.min(h.w/32,h.d/23),.45,1.8);
      const sameYard=key.startsWith('sub-')&&peers.every(k=>k.startsWith('sub-'));
      const radius=directRig?.25:zone?19:yard?6.4:hallUnit*(small?1.48:2.75);
      const yardWidth=key==='sub-incoming'?16:key==='sub-switchgear'?11:9.0;
      const padX=cooler?1.15:sameYard?(wide?6.3:yardWidth):radius*2.8,padY=cooler?1.15:sameYard?(wide?4.8:8.0):radius*1.8;
      const fit=Math.min(W*(cooler?.79:sameYard?.81:W<490?.61:.67)/(x1-x0+padX),H*(cooler?.73:sameYard?.67:.60)/(y1-y0+padY));
      const span=Math.max(.01,Math.hypot(x1-x0,y1-y0));
      const focusScale=pair?(W<500?clamp(fit,46/span,50/span):Math.max(fit,46/span)):fit;
      const destZoom=clamp(focusScale/base,.68,directRig?190:pair?125:cooler||sameYard?40:yard?15:24);
      const z=boundsPoints.reduce((n,p)=>n+p[2],0)/boundsPoints.length;
      const midX=(x0+x1)*.5,depth=((y0+y1)*.5+z*cp)/sp;
      wanted={yaw:shortestAngle(yaw,angle),pitch:tilt,zoom:destZoom,fx:midX*cs+depth*sn,fy:depth*cs-midX*sn,fz:z};
      const distance=Math.hypot(wanted.fx-fx,wanted.fy-fy,wanted.fz-fz);
      const scaleChange=Math.abs(Math.log(destZoom/zoom));
      travel={promise:req.promise,resolve:req.resolve,start:{yaw,pitch,zoom,fx,fy,fz},dest:{...wanted},at:performance.now(),
        ms:media.matches?0:clamp(380+distance*4+scaleChange*96,430,1000),arc:clamp(distance/75,0,.36)};
      requestDraw();
    }
    function moveToEquipment(key,settings={}){
      if(disposed||typeof key!=='string'||!key)return Promise.resolve(false);
      if(layoutView)setLayoutView(false);
      const peers=[...new Set((Array.isArray(settings?.peers)?settings.peers:[]).filter(v=>typeof v==='string'&&v!==key))].sort();
      const signature=[key,...peers].join('|');
      if(pendingMove?.signature===signature)return pendingMove.promise;
      if(!pendingMove&&focusSignature===signature&&focusKey===key)return travel?.promise||Promise.resolve(true);
      if(model&&!dirty&&!equipmentAnchor(key))return Promise.resolve(false);
      cancelPendingMove();cancelTravel();rackView.cancelTour();queuedRack=null;
      if(rackView.rig&&!returnView&&rackOrigin)returnView=rackOrigin;
      let resolve;const promise=new Promise(r=>{resolve=r;});
      pendingMove={key,peers,signature,promise,resolve};
      if(!dirty&&model)startPendingMove();
      requestDraw();return promise;
    }
    function focusEquipment(key){return moveToEquipment(key);}
    function clearEquipmentFocus(){
      const had=Boolean(pendingMove||focusKey||returnView);cancelPendingMove();
      if(!had)return false;
      cancelTravel();const back=returnView;returnView=null;focusKey=null;focusSignature='';aim=[0,0,0,0];lastPick=null;
      if(back&&!rackView.rig)wanted={...back.camera};
      requestDraw();return true;
    }
    function focus(key,keepPending=false){
      if(!keepPending)cancelPendingMove();cancelTravel();returnView=null;focusKey=null;focusSignature='';lastPick=null;aim=[0,0,0,0];wanted.fz=0;
      if(mode==='cutaway'&&model){
        const h=model.plan.dims[openIndex]||model.plan.dims[0];
        const angle=-.96,elevation=.99,W=wrapper.clientWidth||850,H=wrapper.clientHeight||440;
        const sin=Math.abs(Math.sin(angle)),cos=Math.cos(angle),sp=Math.sin(elevation),base=Math.min(W/190,H/Math.max(107,15+165*sp));
        const fit=Math.min(W*.75/(h.w*cos+h.d*sin),H*.76/((h.w*sin+h.d*cos)*sp+5*h.sz*Math.cos(elevation)));
        wanted.fx=h.center[0];wanted.fy=h.center[1];wanted.zoom=clamp(fit/base,1.6,14);
        wanted.pitch=elevation;
        const d=Math.atan2(Math.sin(angle-wanted.yaw),Math.cos(angle-wanted.yaw));wanted.yaw+=d;return;
      }
      const a=key&&model?.anchors[key],base=mode==='cutaway'?.72:pitch0;
      wanted.fx=a?a[0]*.32:0;wanted.fy=a?a[1]*.26:0;
      wanted.zoom=a?1.19:1;wanted.pitch=base+(a ? .065 : 0);
      const direction=key==='cooling'?-.09:key==='power'?.08:0;
      const delta=Math.atan2(Math.sin(yaw0+direction-wanted.yaw),Math.cos(yaw0+direction-wanted.yaw));wanted.yaw+=delta;
    }
    function useSoftware(){
      const old=scene;scene=makeCanvas();old.replaceWith(scene);
      renderer=softwareRenderer(scene);wrapper.dataset.engine='canvas';
      if(model)renderer.upload(model);
    }
    try{renderer=webRenderer(scene);}catch(e){renderer=null;}
    if(renderer){
      wrapper.dataset.engine='webgl';
      scene.addEventListener('webglcontextlost',e=>{e.preventDefault();if(disposed)return;useSoftware();requestDraw();});
    }else useSoftware();
    function select(key,notify){
      const next=zones.indexOf(key)>0?key:null;
      if(layoutView&&next&&notify)setLayoutView(false);
      if(next!==selected){rackView.clear();selected=next;focus(next);requestDraw();}
      if(notify&&next&&typeof options.onSelect==='function') options.onSelect(next);
    }
    const hallInfo=document.createElement('div'),hallMenu=document.createElement('select'),hallNote=document.createElement('span');
    hallInfo.style.cssText='position:absolute;z-index:2;left:9px;bottom:9px;max-width:calc(100% - 56px);display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;padding:4px 7px;background:#0d1c29e8;border:1px solid #35515e;border-radius:5px;color:#bfd0d6;font:500 10px/1.3 system-ui,"PingFang SC",sans-serif;';
    hallMenu.setAttribute('aria-label','切换剖视机房');hallMenu.style.cssText='font:inherit;color:#b2dfd5;background:#142c34;border:1px solid #36555a;border-radius:3px;padding:1px 2px;cursor:pointer;color-scheme:dark';
    function switchHall(index){
      if(!model)return;
      const next=clamp(index,0,model.plan.dims.length-1);if(next===openIndex)return;
      rackView.clear();openIndex=next;focus(selected);options.onHallChange?.(model.plan.dims[next].index);requestDraw();
    }
    hallMenu.addEventListener('change',()=>switchHall(Number(hallMenu.value)));
    const relation=document.createElement('span');relation.style.cssText='padding-left:5px;color:#bfd3d7;border-left:1px solid #3b535c;';
    const lineLegend=document.createElement('span');
    lineLegend.style.cssText='display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
    const entries=[['power','供电','#f4bd74'],['liquid','供液','#76daca'],['liquid','回液','#e3a5d0'],['air','送风','#82b8e2'],['data','光纤','#c3a5ed'],['data','铜缆','#b7c6e3']];
    for(const [type,title,color] of entries){const tag=document.createElement('span');tag.dataset.circuit=type;tag.textContent='→ '+title;tag.style.color=color;lineLegend.append(tag);}
    hallInfo.append(hallMenu,hallNote,lineLegend,relation);wrapper.append(hallInfo);
    const format=n=>Math.round(n).toLocaleString('zh-CN');
    function info(){
      const p=model.plan,cutaway=mode==='cutaway',h=p.dims[openIndex];hallMenu.style.display=cutaway?'':'none';if(hallMenu.value!==String(openIndex))hallMenu.value=String(openIndex);
      const dims=(v)=>Number(v.toFixed(1)).toLocaleString('zh-CN');
      const message=cutaway?'净区 '+dims(h.lengthM)+' × '+dims(h.widthM)+' m · '+format(h.installed)+' 柜'+(h.symbols<h.installed?' · 图示 '+h.symbols+' 柜':'')+(h.detailScale?' · 局部放大':''):
        format(p.halls)+' 间机房 · '+format(p.racks)+' 柜'+(p.dims.length<p.halls?' · 图示 '+p.dims.length+' 间代表机房':'');
      if(hallNote.textContent!==message)hallNote.textContent=message;
      const currentConfig=project.config||{};lineLegend.style.display=cutaway&&circuit!=='none'?'flex':'none';
      for(const entry of lineLegend.children){const key=entry.dataset.circuit;entry.style.display=(circuit==='all'||key===circuit)&&(key!=='liquid'||currentConfig.cooling!=='风冷')?'':'none';}
      const ac=currentConfig.architecture==='交流 UPS'||!currentConfig.architecture,liquid=currentConfig.cooling!=='风冷';
      const connection={power:ac?'进线 → UPS → 列头柜 → A/B PDU → PSU':'进线 → 直流变换 → 列端柜 → 母线分支 → 柜端电源',
        data:'网卡 → 铜缆接入 → ToR → 光纤上联',liquid:liquid?'CDU 供液 → 机柜换热 → 回液至 CDU':'该方案采用风冷',air:'风机 → 送风通道 → 机柜进风口'}[circuit];
      relation.style.display=cutaway&&connection?'':'none';if(connection&&relation.textContent!==connection)relation.textContent=connection;
      hallInfo.title=message+(p.whiteSpaceM2?' · IT 净面积 '+format(p.whiteSpaceM2)+' m²':'')+(p.grossM2?' · 估算建筑面积 '+format(p.grossM2)+' m²':'');
    }
    function openHall(index){
      if(!model)return;
      openIndex=clamp(Number.isInteger(index)?index:Math.floor((model.plan.dims.length-1)/2),0,model.plan.dims.length-1);
      select('it',true);
      if(typeof options.onOpenHall==='function')options.onOpenHall();
      else{mode='cutaway';cutTarget=1;focus('it');requestDraw();}
    }
    function handleHit(hit){
      const key=typeof hit==='string'?hit:hit?.key;
      if(!key)return;
      if(mode==='cutaway'&&rackView.hit(hit))return;
      if(mode==='cutaway'&&(key==='rack'||key.startsWith('rack:')||key==='psu')){
        openRack(key==='psu'?1:null,typeof hit==='object'?hit.rack:undefined);return;
      }
      if(key.startsWith('cooling-unit-')){
        if(options.onInspect)options.onInspect(key);else select('cooling',true);
        return;
      }
      if(key.startsWith('sub-')){options.onInspect?.(key);return;}
      const picked=typeof hit==='object'&&Number.isInteger(hit.rack)?model.plan.dims[openIndex]?.rackPoints[hit.rack]:null;
      lastPick=picked?{key,pos:picked.pos}:null;
      if(mode==='campus'&&(key==='it'||key.startsWith('hall-'))){openHall(key.startsWith('hall-')?Number(key.slice(5)):undefined);return;}
      if(mode==='cutaway'&&key.startsWith('hall-')){switchHall(Number(key.slice(5)));return;}
      if(mode==='cutaway'&&(equipmentTitles[key]||key.startsWith('rack:'))){
        if(typeof options.onInspect==='function')options.onInspect(key);else select(zones[family(pickKeys.indexOf(key))],true);
      }else if(zones.includes(key)&&key!=='none'){select(key,true);if(key==='power'||key==='cooling')options.onInspect?.(key);}
    }
    const labelKeys=[...zones.slice(1),'rack','transformer','switchgear','ups','sst','800v','hvdc','liquid','air','rowdist','pdu','psu','fan','network'];
    const channelMembers={power:['switchgear','transformer','ups','sst','hvdc','800v','rowdist','pdu','psu'],liquid:['liquid','rack'],air:['air','fan','rack'],data:['network','rack']};
    const advanced=new Set(['pdu','psu','fan']);
    for(const key of labelKeys){
      const unit=Boolean(equipmentTitles[key]),nameText=unit?equipmentTitles[key]:zoneNames[key],color=unit?(['liquid','rack'].includes(key)?'#76d7c6':['air','fan'].includes(key)?'#8ec4ed':key==='network'?'#c2a4ed':'#dfb27a'):labelColors[key];
      const label=document.createElement('button');label.type='button';label.dataset.zone=key;label.setAttribute('aria-label','查看'+nameText);
      label.style.cssText='position:absolute;z-index:1;transform:translate(-50%,-100%);display:none;align-items:center;gap:5px;background:rgba(17,34,47,.94);border:1px solid rgba(170,206,210,.39);border-radius:4px;padding:3px 6px;color:#e2eded;white-space:nowrap;font:500 10px/1.2 system-ui,"PingFang SC",sans-serif;letter-spacing:.035em;cursor:pointer;box-shadow:0 2px 6px #0a192336;';
      const dot=document.createElement('i');dot.style.cssText='width:5px;height:5px;border-radius:50%;display:block;background:'+color;
      const stem=document.createElement('i');stem.style.cssText='position:absolute;left:50%;top:100%;border-left:1px solid '+color+';pointer-events:none;transform-origin:0 0;';
      const name=document.createElement('span');name.textContent=nameText;label.append(dot,name,stem);
      label.addEventListener('click',e=>{
        e.stopPropagation();
        if(!unit&&key!=='it'&&key===selected&&typeof options.onInspect==='function')options.onInspect(key);
        else if(unit&&key==='rack'&&model.plan.dims[openIndex].rackType)handleHit('rack:'+model.plan.dims[openIndex].rackType);
        else handleHit(key);
      });
      wrapper.append(label);labels[key]=label;
    }
    function positionLabels(){
      if(layoutView)layoutLabels();
      if(rackView.rig){
        for(const l of Object.values(labels))l.style.display='none';
        hallInfo.hidden=true;hallInfo.style.display='none';
        rackView.positionTags(cam,projectPoint);return;
      }
      hallInfo.hidden=false;hallInfo.style.display='flex';
      const h=model.plan.dims[openIndex],cutaway=mode==='cutaway',used=[];
      for(const key of labelKeys){
        const lab=labels[key],unit=Boolean(equipmentTitles[key]),anchor=unit?h.points[key]:model.anchors[key];
        const baseKey=focusKey?.startsWith('rack:')?'rack':focusKey,focused=unit&&baseKey===key;
        const filtered=unit&&((channelMembers[circuit]&&!channelMembers[circuit].includes(key))||(!channelMembers[circuit]&&advanced.has(key)&&!focused));
        if(!anchor||unit!==cutaway||(unit&&cam.cut<.48)||(filtered&&!focused)||(focusKey&&!focused&&unit)){lab.style.display='none';continue;}
        const p=projectPoint(focused?aim.slice(0,3):anchor,cam),active=focused||key===selected,short=cam.width<480;
        if((layoutView&&key==='it')||p[0]<6||p[0]>cam.width-6||p[1]<15||p[1]>cam.height-12){lab.style.display='none';continue;}
        const arch=project.config?.architecture;
        const ac=project.config?.architecture==='交流 UPS'||!project.config?.architecture;
        const name=key==='rowdist'?(ac?'交流列头柜':'直流列端配电柜'):key==='pdu'?(ac?'A/B 分支 · PDU':'直流母线分支'):
          key==='psu'?(ac?'柜端 PSU':'柜端电源转换'):key==='network'?'ToR 交换机':key==='fan'?'EC 风扇':
          key==='hvdc'?'集中式 HVDC':key==='transformer'?(arch==='SST 800V 直流'?'辅助变压器':'变压器'):key==='air'&&project.config?.cooling==='冷板液冷'?'辅助风冷':
          key==='rack'&&h.rackType?rackTypes[h.rackType][0]+' 机柜':
          unit?equipmentTitles[key]:key==='it'?'数据机房 ›':active?'查看设备 ›':zoneNames[key];
        if(lab.children[1].textContent!==name)lab.children[1].textContent=name;
        const width=Math.max(47,name.length*8+17),dx=short?25:39;
        let pos=null,best=Infinity;
        for(const [ox,oy] of [[0,-14],[-dx,-19],[dx,-19],[0,29],[-dx,29],[dx,29],[-dx*1.6,-35],[dx*1.6,-35],[0,-52]]){
          const x=clamp(p[0]+ox,width/2+3,cam.width-width/2-3),y=clamp(p[1]+oy,21,cam.height-30);
          const overlap=used.filter(a=>Math.abs(a.x-x)<(a.w+width)/2+4&&Math.abs(a.y-y)<21).length;
          if(overlap<best){pos={x,y,w:width};best=overlap;}if(best===0)break;
        }
        used.push(pos);lab.style.display='flex';lab.style.left=pos.x+'px';lab.style.top=pos.y+'px';
        const lx=p[0]-pos.x,ly=p[1]-pos.y,stem=lab.children[2];
        stem.style.height=Math.hypot(lx,ly)+'px';stem.style.transform='rotate('+(-Math.atan2(lx,ly))+'rad)';
        lab.style.borderColor=active?(labelColors[key]||'#97e3d1'):'rgba(170,206,210,.39)';
        lab.setAttribute('aria-label',key==='it'?'打开机房剖视':'查看'+name.replace(' ›',''));lab.setAttribute('aria-pressed',String(active));
      }
      info();
    }
    function rebuild(){
      const c=project.config||{};
      const sig=JSON.stringify([c.it,c.pue,c.density,c.cooling,c.architecture,metrics.facility,metrics.racks,metrics.layout,project.rackMix,project.rackStudy,project.id]);
      if(sig!==signature||!model){
        rackView.clear();signature=sig;model=buildCampus(project,metrics);renderer.upload(model);
        openIndex=clamp(openIndex,0,model.plan.dims.length-1);
        hallMenu.replaceChildren(...model.plan.dims.map((h,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent='第 '+format(h.index+1)+' 间';return o;}));
        hallPins.forEach(b=>b.remove());hallPins.length=0;
        model.plan.dims.forEach((h,i)=>{
          const b=document.createElement('button');b.type='button';b.className='tw-layout-hall';b.hidden=true;
          b.setAttribute('aria-label','进入第 '+(h.index+1)+' 间机房');b.onclick=()=>openHall(i);
          wrapper.append(b);hallPins.push(b);
        });
        if(layoutView)fitLayout();else if(mode==='cutaway'||selected)focus(selected,true);
      }
      dirty=false;if(queuedRack){const req=queuedRack;queuedRack=null;openRack(req.slot,req.index);}
      if(restorePending){const saved=restorePending;restorePending=null;restoreViewState(saved);}
      if(pendingMove)startPendingMove();
    }
    const approach=(value,target,t)=>Math.abs(target-value)<.00037?target:value+(target-value)*t;
    function draw(now){
      scheduled=0;if(disposed||document.hidden||!inViewport)return;
      const width=wrapper.clientWidth,height=wrapper.clientHeight;if(width<=1||height<=1)return;
      if(dirty)rebuild();
      const cpu=wrapper.dataset.engine==='canvas',dt=prev?Math.max(0,Math.min(.12,(now-prev)*.001)):.016;prev=now;
      const reduce=media.matches,t=reduce?1:1-Math.exp(-dt*10.8),snap=reduce||!playing;
      let cutting=false;
      for(let i=0;i<cuts.length;i++){
        const target=i===openIndex?cutTarget:0,diff=target-cuts[i];
        if(Math.abs(diff)>.0001)cuts[i]=snap?target:cuts[i]+Math.sign(diff)*Math.min(Math.abs(diff),dt/.98);
        if(Math.abs(target-cuts[i])>.0001)cutting=true;
      }
      cut=cuts[openIndex];
      const rackMoving=rackView.tick(dt,reduce,now);
      let arrived=null;
      const tourPose=tourCamera.tick(now);
      if(tourPose){
        wanted=tourPose;({yaw,pitch,zoom,fx,fy,fz}=tourPose);
      }else if(travel){
        const progress=travel.ms?clamp((now-travel.at)/travel.ms,0,1):1,blend=eased(progress);
        const move=k=>travel.start[k]+(travel.dest[k]-travel.start[k])*blend;
        yaw=move('yaw');pitch=move('pitch');fx=move('fx');fy=move('fy');fz=move('fz');
        const arc=(travel.arc||0)*Math.sin(Math.PI*blend);
        zoom=Math.exp(Math.log(travel.start.zoom)*(1-blend)+Math.log(travel.dest.zoom)*blend)*(1-arc);pitch+=arc*.13;
        if(progress>=1){({yaw,pitch,zoom,fx,fy,fz}=travel.dest);arrived=travel;travel=null;}
      }else{
        yaw=approach(yaw,wanted.yaw,t);pitch=approach(pitch,wanted.pitch,t);zoom=approach(zoom,wanted.zoom,t);fx=approach(fx,wanted.fx,t);fy=approach(fy,wanted.fy,t);fz=approach(fz,wanted.fz,t);
      }
      for(let i=0;i<3;i++)highlight[i]=approach(highlight[i],selected===zones[i+1]?1:0,reduce?1:t);
      const raw=Number(project.config?.load??80),load=Number.isFinite(raw)?clamp(raw/100,0,1):0;
      const moving=playing&&!reduce&&load>0;if(moving)activeTime=(activeTime+dt*(.23+.94*load))%86400;
      const dpr=Math.min(2,window.devicePixelRatio||1);
      for(const c of [ground,scene]){
        const r=c!==scene?dpr:cpu?Math.min(1.15,dpr):Math.max(1.25,dpr);
        const w=Math.round(width*r),h=Math.round(height*r);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
      }
      const ca=Math.cos(yaw),sa=Math.sin(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
      const scale=Math.min(width/190,height/Math.max(107,15+165*sp))*zoom;
      cam={width,height,cx:width*.5-(fx*ca-fy*sa)*scale,cy:height*.535-((fx*sa+fy*ca)*sp-fz*cp)*scale,scale,ca,sa,sp,cp,cut,time:activeTime,load,highlight,cuts,aim,rig:rackView.rig,circuit:circuitIds[circuit],observing:!focusKey?0:focusKey==='liquid'?2:focusKey==='air'||focusKey==='fan'?3:focusKey==='network'?4:focusKey.startsWith('sub-')||focusKey.startsWith('rack')?5:1};
      const bgKey=[width,height,scale.toFixed(4),yaw.toFixed(4),pitch.toFixed(4),cam.cx.toFixed(2),cam.cy.toFixed(2)].join(',');
      if(bgKey!==groundKey){drawGround(ground,cam);groundKey=bgKey;}
      renderer.draw(cam,selected);
      tourCamera.draw(cam,projectPoint);
      const r=rackView.rig,projectionKey=[bgKey,mode,openIndex,signature,focusSignature,selected,r?.rackIndex,r?.selectedId,r?.extraction].join('|');
      const labelKey=[projectionKey,circuit,cut<.48,rackRevision].join('|');
      if(labelKey!==labelSignature){labelSignature=labelKey;positionLabels();}
      if(options.onProjectionChange&&projectionKey!==projectionSignature){projectionSignature=projectionKey;options.onProjectionChange();}
      if(arrived)arrived.resolve(true);
      const transit=tourCamera.moving||rackMoving||Boolean(travel)||cutting||yaw!==wanted.yaw||pitch!==wanted.pitch||zoom!==wanted.zoom||fx!==wanted.fx||fy!==wanted.fy||fz!==wanted.fz||highlight.some((v,i)=>v!==(zones[i+1]===selected?1:0));
      if(transit||moving){
        const fps=cpu?(transit?19:10):(transit?60:30),delay=1000/fps-(performance.now()-now);
        if(delay>15)delayed=setTimeout(()=>{delayed=0;requestDraw();},delay-5);else requestDraw();
      }else prev=0;
    }
    function requestDraw(){if(!disposed&&!scheduled&&!document.hidden&&inViewport){if(delayed){clearTimeout(delayed);delayed=0;}scheduled=requestAnimationFrame(draw);}}
    function zoomBy(factor){if(Number.isFinite(factor)&&factor>0){cancelTravel();rackView.cancelTour();wanted.zoom=clamp(wanted.zoom*factor,.52,rackView.rig?320:focusKey?150:24);requestDraw();}}
    function reset(){if(layoutView){setLayoutView(false);return;}if(rackView.rig){rackView.leave();return;}focus(null);requestDraw();}
    const pointers=new Map();let gesture=null,dragged=false;
    function startGesture(){
      const pts=Array.from(pointers.values());
      gesture={x:pts[0].x,y:pts[0].y,yaw:wanted.yaw,pitch:wanted.pitch,zoom:wanted.zoom,span:pts[1]?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0};
    }
    wrapper.addEventListener('pointerdown',e=>{
      if(e.target.closest('button,select')||e.button!==0)return;
      cancelTravel();rackView.cancelTour();if(!pointers.size)dragged=false;else dragged=true;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});wrapper.setPointerCapture(e.pointerId);
      wrapper.style.cursor='grabbing';startGesture();
    });
    wrapper.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId)||!gesture)return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=Array.from(pointers.values());
      if(pts[1]&&gesture.span>0){wanted.zoom=clamp(gesture.zoom*Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/gesture.span,.52,rackView.rig?320:focusKey?150:24);requestDraw();return;}
      const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
      if(Math.abs(dx)+Math.abs(dy)>3)dragged=true;
      if(dragged){if(layoutView)setLayoutView(false);wanted.yaw=gesture.yaw+dx*.008;wanted.pitch=clamp(gesture.pitch+dy*.006,.24,1.18);requestDraw();}
    });
    function pointerEnd(e,cancel){
      if(!pointers.has(e.pointerId))return;
      pointers.delete(e.pointerId);
      if(pointers.size){dragged=true;startGesture();return;}
      wrapper.style.cursor='grab';gesture=null;
      if(!cancel&&!dragged&&cam){
        const bounds=wrapper.getBoundingClientRect(),key=renderer.pick(e.clientX-bounds.left,e.clientY-bounds.top,cam,selected);
        handleHit(key);
      }
    }
    wrapper.addEventListener('pointerup',e=>pointerEnd(e,false));wrapper.addEventListener('pointercancel',e=>pointerEnd(e,true));
    wrapper.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-clamp(e.deltaY,-180,180)*.00165));},{passive:false});
    wrapper.addEventListener('keydown',e=>{
      if(e.target.closest('button,select'))return;
      if(layoutView&&e.key.startsWith('Arrow'))setLayoutView(false);
      switch(e.key){case 'Escape':if(!rackView.rig)return;rackView.leave();break;case 'ArrowLeft':wanted.yaw-=.10;break;case 'ArrowRight':wanted.yaw+=.10;break;case 'ArrowUp':wanted.pitch=clamp(wanted.pitch+.075,.24,1.18);break;case 'ArrowDown':wanted.pitch=clamp(wanted.pitch-.075,.24,1.18);break;case '+':case '=':zoomBy(1.15);break;case '-':zoomBy(1/1.15);break;case 'Home':reset();break;default:return;}
      e.preventDefault();requestDraw();
    });
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(layoutView)fitLayout();requestDraw();}):null;
    if(observer)observer.observe(wrapper);else window.addEventListener('resize',requestDraw);
    const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      inViewport=entries[0].isIntersecting;if(inViewport){prev=0;requestDraw();}else cancelTravel();
    }):null;intersection?.observe(wrapper);
    function motionChanged(){if(media.matches)playing=false;prev=0;requestDraw();}
    function visibilityChanged(){prev=0;if(!document.hidden)requestDraw();else cancelTravel();}
    media.addEventListener?.('change',motionChanged);document.addEventListener('visibilitychange',visibilityChanged);
    requestDraw();
    return {update(data={}){project=data.project||{};metrics=data.metrics||{};dirty=true;requestDraw();},
      setMode(value){if((value==='cutaway'||value==='campus')&&mode!==value){if(layoutView)setLayoutView(false);rackView.clear();queuedRack=null;mode=value;cutTarget=value==='cutaway'?1:0;focus(selected);requestDraw();}},
      setLayoutView,
      setPlaying(value){const next=Boolean(value);if(next!==playing){playing=next;prev=0;requestDraw();}},
      setCircuit(key){if(Object.hasOwn(circuitIds,key)&&key!==circuit){clearEquipmentFocus();rackView.clear();circuit=key;requestDraw();}},
      openRack,closeRack:rackView.leave,selectRackSlot:rackView.selectSlot,toggleRackView:rackView.toggleView,
      toggleRackDoor:rackView.toggleDoor,toggleRackExtract:rackView.toggleExtract,focusRackStep:rackView.focusStep,
      focusEquipment,moveToEquipment,getEquipmentProjection,clearEquipmentFocus,getViewState,restoreViewState,
      preparePowerTour,followPowerTour,inspectTourLoad,haltPowerTour(clear=false){tourCamera.halt(clear);},
      setSelected(key){select(key,false);},zoomBy,reset,resize:requestDraw,
      destroy(){disposed=true;tourCamera.destroy();cancelPendingMove();rackView.clear();cancelTravel();clearTimeout(delayed);intersection?.disconnect();media.removeEventListener?.('change',motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);if(observer)observer.disconnect();else window.removeEventListener('resize',requestDraw);cancelAnimationFrame(scheduled);renderer.dispose();wrapper.remove();}};
  }
  window.GridCampus=Object.freeze({mount,coolingUnitCount});
})();
