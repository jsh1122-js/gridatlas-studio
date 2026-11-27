(() => {
  'use strict';
  function mount(host, {getRoom, moveCamera, captureCamera, restoreCamera, redraw, onChange, onGpuPick, onGpuTrace}) {
    let rig=null, geometry, trace=null, view='rack', step='rack', slot=null, open=true, extended=false;
    let door=0, extension=0, closing=false, pendingSlot=null, tourAt=0, origin,journey=null,livePlan=null,liveModel=null,coolingStop=null;
    let gpuSelection=null;
    const tags=document.createElement('div');tags.className='rack-scene-tags';host.append(tags);
    const labelNodes=[];
    function notify(){
      onChange?.(rig?{rack:rig.topology,hallIndex:rig.hallIndex,rackIndex:rig.rackIndex,slotId:slot,view,step,doorOpen:open,extracted:extended,journey:Boolean(journey),cooling:Boolean(rig.cooling),gpuSelection,gpuId:journey?.gpu.id,
        coolingStop:rig.cooling?coolingStop:null,serverNumber:journey?.server.number,gpuNumber:journey?.gpu.number}:null);
    }
    function setActivity(){
      if(!rig)return;
      rig.boardInspect=Boolean(journey&&(step==='server'||step==='gpu'));
      rig.selectedId=trace?.module.id||null;
      rig.dualGpuId=gpuSelection?.gpuId||null;
      rig.highlight=gpuSelection?journey.nodes.map(n=>n.id):rig.cooling?[]:journey?journey.nodes.map(n=>n.id):trace?.pathIds||[];
      const what={rowdist:trace?.rowdist,pdu:trace?.pdu,psu:trace?.module,bus:trace?.bus,servers:trace?.servers[0],server:journey?.server,gpu:journey?.gpu};
      rig.highlightStep=rig.cooling?coolingStop?.nodeId:what[step]?.id||null;
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
      if(gpuSelection&&geometry.boardBounds){
        pts=geometry.boardBounds;pitch=.86;
      }else if(rig.cooling&&coolingStop){
        const target=geometry.anchors[coolingStop.nodeId];
        const radius=geometry.size[2]*({rack:.45,server:.20,gpu:.073}[step]||.45);
        if(target){
          pts=[[target[0]-radius,target[1]-radius,target[2]-radius],[target[0]+radius,target[1]+radius,target[2]+radius]];
          pitch=step==='gpu'?.80:step==='server'?.65:.42;
        }
      }else if(action==='circuit'&&trace){
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
      if(gpuSelection){
        const lead=journey.edgeIds.at(-1),plate=geometry.cooling?.branches[journey.gpu.id]?.plate;
        tag({id:lead},'供电线','gpu-power',()=>onGpuTrace?.('power',gpuSelection));
        if(plate)tag(plate,'冷板与回液管','gpu-cooling',()=>onGpuTrace?.('cooling',gpuSelection));
      }else if(rig.cooling&&geometry.cooling){
        const c=geometry.cooling,click=n=>inspectCoolant(n);
        const fittings=step==='rack'?[c.manifoldS,c.manifoldR]:step==='server'?[c.hoseS,c.hoseR]:[c.branches[journey.gpu.id].plate];
        for(const n of fittings)tag(n,n.label,'coolant',()=>click(n));
      }else if(journey&&(step==='server'||step==='gpu')){
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
      gpuSelection=null;
      rig=newRig(info);journey=null;livePlan=null;liveModel=null;coolingStop=null;
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
    function coolingPlanInfo(options){
      const info=layout(options,false);if(!info)return null;
      const t=info.topology,hall=info.room.model.plan.dims[info.hallIndex];
      if(t.profile==='pcie'||(hall.coolingByRack?.[info.index]||hall.coolingPaths)?.rackIndex!==info.index)return null;
      const server=t.servers.find(n=>n.number===(options.serverNumber??9));
      const gpu=t.gpus.find(n=>n.serverId===server?.id&&n.number===(options.gpuNumber??2));
      if(!server||!gpu)return null;
      const plannedRig=newRig(info);plannedRig.cooling=true;plannedRig.boardServerId=server.id;
      const c=info.room.model.getRackRig(plannedRig,false)?.cooling,branch=c?.branches[gpu.id];
      if(!branch)return null;
      const full=server.label+' · '+gpu.label+' 冷板';
      const stops=[];
      function stop(n,points,title,text){
        stops.push({key:n.key,title,text,scope:'rack',medium:n.medium,nodeId:n.id,gpuId:gpu.id,
          points,segments:[{kind:'pipe',points}]});
      }
      stop(c.manifoldS,c.rackSupply,'机柜 '+t.id+' · 供液歧管',
        '二次侧供液进入'+t.profileLabel+'机柜。歧管沿柜身分成各托盘支路，镜头跟随通往'+server.label+'的接口。');
      stop(c.hoseS,c.traySupply,server.label+' · 供液快接',
        '冷却液经快接和软管送到托盘供液管。在这个展开示意中可以看到四颗 GPU 各自的冷板支路。');
      stop(branch.plate,branch.chipSupply,full,
        t.id+' 的'+server.label+'中，'+gpu.label+'（'+gpu.id+'）贴合铜质冷板。芯片的热量经接触面传进冷板，流道内的冷却液把热量带走。冷板采用剖面示意。');
      stop(c.hoseR,[...branch.chipReturn,...c.trayReturn.slice(1)],server.label+' · 回液快接',
        '从同一颗 GPU 的冷板流出后，升温的液体沿另一根软管离开板卡，通过托盘回液快接进入机柜回液歧管。');
      stops.at(-1).segments=[{kind:'pipe',run:'coldplate-return',points:branch.chipReturn},{kind:'pipe',run:'tray-return',points:c.trayReturn}];
      stop(c.manifoldR,c.rackReturn,'机柜 '+t.id+' · 回液歧管',
        '来自托盘的回液在歧管汇集，经机柜回液出口进入机房二次侧回液管。下一段回到 CDU，在换热面把热量交给设施侧。');
      const plan={hallIndex:info.hallIndex,rackIndex:info.index,rackId:t.id,profile:t.profile,
        serverNumber:server.number,gpuNumber:gpu.number,gpuId:gpu.id,stops};
      return {plannedRig,selected:{server,gpu},plan};
    }
    function getCoolingJourneyPlan(options={}){return coolingPlanInfo(options)?.plan||null;}
    function prepareCoolingJourney(options={}){
      if(rig?.cooling&&livePlan&&liveModel===getRoom().model&&livePlan.hallIndex===(options.hallIndex??getRoom().hallIndex)&&
         livePlan.rackIndex===options.rackIndex&&livePlan.serverNumber===(options.serverNumber??9)&&livePlan.gpuNumber===(options.gpuNumber??2))return livePlan;
      const found=coolingPlanInfo(options);if(!found)return null;
      if(!rig)origin=captureCamera();
      const same=rig?.rackIndex===found.plan.rackIndex&&rig.hallIndex===found.plan.hallIndex;
      gpuSelection=null;
      rig=found.plannedRig;livePlan=found.plan;liveModel=getRoom().model;journey=found.selected;
      trace=null;slot=null;open=true;extended=false;closing=false;pendingSlot=null;tourAt=0;extension=0;
      if(!same)door=0;rig.door=door;view='rack';
      setCoolingStep(livePlan.stops[0]);return livePlan;
    }
    function setCoolingStep(s){
      if(!rig?.cooling||!livePlan)return false;
      const next=livePlan.stops.find(stop=>stop.nodeId===s?.nodeId);
      if(!next)return false;
      gpuSelection=null;slot=null;trace=null;
      open=true;coolingStop=next;step=next.key;view='rack';tourAt=0;setActivity();refreshTags();notify();redraw();return true;
    }
    function inspectCoolant(n){
      if(!rig?.cooling||!n)return false;
      const plan=prepareCoolingJourney({hallIndex:rig.hallIndex,rackIndex:rig.rackIndex,
        serverNumber:n.serverNumber??journey.server.number,gpuNumber:n.gpuNumber??journey.gpu.number});
      if(!plan)return false;
      const next=plan.stops.find(s=>s.key===n.key&&s.medium===n.medium);
      if(!setCoolingStep(next))return false;
      fit(next.key);return true;
    }
    function prepareJourney(options={}){
      const room=getRoom();
      if(!rig?.cooling&&journey&&livePlan&&liveModel===room.model&&livePlan.hallIndex===(options.hallIndex??room.hallIndex)&&
         livePlan.rackIndex===options.rackIndex&&livePlan.slot===options.slot&&livePlan.serverNumber===options.serverNumber&&livePlan.gpuNumber===options.gpuNumber)return livePlan;
      const found=planInfo(options);if(!found)return null;
      livePlan=found.plan;liveModel=room.model;
      if(!rig)origin=captureCamera();
      const same=rig?.rackIndex===found.plan.rackIndex&&rig.hallIndex===found.plan.hallIndex;
      gpuSelection=null;
      rig=found.plannedRig;journey=found.selected;coolingStop=null;slot=journey.module.slot;
      trace=GridRackCircuit.trace(rig.topology,slot);
      open=true;extended=false;closing=false;pendingSlot=null;tourAt=0;extension=0;if(!same)door=0;
      rig.door=door;view='rack';step='rack';
      setActivity();refreshTags();notify();redraw();return found.plan;
    }
    function setJourneyStep(key){
      if(rig?.cooling||!journey||!['rack','rowdist','pdu','psu','bus','server','gpu'].includes(key))return false;
      gpuSelection=null;
      step=key;view=key==='rowdist'?'circuit':'rack';tourAt=0;
      setActivity();refreshTags();notify();redraw();return true;
    }
    function inspectBoard(server,gpu,chip=false){
      if(!rig||!server)return false;
      if(chip&&gpu)return pickGpu({serverNumber:server.number,gpuNumber:gpu.number});
      const module=trace?.module.serverIds.includes(server.id)?trace.module:rig.topology.modules.find(m=>m.serverIds.includes(server.id));
      if(!module)return false;
      const selected=GridRackCircuit.branch(rig.topology,{slot:module.slot,serverNumber:server.number,gpuNumber:gpu?.number??1});
      if(!selected)return false;
      livePlan=null;liveModel=null;coolingStop=null;rig.cooling=false;slot=module.slot;trace=GridRackCircuit.trace(rig.topology,slot);journey=selected;rig.boardServerId=server.id;
      open=true;extended=false;pendingSlot=null;extension=0;rig.extraction=0;
      setJourneyStep('server');fit('server');return true;
    }
    function selectGpu(options={}){
      const info=layout({...options,hallIndex:options.hallIndex??rig?.hallIndex,rackIndex:options.rackIndex??rig?.rackIndex},false);
      if(!info)return null;
      const t=info.topology,same=rig?.hallIndex===info.hallIndex&&rig.rackIndex===info.index;
      const target=t.servers.find(n=>n.number===options.serverNumber);
      if(!target||!Number.isInteger(options.gpuNumber))return null;
      const previous=same&&trace?.module;
      const part=options.slot!=null?t.modules.find(n=>n.slot===options.slot):
        previous&&previous.serverIds.includes(target.id)?previous:t.modules.find(n=>n.serverIds.includes(target.id));
      if(!part)return null;
      const branch=GridRackCircuit.branch(t,{slot:part.slot,serverNumber:target.number,gpuNumber:options.gpuNumber});
      if(!branch||options.gpuId&&options.gpuId!==branch.gpu.id)return null;
      if(!rig)origin=captureCamera();
      if(!same){rig=newRig(info);door=0;}
      const selected={hallIndex:info.hallIndex,rackIndex:info.index,slot:part.slot,serverNumber:target.number,gpuNumber:branch.gpu.number,gpuId:branch.gpu.id};
      // Retain the thermal inspection panel when a person enters from a running cooling tour.
      const thermal=rig.cooling?coolingPlanInfo(selected)?.plan:null;
      livePlan=thermal||null;liveModel=thermal?info.room.model:null;coolingStop=thermal?.stops.find(s=>s.key==='gpu')||null;
      rig.cooling=Boolean(thermal);rig.boardServerId=target.id;rig.door=door;rig.extraction=0;
      trace=GridRackCircuit.trace(t,part.slot);journey=branch;slot=part.slot;
      open=true;closing=false;extended=false;extension=0;pendingSlot=null;tourAt=0;step='gpu';view='rack';
      gpuSelection={...selected,hasCooling:false};
      setActivity();gpuSelection.hasCooling=Boolean(geometry.cooling?.branches[branch.gpu.id]);
      fit('gpu');refreshTags();notify();redraw();return gpuSelection;
    }
    function pickGpu(options){
      const selection=selectGpu(options);
      if(selection)onGpuPick?.(selection);
      return Boolean(selection);
    }
    function clearGpuSelection(){
      if(!gpuSelection)return;
      gpuSelection=null;setActivity();refreshTags();notify();redraw();
    }
    function getGpuPickPoints(){
      if(!gpuSelection||!geometry)return null;
      const line=geometry.edgePoints[journey.edgeIds.at(-1)],plate=geometry.cooling?.branches[journey.gpu.id];
      const sample=(a,b,f)=>a.map((n,i)=>n+(b[i]-n)*f);
      const power=[];
      for(const i of [3,2,4,1]){
        for(const f of [.55,.26,.80])power.push(sample(line[i],line[i+1],f));
      }
      const cooling=plate?[geometry.anchors[plate.plate.id],...plate.chipReturn.slice(1,5)]:[];
      return {gpuId:gpuSelection.gpuId,power,cooling};
    }
    function applySlot(n){
      gpuSelection=null;journey=null;livePlan=null;liveModel=null;coolingStop=null;rig.cooling=false;rig.boardServerId=null;slot=n;trace=GridRackCircuit.trace(rig.topology,n);step='psu';view='rack';open=true;extended=true;
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
      gpuSelection=null;pendingSlot=null;if(key!=='rowdist')open=true;
      step=key;view=key==='rowdist'?'circuit':'rack';tourAt=0;
      setActivity();fit(key);refreshTags();notify();redraw();
    }
    function toggleView(){
      if(!rig||closing)return;if(!trace)applySlot(rig.topology.modules[0].slot);
      gpuSelection=null;tourAt=0;view=view==='rack'?'circuit':'rack';step=view==='rack'?'psu':'circuit';
      setActivity();fit(view);refreshTags();notify();redraw();
    }
    function toggleDoor(){
      if(!rig||closing)return;open=!open;tourAt=0;pendingSlot=null;
      if(!open){
        gpuSelection=null;extended=false;view='rack';step='rack';
        if(rig.cooling){coolingStop=livePlan.stops.find(s=>s.key==='rack'&&s.medium===coolingStop?.medium);setActivity();}
        else setActivity();
        fit();
      }
      refreshTags();notify();redraw();
    }
    function toggleExtract(){if(!rig||closing)return;if(!trace){selectSlot(rig.topology.modules[0].slot);return;}tourAt=0;extended=!extended;if(extended)open=true;notify();redraw();}
    function clear(restore=false){
      if(!rig)return;
      gpuSelection=null;rig=null;geometry=null;trace=null;journey=null;livePlan=null;liveModel=null;coolingStop=null;slot=null;closing=false;tourAt=0;pendingSlot=null;
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
      const part=geometry.cooling?.partById.get(object.nodeId);
      if(gpuSelection){
        const thermal=geometry.cooling?.branches[gpuSelection.gpuId];
        const route=journey.edgeIds.includes(object.nodeId)?'power':thermal?.returnIds.includes(object.nodeId)?'cooling':null;
        if(route){onGpuTrace?.(route,gpuSelection);return true;}
      }
      if(part?.key==='gpu')return pickGpu({serverNumber:journey.server.number,gpuNumber:part.gpuNumber});
      if(rig.cooling){
        if(part)return inspectCoolant(part);
        const gpu=rig.topology.gpus.find(n=>n.id===object.nodeId);
        if(gpu){
          const tray=rig.topology.servers.find(n=>n.id===gpu.serverId);
          return pickGpu({serverNumber:tray.number,gpuNumber:gpu.number});
        }
        const server=rig.topology.servers.find(n=>n.id===object.nodeId);
        if(server)return inspectCoolant({key:'server',medium:'supply',serverNumber:server.number});
        if(object.key==='rack')return inspectCoolant({key:'rack',medium:coolingStop?.medium||'supply'});
      }
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
    return {enter,clear,leave,tick,hit,getJourneyPlan,prepareJourney,setJourneyStep,getCoolingJourneyPlan,prepareCoolingJourney,setCoolingStep,
      selectGpu,clearGpuSelection,getGpuSelection:()=>gpuSelection,getGpuPickPoints,selectSlot,toggleDoor,toggleExtract,toggleView,focusStep,positionTags,
      get rig(){return rig;},cancelTour(){tourAt=0;}};
  }
  window.GridRackView={mount};
})();
