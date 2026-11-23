/* Engineering scene, authored in local schematic coordinates. Logical components represent the scheme. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const zones = ['none', 'it', 'cooling', 'power'];
  const zoneNames = {it:'数据机房', cooling:'冷却机组', power:'供配电区'};
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
    const progress=clamp((cut-hall*.039)/.875,0,1);
    return {clip:24.3-57*interval(.19,.965,progress),lift:part===2?8.8*interval(0,.42,progress)*(1-.22*interval(.66,1,progress)):0};
  }

  function meshBuilder() {
    const buffer = [], faces = [];
    let group=0,part=0,hall=0,pivot=null;
    function face(points,hex,lit=true) {
      const normal = normalized(cross(difference(points[1],points[0]),difference(points[2],points[0])));
      const mat=pivot?6:coating.get(hex)||0, albedo=color(hex);
      const diffuse=Math.max(0,normal[0]*sun[0]+normal[1]*sun[1]+normal[2]*sun[2]);
      const lum=.53+diffuse*.46+Math.max(0,normal[2])*.12;
      const rgb=albedo.map((v,i)=>clamp(v*lum+[.004,.012,.027][i],0,1));
      for(let k=1;k<points.length-1;k++)for(const p of [points[0],points[k],points[k+1]]){
        buffer.push(...p,...albedo,...normal,group,part+hall*.1,mat,...(pivot||[0,0]));
      }
      faces.push({points,rgb,group,normal,part,hall,mat,pivot});
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
    return {buffer,faces,face,polygon,rect,box,prism,beam,cylinder,circle,shadow,group:key=>{group=zones.indexOf(key);},part:(type,n=0)=>{part=type;hall=n;},rotor:(p)=>{pivot=p;}};
  }

  function buildCampus(project={},metrics={}){
    const config=project.config||{},it=Number(config.it)||100,pue=Number(config.pue)||1.25, density=Number(config.density)||50;
    const halls=clamp(Math.ceil(it/40),1,4), baseHeight=8.8+Math.min(2,Math.log10(it+1)*.66);
    const m=meshBuilder(),{box,prism,rect,polygon,shadow,beam,cylinder,circle,face}=m;
    const site=[[-75,-42],[-72,-45],[71,-45],[75,-41],[75,42],[71,46],[-72,46],[-75,42]];
    const anchors={},routes=[];
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
    rect(-69,32,138,4,.1,'#45545d');
    for(let i=-66;i<65;i+=6) {
      rect(i,33.92,2.8,.16,.13,'#a8b4b5');
      rect(i,-39.6,2.8,.15,.13,'#a8b4b5');
    }
    for(let y=-36;y<32;y+=6){rect(67.2,y,.14,2.6,.13,'#a8b4b5');rect(-68.1,y,.14,2.6,.13,'#a8b4b5');}
    for(let x=-66;x<60;x+=10){box(x,42.1,.07,8.4,1,.25,'#6a797c','#849894');}
    const clipped=(x,y,w,d,c=.55)=>[[x+c,y],[x+w-c,y],[x+w,y+c],[x+w,y+d-c],[x+w-c,y+d],[x+c,y+d],[x,y+d-c],[x,y+c]];
    // Pedestrian and perimeter details provide an architectural scale reference.
    let prng=27;
    const random=()=>((prng=(prng*1664525+1013904223)>>>0)/4294967296);
    function tree(x,y,scale=1){
      const h=(3.6+random()*1.3)*scale,r=(1.25+random()*.46)*scale;
      polygon(circle(x+.65,y+.42,r*1.16,9),.16,'#536766');
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
    for(let x=-63;x<=65;x+=7.1)tree(x,39.4,.87+random()*.2);
    for(let x=-61;x<65;x+=9)tree(x,-42.3,.74);
    for(let y=-29;y<=26;y+=9)tree(-72.25,y,.84);
    function fence(x1,y1,x2,y2,count){
      for(let i=0;i<=count;i++){const t=i/count;box(x1+(x2-x1)*t-.075,y1+(y2-y1)*t-.075,.12,.15,.15,1.65,'#96a5a7');}
      for(const h of [.82,1.7])beam([x1,y1,h],[x2,y2,h],.055,'#809298',4);
    }
    fence(-72,-42,72,-42,38);fence(72,-42,72,42,21);fence(-72,-42,-72,41,21);fence(-71,43,15,43,23);fence(24,43,70,43,12);
    for(let x=17;x<24;x+=.85)rect(x,32.3,.38,3.3,.16,'#bfc7c1');
    box(23.4,37.8,.12,3.9,2.8,2.45,'#aab9c0','#cfdbd9');box(23.4,40.59,1.15,3.9,.09,1.0,'#395661');box(23.1,37.5,2.55,4.5,3.35,.2,'#b2c5c8','#dfeded');
    for(let x=-61;x<65;x+=20){
      cylinder(x,36.6,.13,.16,4.9,'#657a80','#a6b2ae',6);beam([x,36.6,4.9],[x,35,5.36],.12,'#9aacac');
      box(x-.22,34.65,5.22,.44,.9,.16,'#495c67','#c4d0c9');rect(x-.17,34.7,.34,.75,5.23,'#ffe3a3');
    }
    for(let j=0;j<8;j++){const px=-61+j*3.9;rect(px,28.1,.14,3.0,.13,'#a7b2aa');}
    for(const [px,py,tone] of [[-56,28.3,'#c8d1cd'],[-42,28.3,'#6d8994'],[34,36.4,'#c4cdc8']]){
      box(px,py,.18,1.72,3.5,.57,'#546674',tone);box(px+.16,py+.6,.74,1.39,1.92,.46,'#4a6a79',tone);
      box(px-.05,py+.35,.17,.17,.62,.34,'#33444a');box(px-.05,py+2.54,.17,.17,.62,.34,'#33444a');
    }
    // Three parallel hall blocks in the reference scheme. Visible halls are capacity bands, not a construction schedule.
    m.group('it');
    const pad=1.1,start=-62,total=79,gap=3.3,w=(total-(halls-1)*gap)/halls, y=-31,d=54;
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
      const x=start+b*(w+gap), floor=.86,height=baseHeight+[1.65,-.25,.8,0][b];
      m.part(0,b);
      shadow(x-.4,y-.4,w+.8,d+.8,height,.42,'#687a7f');
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
      {
        m.part(3,b);
        rect(x+.26,y+.26,w-.52,d-.52,floor+.94,'#607a89');
        box(x,y,floor+.9,w,.45,2.7,'#98aeb8','#d5e1e2');box(x,y+d-.35,floor+.9,w,.35,.72,'#97acb8','#cfdfdf');
        for(const xx of [x,x+w-.28])box(xx,y+.35,floor+.9,.28,d-.72,1.5,'#93aab7','#cedbdd');
        const lanes=clamp(Math.round(w/4),3,7), rackCount=clamp(Math.round(16-Math.log2(density/25)*2),7,18);
        const rowD=(d-5)/rackCount, laneW=(w-3.4)/lanes, rackW=Math.min(laneW*.60,2.8);
        for(let q=0;q<lanes;q++){
          const xx=x+1.7+q*laneW;
          if(q%2===0)rect(xx-.60,y+1.1,.22,d-2.2,floor+.97,'#4ca4a8');
          for(let j=0;j<rackCount;j++){
            const yy=y+2.5+j*rowD;
            m.part(4,b);
            box(xx,yy,floor+.96,rackW,rowD-.34,3.15,'#2e4959','#6c858e');
            box(xx+.15,yy-.02,floor+2.98,rackW-.3,.09,.12,'#63c4c5');
            rect(xx+.25,yy+.23,rackW-.5,rowD-.8,floor+4.12,'#304b57');
            rect(xx+.22,yy+.14,rackW*.55,.16,floor+4.14,'#78d9cd');
            for(let v=0;v<3;v++)rect(xx+.36,yy+.58+v*.50,rackW-.72,.13,floor+4.14,'#71878b');
          }
        }
        m.part(3,b);
        // Service ladders, rack branches and overhead ducts follow the selected cooling system.
        const liquid=config.cooling==='冷板液冷',hybrid=config.cooling!=='风冷'&&!liquid;
        for(let q=0;q<lanes;q++){
          const xx=x+1.7+(q+1)*laneW-.78,hasWater=liquid||(hybrid&&q%2===0);
          if(hasWater){
            for(const [k,tone] of ['#4d989e','#ab9271'].entries()){
              const px=xx+k*.25;
              beam([px,y+2.1,floor+4.85],[px,y+d-2.0,floor+4.85],.13,tone,6);
              for(let j=0;j<4;j++){
                const yy=y+4.9+j*(d-11)/3;
                beam([px,yy,floor+4.85],[px-.31,yy,floor+4.25],.08,tone,5);
              }
            }
          }else{
            box(xx-.33,y+2.7,floor+4.85,.73,d-5.4,.50,'#869ba3','#bbc4bf');
            for(let yy=y+4;yy<y+d-4;yy+=5.1)box(xx-.45,yy,floor+4.60,.96,.95,.25,'#71878c','#b7c6c7');
          }
        }
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
    m.part(0);
    anchors.it=[start+w*.54,-10,baseHeight+3];
    // Plant yard: fan openings, service panels, piping, physically separate from the hall roofs.
    m.group('cooling');
    const chillCount=clamp(Math.round(3+Math.log2((it*pue)/40)),2,7);
    const chW=29/chillCount-1.1,chD=10.7;
    for(let r=0;r<2;r++)for(let j=0;j<chillCount;j++){
      const x=29+j*(chW+1.1),y=-33+r*13;
      shadow(x,y,chW,chD,3.2,.42,'#687c81');
      box(x-.2,y-.2,.43,chW+.4,chD+.4,.48,'#74848a','#a8b7b8');
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
    for(const [i,col] of ['#789c9c','#c79e70'].entries()){
      beam([30,-5.5+i,1.05],[60,-5.5+i,1.05],.31,col,8);
      beam([60,-5.5+i,1.05],[60,-32,1.05],.31,col,8);
    }
    if(config.cooling==='风冷')for(let j=0;j<2;j++)box(59,-29+j*7,.45,2.8,5.3,3.0,'#879ba6','#bbcacb');
    if(config.cooling==='冷板液冷')for(let j=0;j<3;j++)cylinder(60,-30+j*6,1,1.65,3.9,'#7b9ca5','#bfcecf',16);
    anchors.cooling=[44,-20,5.0];
    // Switchyard transformers: radiator fins, three bushings, a small switch house and cable galleries.
    m.group('power');
    box(29,2.6,.41,33,24,.27,'#7c898d','#8e9b9e');
    const tfCount=clamp(Math.round(2+Math.log2((Number(metrics.facility)||it*pue)/80)),2,4);
    for(let j=0;j<tfCount;j++){
      const tx=30.7+j*(20.8/tfCount),ty=13.5,tw=20.8/tfCount-1.7;
      shadow(tx-.2,ty,tw+.4,8.4,4,.70,'#697a81');
      box(tx-.15,ty-.2,.72,tw+.3,8.4,.34,'#79888b','#acbab8');
      box(tx+.35,ty+.2,1.06,tw-.7,7.6,3.1,'#72909a','#a5b9be');
      for(let k=0;k<8;k++){const yy=ty+.48+k*.91;box(tx,yy,1.52,tw,.23,2.55,'#8fa6ad','#b3c5c4');}
      for(let k=0;k<3;k++){const xx=tx+tw*(k+.5)/3;
        cylinder(xx,ty+3.6,4.2,.24,2.1,'#716e68','#aba9a1',8);
        for(let ring=0;ring<4;ring++)cylinder(xx,ty+3.6,4.5+ring*.43,.41,.15,'#9a9389','#c5bdb0',9);
      }
    }
    const ac=config.architecture!=='800V 直流';
    box(53.8,11.1,.72,7.1,12.8,ac?4.0:5.3,'#96aab2','#c9d3d4');
    box(53.8,23.86,3.1,7.1,.16,.44,'#719dc3','#a1bcd2');
    for(let j=0;j<6;j++)box(53.75,12.1+j*1.85,1.4,.13,1.15,2.3,'#617883');
    // Low overhead busbars and supporting lattice portals.
    for(let p=0;p<3;p++){
      const xx=31+p*12;
      for(const yy of [4.8,9.3]){
        for(const off of [-.55,.55])beam([xx+off,yy,0.75],[xx+off*.6,yy,7.5],.13,'#99aaac',4);
        for(let h=1.2;h<7;h+=1.1)beam([xx-.48,yy,h],[xx+.46,yy,h+1.1],.072,'#a3b4b5',4);
      }
      beam([xx,4.6,7.5],[xx,9.5,7.5],.15,'#bdc9c8',5);
    }
    for(let k=0;k<3;k++)beam([31,5+k*1.8,7.34],[55,5+k*1.8,7.34],.09,'#bdc9c8',5);
    // Illuminated service corridors illustrate flow within the project boundary.
    // These are conceptual routes, with direction and motion driven by scenario load.
    const circuits=[
      {points:[[42,23.2],[42,29.4],[7,29.4],[7,24.2]],tone:'#4c8a87',glow:'#86efe0'},
      {points:[[44,-6],[23,-6],[23,25.9],[-46,25.9],[-46,23.4]],tone:'#948263',glow:'#ffd38b'}
    ];
    for(const route of circuits){
      m.group('none');
      const points=route.points.map(([x,y])=>[x,y,.75]);
      for(let j=1;j<points.length;j++){
        const a=points[j-1],b=points[j],v=difference(b,a),length=Math.hypot(...v),n=Math.ceil(length/2.0);
        for(let k=0;k<n;k++)beam(along(a,v,k/n),along(a,v,(k+1)/n),.28,route.tone,5);
      }
      routes.push({points,color:route.glow});
    }
    anchors.power=[46,15,6.6];
    return {vertices:new Float32Array(m.buffer),faces:m.faces,anchors,routes};
  }

  const pitch0=.565,yaw0=-.61;
  function projectPoint(p,cam) {
    const u=p[0]*cam.ca-p[1]*cam.sa,v=p[0]*cam.sa+p[1]*cam.ca;
    return [cam.cx+u*cam.scale,cam.cy+(v*cam.sp-p[2]*cam.cp)*cam.scale,v*cam.cp+p[2]*cam.sp];
  }
  function webRenderer(canvas) {
    const gl=canvas.getContext('webgl',{alpha:true,antialias:true,depth:true,preserveDrawingBuffer:false,premultipliedAlpha:true});
    if(!gl)return null;
    const vertex=`
      attribute vec3 aPos,aColor,aNormal,aMeta;
      attribute vec2 aPivot;
      uniform vec4 uView,uScreen;
      uniform float uCut,uTime,uPass;
      varying vec3 vColor,vWorld,vNormal,vTag;
      varying float vGate;
      const vec3 light=normalize(vec3(-.56,-.64,.78));
      vec3 sunlight(vec3 p){vec3 right=normalize(vec3(.64,-.56,0.));return vec3(dot(p,right)/95.,dot(p,cross(light,right))/86.,-dot(p,light)/116.);}
      void main(){
        float part=floor(aMeta.y+.001),hall=fract(aMeta.y+.001)*10.;
        float phase=clamp((uCut-hall*.039)/.875,0.,1.);
        vec3 p=aPos;
        if(aMeta.z>5.5&&aMeta.z<6.5){
          float angle=uTime*3.35+dot(aPivot,vec2(.2,.14));vec2 q=p.xy-aPivot;
          p.xy=aPivot+vec2(cos(angle)*q.x-sin(angle)*q.y,sin(angle)*q.x+cos(angle)*q.y);
        }
        if(part==2.)p.z+=8.8*smoothstep(0.,.42,phase)*(1.-.22*smoothstep(.66,1.,phase));
        vColor=aColor;vWorld=p;vNormal=aNormal;vTag=vec3(aMeta.x,part,aMeta.z);
        vGate=24.3-57.*smoothstep(.19,.965,phase);
        if(uPass==1.)gl_Position=vec4(sunlight(p),1.);
        else{
          float x=p.x*uView.x-p.y*uView.y,d=p.x*uView.y+p.y*uView.x,y=d*uView.z-p.z*uView.w;
          gl_Position=vec4(x*uScreen.x+uScreen.z,-y*uScreen.y+uScreen.w,-(d*uView.w+p.z*uView.z)/360.,1.);
        }
        if((part>=3.&&uCut<.002)||(part>=1.&&part<=2.&&phase>.999))gl_Position=vec4(4.,4.,4.,1.);
      }`;
    const fragment=`
      precision highp float;
      varying vec3 vColor,vWorld,vNormal,vTag;
      varying float vGate;
      uniform float uPass,uCut,uTime,uLoad,uShadowScale;
      uniform vec3 uSelection;
      uniform vec4 uView;
      uniform sampler2D uShadow;
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
        if(part>=1.&&part<=2.&&vWorld.y>vGate)discard;
        if(uPass==1.){vec2 enc=fract(gl_FragCoord.z*vec2(1.,255.));enc.x-=enc.y/255.;gl_FragColor=vec4(enc,0.,1.);return;}
        if(uPass==2.){gl_FragColor=vec4((part==4.?4.:vTag.x)/255.,0.,0.,1.);return;}
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
          vec2 p=vWorld.xy;
          float along=mat==9.?(p.x>41.65?p.y-23.2:p.x<7.35?41.2+29.4-p.y:6.2+42.-p.x):(p.x>23.35&&p.y < -5.65?44.-p.x:p.x>22.65?21.+p.y+6.:p.x > -45.65?52.9+23.-p.x:121.9+25.9-p.y);
          float bulb=pow(max(cos((along-uTime*8.)*.34),0.),8.);
          vec3 ec=mat==9.?vec3(.48,.99,.88):vec3(.99,.73,.42);
          col=mix(col,ec,(.15+.85*bulb)*step(.001,uLoad));
        }
        if(part>=1.&&part<=2.&&uCut>.18&&uCut<.96){
          float rim=1.-smoothstep(.06,.35,abs(vGate-vWorld.y));col=mix(col,vec3(.54,.92,.87),rim*.8);
        }
        float selected=vTag.x<.5?0.:vTag.x<1.5?uSelection.x:vTag.x<2.5?uSelection.y:uSelection.z;
        vec3 accent=vTag.x<1.5?vec3(.16,.68,.67):vTag.x<2.5?vec3(.93,.56,.24):vec3(.33,.58,.91);
        col=col*(1.+selected*.04)+accent*selected*(.034+.095*fres);
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
    const vb=gl.createBuffer(),U={};
    for(const n of ['View','Screen','Cut','Time','Pass','Load','ShadowScale','Selection','Shadow'])U[n]=gl.getUniformLocation(prog,'u'+n);
    const attrs=[['aPos',3,0],['aColor',3,12],['aNormal',3,24],['aMeta',3,36],['aPivot',2,48]].map(([n,k,off])=>[gl.getAttribLocation(prog,n),k,off]);
    const shadowSize=Math.min(1536,gl.getParameter(gl.MAX_TEXTURE_SIZE));
    function texture(size,data){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,data);return t;
    }
    const fallback=texture(1,new Uint8Array([255,255,255,255])),shadow=texture(shadowSize,null);
    const fb=gl.createFramebuffer(),rb=gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,shadowSize,shadowSize);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,shadow,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
    const hasShadow=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    let count=0,lastShadow=-10;
    function draw(cam,selected,pick=false){
      gl.useProgram(prog);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.DITHER);gl.disable(gl.BLEND);
      for(const [a,n,o] of attrs){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,56,o);}
      gl.uniform4f(U.View,cam.ca,cam.sa,cam.sp,cam.cp);
      gl.uniform4f(U.Screen,2*cam.scale/cam.width,2*cam.scale/cam.height,2*cam.cx/cam.width-1,1-2*cam.cy/cam.height);
      gl.uniform1f(U.Cut,cam.cut);gl.uniform1f(U.Time,cam.time);gl.uniform1f(U.Load,cam.load);gl.uniform3fv(U.Selection,cam.highlight);
      gl.uniform1i(U.Shadow,0);gl.uniform1f(U.ShadowScale,1.15/shadowSize);gl.activeTexture(gl.TEXTURE0);
      const shadowStep=Math.round(cam.cut*28);
      if(hasShadow&&shadowStep!==lastShadow){
        gl.bindTexture(gl.TEXTURE_2D,fallback);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,shadowSize,shadowSize);
        gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(U.Pass,1);gl.drawArrays(gl.TRIANGLES,0,count);gl.bindFramebuffer(gl.FRAMEBUFFER,null);lastShadow=shadowStep;
      }
      gl.bindTexture(gl.TEXTURE_2D,hasShadow?shadow:fallback);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(U.Pass,pick?2:0);gl.drawArrays(gl.TRIANGLES,0,count);
    }
    return {draw,upload(model){gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,model.vertices,gl.STATIC_DRAW);count=model.vertices.length/14;lastShadow=-10;},
      pick(x,y,cam,selected){draw(cam,selected,true);const pix=new Uint8Array(4);gl.readPixels(clamp(Math.floor(x*canvas.width/cam.width),0,canvas.width-1),clamp(canvas.height-1-Math.floor(y*canvas.height/cam.height),0,canvas.height-1),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pix);draw(cam,selected);return pix[0]===4?'rack':zones[pix[0]]||null;},
      dispose(){gl.deleteFramebuffer(fb);gl.deleteRenderbuffer(rb);gl.deleteTexture(shadow);gl.deleteTexture(fallback);gl.deleteBuffer(vb);for(const shader of shaders)gl.deleteShader(shader);gl.deleteProgram(prog);gl.getExtension('WEBGL_lose_context')?.loseContext();}};
  }
  // The CPU renderer uses the same vertices, camera and per-pixel depth test.
  // Each visible pixel also records its component ID, including correct occlusion.
  function softwareRenderer(canvas){
    const ctx=canvas.getContext('2d');let model,frame,pixels,depth,ids;
    const colorWord=(rgb,active)=>{
      const channel=(i)=>Math.round(255*clamp(active?rgb[i]*.904+[.033,.126,.111][i]:rgb[i],0,1));
      return (255<<24)|(channel(2)<<16)|(channel(1)<<8)|channel(0);
    };
    function draw(cam,selected){
      const width=canvas.width,height=canvas.height,sel=zones.indexOf(selected);
      if(!frame||width!==frame.width||height!==frame.height){
        frame=ctx.createImageData(width,height);pixels=new Uint32Array(frame.data.buffer);
        depth=new Float32Array(width*height);ids=new Uint8Array(width*height);
      }
      pixels.fill(0);depth.fill(-Infinity);ids.fill(0);
      const sx=width/cam.width,sy=height/cam.height;
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
            if(z>=depth[k]-.000004){pixels[k]=ink;depth[k]=z;ids[k]=id;}
          }
        }
      }
      const phase=Array.from({length:4},(_,h)=>[cutState(1,h,cam.cut),cutState(2,h,cam.cut)]);
      for(const face of model.faces){
        const {part,hall,mat}=face,zone=face.group||0,isOuter=part===1||part===2;
        if(part>=3&&cam.cut<.002)continue;
        const cs=isOuter?phase[hall][part-1]:null;
        if(cs&&cs.clip<-32.3)continue;
        let points=face.points;
        if(cs&&cam.cut>0){
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
          let w=v;if(pt){const x=v[0]-pt[0],y=v[1]-pt[1];w=[pt[0]+csA*x-snA*y,pt[1]+snA*x+csA*y,v[2]];}
          if(cs&&cs.lift)w=[w[0],w[1],w[2]+cs.lift];
          const q=projectPoint(w,cam);q[0]*=sx;q[1]*=sy;return q;
        });
        let ink=zone>0&&cam.highlight[zone-1]>.35?face.activeInk:face.ink;
        if(mat>=9&&cam.load>0){
          const a=face.points[0],x=a[0],y=a[1],distance=mat===9?(x>41.65?y-23.2:x<7.35?41.2+29.4-y:6.2+42-x):(x>23.35&&y< -5.65?44-x:x>22.65?21+y+6:x> -45.65?52.9+23-x:121.9+25.9-y);
          if(Math.cos((distance-cam.time*8)*.34)>.67)ink=mat===9?0xffc7f6a2:0xff7bbfff;
        }
        for(let i=1;i<p.length-1;i++)triangle(p[0],p[i],p[i+1],ink,part===4?4:zone);
      }
      ctx.putImageData(frame,0,0);
    }
    return {draw,upload(m){model=m;for(const f of model.faces){f.ink=colorWord(f.rgb,false);f.activeInk=colorWord(f.rgb,true);}},
      pick(x,y,cam){const id=ids&&ids[Math.floor(y*canvas.height/cam.height)*canvas.width+Math.floor(x*canvas.width/cam.width)];return id===4?'rack':zones[id]||null;},
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
    let project={},metrics={},mode='campus',selected=null,yaw=yaw0,pitch=pitch0,zoom=1;
    let cam=null,model=null,renderer=null,signature='',scheduled=0,dirty=true,disposed=false;
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    let playing=!media.matches,cut=0,cutTarget=0,fx=0,fy=0,activeTime=0,prev=0,groundKey='',delayed=0,inViewport=true;
    let wanted={yaw,pitch,zoom,fx:0,fy:0};const highlight=[0,0,0];
    function focus(key){
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
      if(next!==selected){selected=next;focus(next);requestDraw();}
      if(notify&&next&&typeof options.onSelect==='function') options.onSelect(next);
    }
    for(const key of zones.slice(1)){
      const label=document.createElement('button');
      label.type='button';label.dataset.zone=key;label.setAttribute('aria-label','查看'+zoneNames[key]);
      label.style.cssText='position:absolute;z-index:1;transform:translate(-50%,-100%);display:flex;align-items:center;gap:5px;background:rgba(17,34,47,.90);border:1px solid rgba(170,206,210,.33);border-radius:3px;padding:3px 6px;color:#e2eded;white-space:nowrap;font:500 10px/1.2 system-ui,"PingFang SC",sans-serif;letter-spacing:.04em;cursor:pointer;box-shadow:0 2px 6px #0a192336;';
      const dot=document.createElement('i');dot.style.cssText='width:5px;height:5px;border-radius:50%;display:block;background:'+labelColors[key];
      const stem=document.createElement('i');stem.style.cssText='position:absolute;left:50%;top:100%;height:10px;border-left:1px solid '+labelColors[key]+';pointer-events:none;';
      const name=document.createElement('span');name.textContent=zoneNames[key];label.append(dot,name,stem);
      label.addEventListener('click',e=>{
        e.stopPropagation();
        if(key===selected&&typeof options.onInspect==='function'&&(key!=='it'||mode==='cutaway'))options.onInspect(key==='it'?'rack':key);
        else select(key,true);
      });
      wrapper.append(label);labels[key]=label;
    }
    function rebuild(){
      const c=project.config||{};
      const sig=JSON.stringify([c.it,c.pue,c.density,c.cooling,c.architecture,metrics.facility]);
      if(sig!==signature||!model){const first=!model;signature=sig;model=buildCampus(project,metrics);renderer.upload(model);if(first&&selected)focus(selected);}
      dirty=false;
    }
    const approach=(value,target,t)=>Math.abs(target-value)<.00037?target:value+(target-value)*t;
    function draw(now){
      scheduled=0;if(disposed||document.hidden||!inViewport)return;
      const width=wrapper.clientWidth,height=wrapper.clientHeight;if(width<=1||height<=1)return;
      if(dirty)rebuild();
      const cpu=wrapper.dataset.engine==='canvas',dt=prev?Math.max(0,Math.min(.12,(now-prev)*.001)):.016;prev=now;
      const reduce=media.matches,t=reduce?1:1-Math.exp(-dt*10.8),snap=reduce||!playing;
      const deltaCut=cutTarget-cut;if(Math.abs(deltaCut)>.0001)cut=snap?cutTarget:cut+Math.sign(deltaCut)*Math.min(Math.abs(deltaCut),dt/.98);
      yaw=approach(yaw,wanted.yaw,t);pitch=approach(pitch,wanted.pitch,t);zoom=approach(zoom,wanted.zoom,t);fx=approach(fx,wanted.fx,t);fy=approach(fy,wanted.fy,t);
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
      cam={width,height,cx:width*.5-(fx*ca-fy*sa)*scale,cy:height*.535-(fx*sa+fy*ca)*sp*scale,scale,ca,sa,sp,cp,cut,time:activeTime,load,highlight};
      const bgKey=[width,height,scale.toFixed(4),yaw.toFixed(4),pitch.toFixed(4),cam.cx.toFixed(2),cam.cy.toFixed(2)].join(',');
      if(bgKey!==groundKey){drawGround(ground,cam);groundKey=bgKey;}
      renderer.draw(cam,selected);
      for(const key of zones.slice(1)){
        const label=labels[key],anchor=model.anchors[key].slice();
        if(key==='it')anchor[2]-=5.1*cut;
        const p=projectPoint(anchor,cam),active=key===selected,inspect=active&&typeof options.onInspect==='function'&&(key!=='it'||mode==='cutaway');
        const hidden=(width<480&&key!==(selected||'it'))||p[0]<32||p[0]>width-32||p[1]<38||p[1]>height+8;
        label.style.display=hidden?'none':'flex';label.style.left=p[0]+'px';label.style.top=(p[1]-13)+'px';
        label.style.borderColor=active?labelColors[key]:'rgba(170,206,210,.33)';
        const text=inspect?(key==='it'?'查看机柜 ›':'查看设备 ›'):zoneNames[key];
        if(label.children[1].textContent!==text)label.children[1].textContent=text;
        label.setAttribute('aria-label',inspect?text.replace(' ›',''):'查看'+zoneNames[key]);label.setAttribute('aria-pressed',String(active));
      }
      const transit=Math.abs(cut-cutTarget)>.0001||yaw!==wanted.yaw||pitch!==wanted.pitch||zoom!==wanted.zoom||fx!==wanted.fx||fy!==wanted.fy||highlight.some((v,i)=>v!==(zones[i+1]===selected?1:0));
      if(transit||moving){
        const fps=cpu?(transit?19:10):(transit?60:30),delay=1000/fps-(performance.now()-now);
        if(delay>15)delayed=setTimeout(()=>{delayed=0;requestDraw();},delay-5);else requestDraw();
      }else prev=0;
    }
    function requestDraw(){if(!disposed&&!scheduled&&!document.hidden&&inViewport){if(delayed){clearTimeout(delayed);delayed=0;}scheduled=requestAnimationFrame(draw);}}
    function zoomBy(factor){if(Number.isFinite(factor)&&factor>0){wanted.zoom=clamp(wanted.zoom*factor,.52,3.5);requestDraw();}}
    function reset(){focus(null);requestDraw();}
    const pointers=new Map();let gesture=null,dragged=false;
    function startGesture(){
      const pts=Array.from(pointers.values());
      gesture={x:pts[0].x,y:pts[0].y,yaw:wanted.yaw,pitch:wanted.pitch,zoom:wanted.zoom,span:pts[1]?Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y):0};
    }
    wrapper.addEventListener('pointerdown',e=>{
      if(e.target.closest('button')||e.button!==0)return;
      if(!pointers.size)dragged=false;else dragged=true;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});wrapper.setPointerCapture(e.pointerId);
      wrapper.style.cursor='grabbing';startGesture();
    });
    wrapper.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId)||!gesture)return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const pts=Array.from(pointers.values());
      if(pts[1]&&gesture.span>0){wanted.zoom=clamp(gesture.zoom*Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)/gesture.span,.52,3.5);requestDraw();return;}
      const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
      if(Math.abs(dx)+Math.abs(dy)>3)dragged=true;
      if(dragged){wanted.yaw=gesture.yaw+dx*.008;wanted.pitch=clamp(gesture.pitch+dy*.006,.24,1.18);requestDraw();}
    });
    function pointerEnd(e,cancel){
      if(!pointers.has(e.pointerId))return;
      pointers.delete(e.pointerId);
      if(pointers.size){dragged=true;startGesture();return;}
      wrapper.style.cursor='grab';gesture=null;
      if(!cancel&&!dragged&&cam){
        const bounds=wrapper.getBoundingClientRect(),key=renderer.pick(e.clientX-bounds.left,e.clientY-bounds.top,cam,selected);
        if(key==='rack'&&mode==='cutaway'){
          if(typeof options.onInspect==='function')options.onInspect('rack');else select('it',true);
        }else if(zones.indexOf(key)>0)select(key,true);
      }
    }
    wrapper.addEventListener('pointerup',e=>pointerEnd(e,false));wrapper.addEventListener('pointercancel',e=>pointerEnd(e,true));
    wrapper.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-clamp(e.deltaY,-180,180)*.00165));},{passive:false});
    wrapper.addEventListener('keydown',e=>{
      if(e.target.closest('button'))return;
      switch(e.key){case 'ArrowLeft':wanted.yaw-=.10;break;case 'ArrowRight':wanted.yaw+=.10;break;case 'ArrowUp':wanted.pitch=clamp(wanted.pitch+.075,.24,1.18);break;case 'ArrowDown':wanted.pitch=clamp(wanted.pitch-.075,.24,1.18);break;case '+':case '=':zoomBy(1.15);break;case '-':zoomBy(1/1.15);break;case 'Home':reset();break;default:return;}
      e.preventDefault();requestDraw();
    });
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(requestDraw):null;
    if(observer)observer.observe(wrapper);else window.addEventListener('resize',requestDraw);
    const intersection=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
      inViewport=entries[0].isIntersecting;if(inViewport){prev=0;requestDraw();}
    }):null;intersection?.observe(wrapper);
    function motionChanged(){if(media.matches)playing=false;prev=0;requestDraw();}
    function visibilityChanged(){prev=0;if(!document.hidden)requestDraw();}
    media.addEventListener?.('change',motionChanged);document.addEventListener('visibilitychange',visibilityChanged);
    requestDraw();
    return {update(data={}){project=data.project||{};metrics=data.metrics||{};dirty=true;requestDraw();},
      setMode(value){if((value==='cutaway'||value==='campus')&&mode!==value){mode=value;cutTarget=value==='cutaway'?1:0;focus(selected);requestDraw();}},
      setPlaying(value){const next=Boolean(value);if(next!==playing){playing=next;prev=0;requestDraw();}},
      setSelected(key){select(key,false);},zoomBy,reset,resize:requestDraw,
      destroy(){disposed=true;clearTimeout(delayed);intersection?.disconnect();media.removeEventListener?.('change',motionChanged);document.removeEventListener('visibilitychange',visibilityChanged);if(observer)observer.disconnect();else window.removeEventListener('resize',requestDraw);cancelAnimationFrame(scheduled);renderer.dispose();wrapper.remove();}};
  }
  window.GridCampus=Object.freeze({mount});
})();
