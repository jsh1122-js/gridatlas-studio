(() => {
  'use strict';
  function mount(host, {getRoom, moveCamera, captureCamera, restoreCamera, redraw, onChange}) {
    let rig=null, geometry, trace=null, view='rack', step='rack', slot=null, open=true, extended=false;
    let door=0, extension=0, closing=false, pendingSlot=null, tourAt=0, origin,journey=null,livePlan=null,liveModel=null;
    const tags=document.createElement('div');tags.className='rack-scene-tags';host.append(tags);
    const labelNodes=[];
    function notify(){
      onChange?.(rig?{rack:rig.topology,slotId:slot,view,step,doorOpen:open,extracted:extended,journey:Boolean(journey),serverNumber:journey?.server.number,gpuNumber:journey?.gpu.number}:null);
    }
    function setActivity(){
      if(!rig)return;
      rig.boardInspect=Boolean(journey&&(step==='server'||step==='gpu'));
      rig.selectedId=trace?.module.id||null;
      rig.highlight=journey?journey.nodes.map(n=>n.id):trace?.pathIds||[];
      const what={rowdist:trace?.rowdist,pdu:trace?.pdu,psu:trace?.module,bus:trace?.bus,servers:trace?.servers[0],server:journey?.server,gpu:journey?.gpu};
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
        const parts={rowdist:[trace.rowdist],pdu:[trace.pdu],psu:[trace.module],bus:[trace.bus],servers:trace.servers,server:[journey?.server,journey?.gpu],gpu:[journey?.gpu]};
        const nodes=parts[action]||[],targets=anchorsFor(nodes);
        if(targets.length){
          const fractions={rowdist:.79,pdu:.43,psu:.32,bus:.41,servers:.36,server:.22,gpu:.091};
          const r=geometry.size[2]*(fractions[action]||.52);
          pts=[];
          for(const a of targets)for(const dx of [-1,1])for(const dy of [-1,1])for(const dz of [-1,1])pts.push([a[0]+r*.55*dx,a[1]+r*.95*dy,a[2]+r*dz]);
        }
        pitch=action==='rowdist'?.64:action==='gpu'||action==='server'?.76:.22;
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
      if(journey&&(step==='server'||step==='gpu')){
        tag(journey.server,journey.server.label,'server',()=>inspectBoard(journey.server,journey.gpu));
        const chips=rig.topology.gpus.filter(g=>g.serverId===journey.server.id);
        const selected=step==='gpu'?[journey.gpu]:[journey.gpu,...chips.filter(g=>g.id!==journey.gpu.id)];
        for(const g of selected)tag(g,g.label,'gpu',()=>inspectBoard(journey.server,g,true));
      }else if(step==='rowdist'&&trace){tag(trace.rowdist,trace.rowdist.label,'rowdist',()=>toggleView());}
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
    function layout(options={},fallback=true){
      const room=getRoom(),hallIndex=options.hallIndex??room.hallIndex,h=room.model?.plan.dims[hallIndex];
      if(!h||!h.rackPoints.length)return null;
      let index=options.rackIndex;
      if(index==null||fallback&&(!Number.isInteger(index)||!h.rackPoints[index])){
        const pos=h.points.rack;
        index=pos?h.rackPoints.findIndex(r=>r.pos.every((v,k)=>Math.abs(v-pos[k])<.01)):0;
        if(index<0)index=0;
      }
      if(!Number.isInteger(index)||!h.rackPoints[index])return null;
      const pt=h.rackPoints[index],study=GridRackStudy.clean(room.project.rackStudy);
      const profile=pt.key?.split(':')[1]||study.profile;
      const topology=GridRackCircuit.build({hallIndex:h.index,rackIndex:index,rowIndex:pt.rowIndex,columnIndex:pt.columnIndex,
        profile,architecture:room.project.config.architecture,pcieServers:study.servers,pcieCards:study.cards});
      return {room,hallIndex,index,topology};
    }
    function newRig(info){
      return {hallIndex:info.hallIndex,rackIndex:info.index,door:0,extraction:0,selectedId:null,topology:info.topology,highlight:[],highlightStep:null};
    }
    function enter(index){
      const info=layout({rackIndex:index});if(!info)return false;
      if(!journey&&rig?.rackIndex===info.index&&rig.hallIndex===info.hallIndex){if(closing){closing=false;open=true;}fit();notify();return true;}
      if(!rig)origin=captureCamera();
      rig=newRig(info);journey=null;livePlan=null;liveModel=null;
      trace=null;slot=null;open=true;extended=false;closing=false;door=0;extension=0;pendingSlot=null;view='rack';step='rack';tourAt=0;
      setActivity();fit();refreshTags();notify();redraw();return true;
    }
    function planInfo(options){
      const info=layout(options,false);if(!info)return null;
      const t=info.topology,selected=GridRackCircuit.branch(t,options);if(!selected)return null;
      const plannedRig=newRig(info);plannedRig.boardServerId=selected.server.id;
      const mesh=info.room.model.getRackRig(plannedRig,false);
      if(!mesh)return null;
      const lines=selected.edgeIds.map(id=>mesh.edgePoints[id]);
      if(lines.some(line=>!line||line.length<2))return null;
      const first=lines[0][0],pcie=t.profile==='pcie';
      const words=[
        '由'+selected.module.feed+'路出线，将这一列的供电送到指定机柜。',
        (t.isDC?'机架直流分配装置':'机柜 PDU')+'把本支路送到'+selected.module.label+'的输入端。',
        t.isDC?'以匹配输入电压的 DC/DC 作原理示意。具体整柜和前级的直流电压、保护与接口兼容性需核对。':'PSU 将交流输入转换为机架内供电使用的直流电。',
        pcie?'A、B 两个模块的低压输出在本机电源背板汇合，供给这一台服务器。':'多个电源模块并联在本柜共用直流母排上，18 个计算托盘可共享电源输出。这里沿其中一个托盘的支路继续。',
        selected.server.label+'内有 '+t.perServer+(pcie?' 张单 GPU PCIe 卡。':' 颗 GPU。')+'板卡向前展开以显示内部，线条表示模块装回时的供电关系。',
        '机柜 '+t.id+' 内，板级稳压把电送到'+selected.server.label+'的 '+selected.gpu.label+'。此芯片的完整编号是 '+selected.gpu.id+'。'
      ];
      const keys=['rowdist','pdu','psu','bus','server','gpu'];
      const stops=selected.nodes.map((n,i)=>{
        const points=i?lines[i-1].map(p=>p.slice()):[first.slice()];
        const segments=i===3?[{kind:'transfer',points:points.slice(0,4)},{kind:'enclosed',points:points.slice(3)}]:
          i===5?[{kind:'enclosed',points:points.slice(0,6)},{kind:'transfer',points:points.slice(5,7)},{kind:'enclosed',points:points.slice(6)}]:
          [{kind:i===1?'cable':'enclosed',points}];
        return {key:keys[i],nodeId:n.id,label:n.label,point:points[points.length-1].slice(),points,segments,description:words[i]};
      });
      const plan={hallIndex:info.hallIndex,rackIndex:info.index,rackId:t.id,profile:t.profile,profileLabel:t.profileLabel,slot:selected.module.slot,
        serverNumber:selected.server.number,gpuNumber:selected.gpu.number,feed:selected.module.feed,rackPoint:mesh.center.slice(),stops};
      return {plannedRig,selected,plan};
    }
    function getJourneyPlan(options={}){return planInfo(options)?.plan||null;}
    function prepareJourney(options={}){
      const room=getRoom();
      if(journey&&livePlan&&liveModel===room.model&&livePlan.hallIndex===(options.hallIndex??room.hallIndex)&&
         livePlan.rackIndex===options.rackIndex&&livePlan.slot===options.slot&&livePlan.serverNumber===options.serverNumber&&livePlan.gpuNumber===options.gpuNumber)return livePlan;
      const found=planInfo(options);if(!found)return null;
      livePlan=found.plan;liveModel=room.model;
      if(!rig)origin=captureCamera();
      const same=rig?.rackIndex===found.plan.rackIndex&&rig.hallIndex===found.plan.hallIndex;
      rig=found.plannedRig;journey=found.selected;slot=journey.module.slot;
      trace=GridRackCircuit.trace(rig.topology,slot);
      open=true;extended=false;closing=false;pendingSlot=null;tourAt=0;extension=0;if(!same)door=0;
      rig.door=door;view='rack';step='rack';
      setActivity();refreshTags();notify();redraw();return found.plan;
    }
    function setJourneyStep(key){
      if(!journey||!['rack','rowdist','pdu','psu','bus','server','gpu'].includes(key))return false;
      step=key;view=key==='rowdist'?'circuit':'rack';tourAt=0;
      setActivity();refreshTags();notify();redraw();return true;
    }
    function inspectBoard(server,gpu,chip=false){
      if(!rig||!server)return false;
      const module=trace?.module.serverIds.includes(server.id)?trace.module:rig.topology.modules.find(m=>m.serverIds.includes(server.id));
      if(!module)return false;
      const selected=GridRackCircuit.branch(rig.topology,{slot:module.slot,serverNumber:server.number,gpuNumber:gpu?.number??1});
      if(!selected)return false;
      livePlan=null;liveModel=null;slot=module.slot;trace=GridRackCircuit.trace(rig.topology,slot);journey=selected;rig.boardServerId=server.id;
      open=true;extended=false;pendingSlot=null;extension=0;rig.extraction=0;
      const key=chip?'gpu':'server';
      setJourneyStep(key);fit(key);return true;
    }
    function applySlot(n){
      journey=null;livePlan=null;liveModel=null;rig.boardServerId=null;slot=n;trace=GridRackCircuit.trace(rig.topology,n);step='psu';view='rack';open=true;extended=true;
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
      rig=null;geometry=null;trace=null;journey=null;livePlan=null;liveModel=null;slot=null;closing=false;tourAt=0;pendingSlot=null;
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
      if(object.key==='server')return inspectBoard(rig.topology.servers.find(n=>n.id===object.nodeId));
      const boardLead=object.key==='cable'&&rig.topology.boardEdges.find(e=>e.id===object.nodeId);
      if(object.key==='gpu'||boardLead){
        const gpu=rig.topology.gpus.find(n=>n.id===(boardLead?boardLead.to:object.nodeId));
        return gpu?inspectBoard(rig.topology.servers.find(n=>n.id===gpu.serverId),gpu,true):false;
      }
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
    return {enter,clear,leave,tick,hit,getJourneyPlan,prepareJourney,setJourneyStep,selectSlot,toggleDoor,toggleExtract,toggleView,focusStep,positionTags,
      get rig(){return rig;},cancelTour(){tourAt=0;}};
  }
  window.GridRackView={mount};
})();
