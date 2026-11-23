/* Conceptual campus substation. Coordinates are local to the generated site. */
(() => {
  'use strict';
  function build(m,anchors,units){
    const {box,beam,cylinder,rect}=m;
    const steel='#96aab0',edge='#d2dada',dark='#465c69',concrete='#aab6b6',enamel='#4f717c',ceramic='#abc4c2',copper='#bb946a';
    const x0=29,y0=2.6,ground=.71;
    m.group('power');box(x0,y0,.41,33,24,.28,'#78878e','#9da8a8');
    // A cable trench, paving joints and equipment plinths give the yard a readable scale.
    rect(30,21.8,30,1.4,ground,'#87989d');
    for(let x=30;x<60;x+=1.65)rect(x,21.86,.042,1.26,ground+.015,'#627681');
    for(const y of [5.2,11.5,21.45])rect(29.3,y,32.1,.045,ground+.008,'#839599');
    function base(x,y,w,d){box(x,y,ground,w,d,.28,'#86969b',concrete);}
    function insulator(x,y,z,height,radius,count=4){
      cylinder(x,y,z,radius*.42,height,dark,dark,6);
      for(let i=0;i<count;i++)cylinder(x,y,z+height*(i+.45)/(count+.3),radius*(1-i*.035),height*.071,ceramic,'#c8d5cd',8);
      cylinder(x,y,z+height,radius*.51,.15,steel,edge,6);
    }
    function cable(points,r=.045,tone='#586c70'){for(let i=1;i<points.length;i++)beam(points[i-1],points[i],r,tone,5);}
    function hanging(a,b,drop,r=.055){
      const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
      const chain=[0,.25,.5,.75,1].map(t=>[a[0]+dx*t,a[1]+dy*t,a[2]+dz*t-4*drop*t*(1-t)]);
      cable(chain,r,'#687d7f');
    }
    m.group('sub-incoming');
    // Steel portal, suspended insulators and three distinct entrance terminations.
    for(const xx of [30.6,46.1]){
      base(xx-.52,4.28,1.04,1.1);
      for(const off of [-.32,.32])beam([xx+off,4.8,.99],[xx+off*.65,4.8,7.8],.105,steel,4);
      for(let z=1.1;z<7.1;z+=1.1)beam([xx-.31,4.8,z],[xx+.28,4.8,z+.99],.055,'#799298',4);
    }
    for(const z of [7.53,8.15])beam([30.4,4.8,z],[46.3,4.8,z],.095,steel,5);
    for(let x=30.7;x<45.9;x+=1.5)beam([x,4.8,7.55],[x+.77,4.8,8.13],.054,'#7c9196',4);
    for(let i=0;i<3;i++){
      const x=33.5+i*4.1;base(x-.53,7.27,1.06,1.37);cylinder(x,7.9,1.01,.15,1.75,steel,edge,6);
      insulator(x,7.9,2.75,1.53,.32);insulator(x,4.8,6.28,1.22,.25);
      hanging([x,4.8,6.3],[x,7.9,4.36],.44);
      beam([x,7.9,4.36],[x,9.3,4.7],.08,copper,6);
    }
    anchors['sub-incoming']=[37.7,7.4,4.85];
    const count=Math.max(2,Math.min(4,units)),pitch=20.9/count;
    for(let i=0;i<count;i++){
      const pick=i===0?'sub-transformer':'sub-transformer-'+(i+1);
      m.group(pick);
      const x=30.3+i*pitch,w=pitch-1.2,y=12.2,bodyY=y+.83,span=w-1.35;
      anchors[pick]=[x+w*.5,16.1,4.25];
      base(x-.12,y-.16,w+.26,8.6);
      box(x+.65,bodyY,1.18,span,5.78,3.15,enamel,'#9cb3b3');
      box(x+.56,bodyY-.11,4.30,span+.18,6.02,.16,'#667e86','#acc0bc');
      for(let k=0;k<8;k++){
        const yy=bodyY+.2+k*.71;
        for(const side of [x+.15,x+w-.66])box(side,yy,1.49,.50,.23,2.67,'#5e7882','#adc0ba');
      }
      // Oil conservator, pipework and a local indication box on the front face.
      beam([x+.77,y+6.92,4.45],[x+w-.75,y+6.92,4.45],.49,'#89a3a4',10);
      for(const side of [x+.9,x+w-.93]){beam([side,y+6.92,4.12],[side,y+6.92,3.03],.10,steel,5);beam([side,y+6.92,3.03],[side,y+6.37,3.03],.10,steel,5);}
      const bankWidth=w*.85,fanR=Math.min(.68,bankWidth*.21),front=y+6.78;
      // The front radiator bank, its fan housings and lifting eyes are visible from the operating aisle.
      for(let fin=0;fin<11;fin++){
        const xx=x+w*.07+fin*bankWidth/11;
        box(xx,front,1.26,.085,.68,1.68,'#657e86','#a9b9b7');
      }
      for(const f of [.29,.70]){
        const xx=x+w*f,zz=2.19;
        beam([xx,front+.60,zz],[xx,front+.80,zz],fanR,'#3c5660',12);
        for(let k=0;k<6;k++){
          const angle=k*Math.PI/3,dx=Math.cos(angle)*fanR*.67,dz=Math.sin(angle)*fanR*.67;
          m.face([[xx,front+.81,zz],[xx+dx,front+.81,zz+dz],[xx+dx*.76-dz*.32,front+.81,zz+dz*.76+dx*.32]],'#acbcbb');
        }
        beam([xx,front+.80,zz],[xx,front+.86,zz],fanR*.20,'#a4b7b8',8);
      }
      for(const xx of [x+.77,x+w-.77]){
        box(xx-.05,bodyY+4.65,4.47,.12,.22,.29,'#526c75');
        box(xx-.04,bodyY+1.9,1.07,.15,3.53,.14,dark);
      }
      box(x+w*.50-.42,y+6.64,3.08,.84,.2,.69,dark,'#748c91');
      box(x+w*.5-.27,y+6.86,3.40,.54,.045,.21,'#9cbfc0');
      for(let ph=0;ph<3;ph++){
        const px=x+.64+span*(ph+.5)/3;
        insulator(px,bodyY+1.28,4.47,1.89,.28,5);
        insulator(px,bodyY+3.82,4.47,1.02,.20,3);
        hanging([33.5+ph*4.1,9.3,4.7],[px,bodyY+1.28,6.48],.57);
      }
    }
    // Secondary leads drop to the cable trench towards the switch house.
    for(let i=0;i<count;i++){
      m.group(i===0?'sub-transformer':'sub-transformer-'+(i+1));
      const x=30.3+i*pitch,w=pitch-1.2,span=w-1.35;
      for(let ph=0;ph<3;ph++){
        const px=x+.64+span*(ph+.5)/3,y=16.85;
        cable([[px,y,5.56],[px,y+.42,5.68],[px+.23,y+1.48,5.23],[x+w-.28-ph*.15,20.2,3.49],[x+w-.28-ph*.15,20.47,.98]],.048,'#506a73');
      }
    }
    m.group('sub-switchgear');
    // Cutaway switch house with a common gas-insulated bus and repeated breaker bays.
    base(52.6,9.95,8.0,11.4);
    box(52.7,10.06,1.02,7.7,.20,3.70,'#92a4ac','#d0dadd');
    box(60.18,10.10,1.02,.20,11.1,2.5,'#8e9fa8','#c4d0d3');
    beam([54.26,10.65,3.78],[54.26,20.48,3.78],.44,'#93abb1',12);
    for(let k=0;k<4;k++){
      const y=11.45+k*2.63;
      for(const x of [53.83,56.08])box(x,y-.31,1.03,.31,.62,1.42,'#647981',steel);
      beam([54.23,y,2.53],[56.95,y,2.53],.54,'#849da4',12);
      beam([54.26,y,2.61],[54.26,y,3.78],.36,steel,8);
      for(const x of [54.49,56.33])beam([x,y,2.53],[x+.12,y,2.53],.62,'#bbc9c9',10);
      box(57.47,y-.62,1.03,1.32,1.25,2.49,'#4c6874','#94a9ad');
      box(57.45,y+.64,2.36,1.31,.06,.35,'#283e49');
      box(57.62,y+.707,2.47,.18,.018,.115,'#78d9cd');
    }
    anchors['sub-switchgear']=[55.3,15.7,3.18];
    m.group('sub-feeder');
    base(52.55,21.9,8,3.55);
    for(let k=0;k<3;k++){
      const x=53.1+k*2.38;
      box(x,22.2,1.04,1.95,1.83,2.18,'#637e89','#adbdbe');
      box(x+.15,24.04,1.21,1.63,.07,1.74,'#899da4','#afbfbe');
      rect(x+.2,22.64,1.50,.2,3.24,'#d6ab79');
      box(x+.51,24.12,2.36,.63,.08,.32,'#344d59');
      const y=22.22;
      cable([[x+.35,y,3.18],[x+.35,y-.36,3.56],[x+.35,y-1.02,3.56],[x+.35,y-1.25,2.93]],.085,'#8e7355');
    }
    anchors['sub-feeder']=[56.50,23.1,2.85];
    anchors.power=[44,14.9,4.95];
  }
  window.GridYard={build};
})();
