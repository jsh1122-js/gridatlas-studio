// Generic functional cutaways; individual meshes are keyed to the inspector.
export function buildPower(state,{groups,box,cyl,rod,pipe,housing,sign,grip,screw}) {
  const {category,operating}=state;
  function insulator(key,x,y,z,height=.46){
    cyl(key,x,y,z,.105,height,'ivory');
    for(let i=0;i<5;i++)cyl(key,x,y-height*.38+i*height*.16,z,.19,.04,'ivory');
    cyl(key,x,y+height*.54,z,.085,.08,'brass');
  }
  function channel(key,pts,color,active){pipe(key,pts,active?.036:.022,active?color:'panel',active);}
  function modules(key,x,z,count,width=1.15) {
    for(let i=0;i<count;i++){
      const y=.37+i*.31;
      box(key,x,y,z,width,.24,.87,'dark');box(key,x,y,z+.448,width-.045,.207,.042,'silver');
      for(let k=0;k<9;k++)box(key,x-width*.39+k*width*.069,y,z+.476,.034,.12,.014,'black');
      box(key,x+width*.33,y+.035,z+.483,.063,.04,.015,'led');grip(key,x+width*.41,y,z+.49,.09);
    }
  }
  if(category==='transformer'){
    const loaded=operating==='loaded';
    groups('frame');groups('highSide',[-.13,.31,-.26]);groups('lowSide',[.20,.38,.33]);
    groups('core',[0,.17,-.25]);groups('windPrimary',[0,.29,.95]);groups('windSecondary',[0,.12,-.19]);
    box('frame',0,.13,0,3.23,.23,1.46,'dark');
    for(const x of [-.97,0,.97]){
      box('frame',x,.28,0,.67,.12,1.48,'steel');
      box('core',x,1.31,0,.31,1.87,.38,'steel');
      cyl('windSecondary',x,1.27,0,.58,1.52,'copper');
      // Insulating bands and windings use separate parts and separate explosion offsets.
      for(let i=0;i<13;i++)cyl('windSecondary',x,.57+i*.112,0,.60,.032,'brass');
      for(let i=0;i<10;i++){
        const y=.56+i*.153;
        cyl('windPrimary',x,y,0,.84,.123,'hot');cyl('windPrimary',x,y+.065,0,.82,.014,'copper');
      }
      insulator('highSide',x,2.36,-.29);
      box('lowSide',x,2.09,.45,.19,.075,.42,'copper');insulator('lowSide',x,2.23,.45,.23);
      rod('highSide',[x,2.15,-.29],[x,1.98,-.32],.054,'copper');
      rod('lowSide',[x,1.74,.30],[x,2.08,.46],.075,'brass');
    }
    for(const y of [.40,2.13])for(let k=0;k<4;k++)box('core',0,y+k*.026,0,2.60,.022,.46,k%2?'panel':'steel');
    channel('highSide',[[-1.41,2.64,-.31],[-1.25,2.63,-.31],[-.99,2.60,-.29]],'blue',true);
    channel('lowSide',[[.95,2.39,.45],[1.20,2.42,.46],[1.54,2.44,.46]],'hot',loaded);
    sign('frame','DRY TYPE  /  3 PHASE',0,.20,.754,1.49);
    return;
  }
  if(category==='switchgear'){
    const closed=operating==='closed';
    groups('frame');groups('incoming',[-.29,.02,.34]);groups('busbar',[0,.36,0]);
    groups('gasTank',[0,.12,-.54]);groups('breaker',[0,.03,.58]);groups('cable',[.34,0,.28]);
    for(const [i,x] of [-.94,0,.94].entries()){
      housing('frame',x,1.36,0,.89,2.61,1.19);
      box('frame',x,2.34,.61,.76,.43,.052,'panel');
      box('frame',x-.11,2.39,.648,.32,.13,.02,'black');
      box('frame',x-.11,2.40,.66,.24,.065,.01,'jade');
      for(let j=0;j<3;j++)box('frame',x+.13+j*.071,2.39,.65,.038,.047,.018,j%2?'amber':'led');
      sign('frame',['INCOMER','BREAKER','FEEDER'][i],x,2.65,.62,.65);
      box('gasTank',x,1.48,-.36,.73,1.29,.23,'silver');
      box('gasTank',x-.33,1.46,-.045,.062,1.29,.60,'panel');
      for(const dx of [-.28,.28])for(const y of [.94,1.98])screw('gasTank',x+dx,y,-.21);
    }
    for(const z of [-.22,-.025,.17]){
      rod('busbar',[-1.19,2.02,z],[1.19,2.02,z],.086,'copper');
      cyl('breaker',0,1.49,z,.137,.43,'ivory');
      rod('breaker',[0,1.97,z],[0,1.69,z],.055,'brass');
      rod('breaker',[0,1.40,z],[closed?0:.16,1.14,z],.05,'copper');
      pipe('incoming',[[-1.04,.13,z],[-.97,.62,z],[-.94,1.24,z],[-.94,2.0,z]],.051,'blue');
      pipe('cable',[[.03,1.10,z],[.28,.97,z],[.88,.91,z],[.96,.19,z]],.046,'rubber');
    }
    channel('breaker',[[-.95,1.86,.42],[-.91,2.03,.42],[-.21,2.04,.42],[0,1.89,.42],[0,1.64,.42]],'blue',true);
    if(closed)channel('cable',[[0,1.53,.42],[.05,1.13,.42],[.52,.95,.42],[.94,.80,.42],[.96,.23,.42]],'blue',true);
    return;
  }
  if(category==='sst'){
    const solid=operating==='solid';
    groups('frame');groups('incoming',[-.32,.15,0]);groups('frontEnd',[-.33,.22,.50]);
    groups('isolation',[.14,.34,.57]);groups('dcBus',[0,.40,-.09]);groups('rackDc',[.39,.13,.36]);
    housing('frame',-1.02,1.16,0,1.15,2.23,1.11);housing('frame',.20,1.16,0,1.13,2.23,1.11);
    housing('rackDc',1.61,.83,0,.80,1.59,.88);
    for(let j=0;j<3;j++)insulator('incoming',-1.32+j*.266,2.40,-.06,.33);
    if(solid){
      modules('frontEnd',-1.03,.02,5,.92);
      for(let j=0;j<3;j++){
        const y=.48+j*.51;
        box('isolation',.17,y,0,.84,.36,.81,'dark');
        for(const x of [-.04,.36]){
          box('isolation',x,y+.066,.32,.30,.23,.16,'steel');
          for(let w=0;w<5;w++)box('isolation',x-.114+w*.057,y+.06,.42,.041,.23,.077,'copper');
        }
      }
    }else{
      box('frontEnd',-1.04,.47,0,.84,.12,.66,'steel');box('frontEnd',-1.04,1.62,0,.84,.12,.66,'steel');
      for(let u=0;u<3;u++)for(let i=0;i<7;i++)cyl('frontEnd',-1.33+u*.295,.6+i*.144,.10,.271,.127,'hot');
      modules('isolation',.17,.02,5,.91);
    }
    for(let i=0;i<2;i++)rod('dcBus',[.10,2.10,-.20+i*.18],[1.70,2.10,-.20+i*.18],.066,i?'black':'copper');
    modules('rackDc',1.61,.02,3,.64);
    channel('dcBus',[[.27,1.69,.22],[.43,2.02,.25],[.92,2.08,.25],[1.49,2.08,.25],[1.60,1.26,.25]],'blue',true);
    sign('frame',solid?'MV  /  AFE':'MV  /  XFMR',-1.02,2.12,.588,.88);
    sign('frame',solid?'ISOLATED DC/DC':'RECTIFIER',.19,2.12,.588,.89);sign('rackDc','RACK  /  DC',1.61,1.52,.469,.68);
    return;
  }
  const stored=operating==='stored';
  groups('frame');groups('incoming',[-.32,.16,0]);groups('frontEnd',[0,.28,.63]);
  groups('storage',[-.44,.03,.26]);groups('dcBus',[0,.38,-.14]);groups('feeder',[.40,.13,.32]);
  housing('frame',-.12,1.29,0,1.53,2.46,1.25);housing('storage',-1.38,.94,0,.88,1.81,1.06);housing('feeder',1.12,1.07,0,.80,2.02,1.07);
  modules('frontEnd',-.12,.03,6,1.23);
  for(let i=0;i<4;i++){
    const y=.31+i*.36;
    box('storage',-1.38,y,0,.70,.25,.88,'black');box('storage',-1.38,y,.465,.61,.17,.032,'panel');
    for(const [x,m] of [[-1.61,'hot'],[-1.17,'blue']])cyl('storage',x,y+.05,.492,.065,.05,m,[Math.PI/2,0,0]);
  }
  for(let i=0;i<3;i++)insulator('incoming',-.51+i*.35,2.61,0,.24);
  for(let j=0;j<2;j++)rod('dcBus',[-1.27,2.13,-.23+j*.21],[1.23,2.13,-.23+j*.21],.072,j?'black':'copper');
  for(let i=0;i<5;i++){const y=.35+i*.31;box('feeder',1.12,y,.10,.53,.21,.66,'ivory');box('feeder',1.12,y,.46,.19,.12,.060,'dark');}
  const inlet=stored?[[-1.40,1.29,.58],[-1.31,1.88,.58],[-.91,2.06,.59],[-.14,2.09,.61]]:[[-.46,2.65,.34],[-.53,1.71,.56],[-.22,1.66,.58],[-.14,2.09,.61]];
  channel(stored?'storage':'frontEnd',inlet,stored?'hot':'blue',true);
  channel('feeder',[[-.14,2.09,.61],[.41,2.10,.60],[.93,2.08,.60],[1.11,1.53,.60]],'blue',true);
  sign('frame','HVDC / RECTIFIER',-.12,2.40,.65,1.21);sign('feeder','DC FEEDS',1.12,1.96,.56,.65);
}
