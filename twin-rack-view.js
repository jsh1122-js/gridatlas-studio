(() => {
  'use strict';
  function mount(host, {getRoom, moveCamera, captureCamera, restoreCamera, redraw, onChange}) {
    let rig=null, geometry, trace=null, view='rack', step='rack', slot=null, open=true, extended=false;
    let door=0, extension=0, closing=false, pendingSlot=null, tourAt=0, origin;
    const tags=document.createElement('div');tags.className='rack-scene-tags';host.append(tags);
    const labelNodes=[];
    function notify(){
      onChange?.(rig?{rack:rig.topology,slotId:slot,view,step,doorOpen:open,extracted:extended}:null);
    }
    function setActivity(){
      if(!rig)return;
      rig.selectedId=trace?.module.id||null;
      rig.highlight=trace?.pathIds||[];
      const what={rowdist:trace?.rowdist,pdu:trace?.pdu,psu:trace?.module,bus:trace?.bus,servers:trace?.servers[0]};
      rig.highlightStep=what[step]?.id||null;
      geometry=getRoom().model.getRackRig(rig);
    }
    function cabinetBounds(){
      const c=geometry.center,s=geometry.size,offset=geometry.extractionVector;
      const front=c.map((v,i)=>v+(offset?.[i]||0)*.25);
      const corners=[];
      for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])corners.push(front.map((v,i)=>v+[x,y,z][i]*s[i]*.55));
      return corners;
    }
    function anchorsFor(nodes){return nodes.map(n=>n&&geometry.anchors[n.id]).filter(Boolean);}
    function fit(action='rack'){
      if(!geometry)return;
      let pts=cabinetBounds(),angle=geometry.frontYaw+.25,pitch=.25;
      if(action==='circuit'&&trace){
        pts.push(...anchorsFor([trace.rowdist,trace.pdu,trace.module,...trace.servers]));angle=geometry.frontYaw+.75;pitch=.84;
      }else if(trace&&action!=='rack'){
        const parts={rowdist:[trace.rowdist],pdu:[trace.pdu],psu:[trace.module],bus:[trace.bus],servers:trace.servers};
        const nodes=parts[action]||[],targets=anchorsFor(nodes);
        if(targets.length){
          const fractions={rowdist:.79,pdu:.43,psu:.32,bus:.41,servers:.36};
          const r=geometry.size[2]*(fractions[action]||.52);
          pts=[];
          for(const a of targets)for(const dx of [-1,1])for(const dy of [-1,1])for(const dz of [-1,1])pts.push([a[0]+r*.55*dx,a[1]+r*.95*dy,a[2]+r*dz]);
        }
        pitch=action==='rowdist'?.64:.22;
      }
      moveCamera({pts,angle,pitch,kind:action});
    }
    function refreshTags(){
      tags.replaceChildren();labelNodes.length=0;if(!rig)return;
      function tag(n,text,kind,act){
        if(!n || !geometry.anchors[n.id])return;
        const b=document.createElement('button');b.type='button';b.className='rack-scene-pin';b.dataset.rackNode=n.id;b.dataset.rackKind=kind;
        b.textContent=text;b.onclick=e=>{e.stopPropagation();act();};
        tags.append(b);labelNodes.push({b,id:n.id});
      }
      if(step==='rowdist'&&trace){tag(trace.rowdist,trace.rowdist.label,'rowdist',()=>toggleView());}
      else if(view==='circuit'&&trace){
        tag(trace.rowdist,trace.rowdist.label,'rowdist',()=>focusStep('rowdist'));
        tag(trace.pdu,trace.pdu.label,'pdu',()=>focusStep('pdu'));
        tag(trace.module,trace.module.label,'psu',()=>focusStep('psu'));
        const loads=trace.servers;
        if(loads.length)tag(loads[Math.floor((loads.length-1)/2)],loads.length===1?loads[0].label:loads.length+' 个计算托盘','servers',()=>focusStep('servers'));
      }else if(open){
        const list=rig.topology.modules;
        const pins=trace?[trace.module]:list.length>1?[list[0],list.find(n=>n.feed!==list[0].feed)||list[1]]:list;
        pins.forEach(n=>tag(n,n.label+' · '+n.feed+' 路','psu',()=>selectSlot(n.slot)));
      }
    }
    function positionTags(cam,project){
      const occupied=[];
      for(const {b,id} of labelNodes){
        const a=geometry?.anchor?.(id,rig.extraction)||geometry?.anchors[id];if(!a){b.hidden=true;continue;}
        const point=project(a,cam);const width=Math.min(138,Math.max(60,b.textContent.length*10+17));
        if(point[0]<4||point[0]>cam.width-4||point[1]<5||point[1]>cam.height-5){b.hidden=true;continue;}
        const toolbar=point[1]>cam.height-(cam.width<500?155:182)?(cam.width<500?44:53):5;
        const x=Math.max(width*.5+4,Math.min(cam.width-width*.5-toolbar,point[0]));
        const offsets=[-23,24,-51,51,-78];
        const y=offsets.map(d=>point[1]+d).find(y=>y>13&&y<cam.height-20&&occupied.every(p=>Math.abs(p.x-x)>(width+p.w)*.5+3||Math.abs(y-p.y)>23));
        if(y===undefined){b.hidden=true;continue;}
        b.hidden=false;b.style.left=x+'px';b.style.top=y+'px';b.style.setProperty('--stem',Math.hypot(point[0]-x,point[1]-y)+'px');
        b.style.setProperty('--angle',-Math.atan2(point[0]-x,point[1]-y)+'rad');occupied.push({x,y,w:width});
      }
    }
    function enter(index){
      const room=getRoom(),h=room.model?.plan.dims[room.hallIndex];if(!h||!h.rackPoints.length)return false;
      const defaultPos=h.points.rack;
      if(!Number.isInteger(index)||!h.rackPoints[index]){
        index=defaultPos?h.rackPoints.findIndex(r=>r.pos.every((v,k)=>Math.abs(v-defaultPos[k])<.01)):0;
        if(index<0)index=0;
      }
      if(rig?.rackIndex===index&&rig.hallIndex===room.hallIndex){if(closing){closing=false;open=true;}fit();notify();return true;}
      const pt=h.rackPoints[index],study=GridRackStudy.clean(room.project.rackStudy);
      const profile=pt.key?.split(':')[1]||study.profile;
      const topology=GridRackCircuit.build({hallIndex:h.index,rackIndex:index,rowIndex:pt.rowIndex,columnIndex:pt.columnIndex,profile,architecture:room.project.config.architecture,pcieServers:study.servers});
      if(!rig)origin=captureCamera();
      rig={hallIndex:room.hallIndex,rackIndex:index,door:0,extraction:0,selectedId:null,topology,highlight:[],highlightStep:null};
      trace=null;slot=null;open=true;extended=false;closing=false;door=0;extension=0;pendingSlot=null;view='rack';step='rack';tourAt=0;
      setActivity();fit();refreshTags();notify();redraw();return true;
    }
    function applySlot(n){
      slot=n;trace=GridRackCircuit.trace(rig.topology,n);step='psu';view='rack';open=true;extended=true;
      setActivity();fit();refreshTags();notify();redraw();
    }
    function selectSlot(n){
      n=Number(n);if(!rig||closing||!rig.topology.modules.some(m=>m.slot===n))return;
      tourAt=0;
      if(n!==slot&&extension>.02){pendingSlot=n;extended=false;redraw();return;}
      pendingSlot=null;applySlot(n);tourAt=performance.now()+1150;
    }
    function focusStep(key){
      if(!rig||closing)return;
      if(key!=='rack'&&!trace){applySlot(rig.topology.modules[0].slot);}
      pendingSlot=null;if(key!=='rowdist')open=true;
      step=key;view=key==='rowdist'?'circuit':'rack';tourAt=0;
      setActivity();fit(key);refreshTags();notify();redraw();
    }
    function toggleView(){
      if(!rig||closing)return;if(!trace)applySlot(rig.topology.modules[0].slot);
      tourAt=0;view=view==='rack'?'circuit':'rack';step=view==='rack'?'psu':'circuit';
      setActivity();fit(view);refreshTags();notify();redraw();
    }
    function toggleDoor(){
      if(!rig||closing)return;open=!open;tourAt=0;pendingSlot=null;
      if(!open){extended=false;view='rack';step='rack';fit();}
      refreshTags();notify();redraw();
    }
    function toggleExtract(){if(!rig||closing)return;if(!trace){selectSlot(rig.topology.modules[0].slot);return;}tourAt=0;extended=!extended;if(extended)open=true;notify();redraw();}
    function clear(restore=false){
      if(!rig)return;
      rig=null;geometry=null;trace=null;slot=null;closing=false;tourAt=0;pendingSlot=null;
      tags.replaceChildren();labelNodes.length=0;notify();
      if(restore&&origin)restoreCamera(origin);
      origin=null;redraw();
    }
    function leave(){
      if(!rig||closing)return;
      tourAt=0;pendingSlot=null;closing=true;open=false;extended=false;
      refreshTags();redraw();
    }
    function tick(dt,instant,now){
      if(!rig)return false;
      const advance=(value,goal,time)=>instant?goal:value+Math.sign(goal-value)*Math.min(Math.abs(goal-value),dt/time);
      extension=advance(extension,extended&&door>.85?1:0,.48);
      if(pendingSlot&&extension===0){const n=pendingSlot;pendingSlot=null;applySlot(n);tourAt=now+1150;}
      door=advance(door,open||extension>.001?1:0,.58);
      rig.door=door*door*(3-2*door);rig.extraction=extension*extension*(3-2*extension);
      if(closing&&door===0&&extension===0){clear(true);return true;}
      if(tourAt&&now>=tourAt&&extension===1){tourAt=0;view='circuit';step='circuit';setActivity();fit('circuit');refreshTags();notify();}
      return Boolean(tourAt||pendingSlot||closing||door!==(open?1:0)||extension!==(extended?1:0));
    }
    function hit(object){
      if(!rig||closing||!object?.nodeId)return false;
      const module=rig.topology.modules.find(n=>n.id===object.nodeId);
      if(module){selectSlot(module.slot);return true;}
      if(object.key==='door'){toggleDoor();return true;}
      const key={rowdist:'rowdist',pdu:'pdu',server:'servers',bus:'bus',cable:'circuit'}[object.key];
      if(key){
        const belongs=m=>key==='pdu'?m.pduId===object.nodeId:key==='servers'?m.serverIds.includes(object.nodeId):
          key==='bus'?m.busId===object.nodeId:key==='circuit'?GridRackCircuit.trace(rig.topology,m.slot).edgeIds.includes(object.nodeId):true;
        if(!trace||!belongs(trace.module)){
          const match=rig.topology.modules.find(belongs);
          if(match)applySlot(match.slot);
        }
        if(key==='circuit'){if(view!=='circuit')toggleView();}else focusStep(key);
        return true;
      }
      return false;
    }
    return {enter,clear,leave,tick,hit,selectSlot,toggleDoor,toggleExtract,toggleView,focusStep,positionTags,
      get rig(){return rig;},cancelTour(){tourAt=0;}};
  }
  window.GridRackView={mount};
})();
