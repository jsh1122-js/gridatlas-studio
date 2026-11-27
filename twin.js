(() => {
  'use strict';
  const $ = id => document.getElementById('tw-' + id);
  const campusNote='园区为规划示意，室外机组台数仅供展示';
  const number = (n, digits = 2) => Number.isFinite(n) ? n.toLocaleString('zh-CN', {maximumFractionDigits: digits}) : '—';
  const distance = n => n < 1 ? Math.round(n * 1000) + ' m' : n.toFixed(2) + ' km';
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function mount({onLoad,onInspect,onPlan,onMix,onPreload,onGridPlan,onSetLocation}) {
    let project, metrics, campus, territory, gridEditor, locationKey, request, nearData;
    let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mode = 'campus', selected = null, station = null, active = false;
    const modeButtons = [...document.querySelectorAll('[data-twin-mode]')];
    const objectButtons = [...document.querySelectorAll('[data-object]')];
    const guideHost=$('rack-guide');
    const guide=GridRackGuide.mount(guideHost,{
      onSlot:slot=>campus?.selectRackSlot(slot),onBack:()=>campus?.closeRack(),
      onToggleView:()=>campus?.toggleRackView(),onStep:step=>campus?.focusRackStep(step),
      onToggleDoor:()=>campus?.toggleRackDoor(),onToggleExtract:()=>campus?.toggleRackExtract()
    });
    let observing=null,rackState=null,watchRevision=0,observationConfig='',previewing=null,closeView=false,yardUnit=1,coolingUnit=1,layoutActive=false,paintingPanel=false;
    const outside=key=>key.startsWith('sub-')||key.startsWith('cooling-unit-');
    const visual=document.querySelector('.tw-visual');
    const coolingPicker=$('cooling-picker'),unitSelect=$('cooling-start-unit'),coolingInspect=$('cooling-inspect');
    let tourConfig='',tourKind='power',tourOrigin=1,tourBranch={};
    let gpuTarget=null,gpuConfig='';
    const gpuPanel=$('gpu-trace'),gpuPower=$('gpu-power'),gpuCooling=$('gpu-cooling');
    const reverseTour=()=>tourKind==='gpu-power'||tourKind==='gpu-cooling';
    const geometryConfig=p=>JSON.stringify([p.id,p.config.architecture,p.config.cooling,p.config.it,p.config.pue,p.config.density,p.spacePlan,p.rackStudy,p.rackMix,p.gridConnection?.station]);
    const tour=GridPowerTour.mount($('power-tour'),{
      onPrepare:()=>{
        tourConfig=geometryConfig(project);
        if(observing)clearObservation(false);
        if(reverseTour())return campus?.prepareGpuTrace(gpuTarget,tourKind==='gpu-power'?'power':'cooling')||[];
        if(mode!=='campus')changeMode('campus');
        if(tourKind==='cooling')return campus?.prepareCoolingTour({coolingUnit:tourOrigin,...tourBranch})||[];
        return campus?.preparePowerTour(tourBranch)||[];
      },
      onTravel:request=>{
        if(observing)clearObservation(false);
        if(!reverseTour()&&gpuTarget)forgetGpu();
        const room=request.step.scope!=='yard';
        if(mode!==(room?'cutaway':'campus'))changeMode(room?'cutaway':'campus');
        visual.classList.add('tw-following');
        $('scene-source').textContent=reverseTour()?'点设备可暂停细看，点另一条路线可从原来的 GPU 重新出发':tourKind==='cooling'?'点设备可暂停细看，继续巡视会回到原来的管段':'亮线沿本方案建模导体行进，设备内部的虚线表示能量变换';
        return campus.followPowerTour(request);
      },
      onHalt:({reason})=>{
        if(reason==='inspect'||reason==='close'){
          visual.classList.remove('tw-following');
          campus?.haltPowerTour(true);
        }else campus?.haltPowerTour(false);
      },
      onFinish:({reason})=>{
        if(reason==='close'){
          visual.classList.remove('tw-following');campus?.haltPowerTour(true);
          if(!observing&&mode!=='territory')$('scene-source').textContent=campusNote;
        }
      },
      onChange:s=>{
        if(!gpuTarget)return;
        gpuPower.setAttribute('aria-pressed',String(s.active&&tourKind==='gpu-power'));
        gpuCooling.setAttribute('aria-pressed',String(s.active&&tourKind==='gpu-cooling'));
      },
      onInspect:inspectTourStop
    });
    function stopForInspection(){
      if(!tour.getState().active)return;
      tour.interrupt('inspect');visual.classList.remove('tw-following');campus?.haltPowerTour(true);
    }
    function inspectTourStop(step){
      stopForInspection();
      if(step.scope==='rack'||(step.medium==='supply'&&step.key==='rack')){
        if(mode!=='cutaway')changeMode('cutaway');
        if(campus?.inspectTourLoad(step)&&step.key==='gpu'&&!reverseTour()&&rackState){
          const {hallIndex,rackIndex,serverNumber,gpuNumber,slotId}=rackState;
          showGpu({hallIndex,rackIndex,serverNumber,gpuNumber,slot:slotId||undefined});
        }
      }else if(step.key==='hall-entry'){
        changeMode('cutaway');selectCampus('it');
      }else observe(step.key);
    }
    function userInteracted(event){
      if(event.target.closest('#tw-power-tour,#tw-tour-open,#tw-cooling-tour-open,#tw-device-cooling-tour,#tw-cooling-picker,#tw-gpu-trace,#tw-gpu-open,.tw-tour-pin,#tw-expand'))return;
      // A canvas pick runs on pointerup. The subsequent compatibility click
      // belongs to that same gesture and must not pause a newly started tour.
      if(event.type==='click'&&event.detail>0)return;
      if(event.type==='keydown'&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Home','Escape','Enter',' '].includes(event.key))return;
      stopForInspection();
    }
    for(const type of ['pointerdown','click','keydown','wheel'])visual.addEventListener(type,userInteracted,{capture:true,passive:true});
    function endChoosing(){
      coolingPicker.hidden=true;$('cooling-tour-open').setAttribute('aria-expanded','false');
    }
    function forgetGpu(){
      gpuTarget=null;gpuConfig='';gpuPanel.hidden=true;delete gpuPanel.dataset.gpu;
      visual.classList.remove('tw-gpu-selected');
      campus?.clearGpuTrace?.();
    }
    function rememberGpu(target){
      if(!target?.gpuId)return false;
      const previous=gpuTarget;
      const {yardUnit,coolingUnit}=configForDevice();
      const next={yardUnit,coolingUnit,...target};
      if(previous&&reverseTour()&&tour.getState().active&&
          ['gpuId','slot','yardUnit','coolingUnit'].some(key=>previous[key]!==next[key]))tour.close();
      gpuTarget=next;gpuConfig=geometryConfig(project);
      campus?.setGpuContext?.(gpuTarget);
      gpuPanel.hidden=false;gpuPanel.dataset.gpu=target.gpuId;
      gpuPanel.querySelector('code').textContent=target.gpuId;
      const server=target.gpuId.split('-').at(-2),chip=target.gpuId.split('-').at(-1);
      gpuPanel.querySelector('h3').textContent=(server.startsWith('S')?'服务器 ':'计算托盘 ')+server.slice(1)+' · GPU '+chip.slice(1);
      $('gpu-hint').textContent=target.hasCooling?'点金色供电线追到变电站，点蓝绿色冷板沿回液管追到冷却机组。':'当前方案没有为这颗 GPU 建模冷板回液支路，可以沿供电线查看上游设备。';
      gpuPower.disabled=false;gpuCooling.disabled=!target.hasCooling;
      $('gpu-return').hidden=false;$('gpu-default').hidden=true;
      const active=tour.getState().active;
      gpuPower.setAttribute('aria-pressed',String(active&&tourKind==='gpu-power'));
      gpuCooling.setAttribute('aria-pressed',String(active&&tourKind==='gpu-cooling'));
      visual.classList.add('tw-gpu-selected');
      return true;
    }
    function showGpu(target){
      if(reverseTour()&&tour.getState().active)tour.close();
      else stopForInspection();
      endChoosing();
      if(observing)clearObservation(false);
      changeMode('cutaway');
      const {yardUnit,coolingUnit}=configForDevice();
      const selection=campus?.openGpuTrace({yardUnit,coolingUnit,...target});
      if(rememberGpu(selection))return true;
      forgetGpu();
      gpuPanel.hidden=false;gpuPanel.dataset.gpu='';
      gpuPanel.querySelector('h3').textContent='当前方案未找到这颗 GPU 或所选支路';
      gpuPanel.querySelector('code').textContent=target?.gpuId||'';
      $('gpu-hint').textContent='可以查看当前方案中的一颗 GPU。';
      gpuPower.disabled=true;gpuCooling.disabled=true;
      $('gpu-return').hidden=true;$('gpu-default').hidden=false;
      return false;
    }
    function startGpuRoute(kind,selection){
      if(kind!=='power'&&kind!=='cooling')return;
      if(selection&&(!gpuTarget||gpuTarget.gpuId!==selection.gpuId||gpuTarget.slot!==selection.slot))rememberGpu(selection);
      if(!gpuTarget||(kind==='cooling'&&!gpuTarget.hasCooling))return;
      if(tour.getState().active)tour.close();
      endChoosing();tourKind='gpu-'+kind;
      tour.setNarrative(tourKind,gpuTarget.gpuId);
      return tour.start({speakIfAvailable:true});
    }
    $('gpu-open').onclick=()=>showGpu(gpuTarget);
    gpuPower.onclick=()=>startGpuRoute('power');gpuCooling.onclick=()=>startGpuRoute('cooling');
    $('gpu-return').onclick=()=>{
      if(reverseTour()&&tour.getState().active)tour.close();
      if(gpuTarget)showGpu(gpuTarget);
    };
    $('gpu-default').onclick=()=>showGpu();
    $('gpu-close').onclick=()=>{
      if(reverseTour()&&tour.getState().active)tour.close();
      forgetGpu();
    };
    function chooseCoolingOrigin(hint){
      if(!gpuPanel.hidden)forgetGpu();
      if(tour.getState().active)tour.close();
      if(observing)clearObservation();
      changeMode('campus');
      if(!layoutActive)campus?.reset();
      const count=GridCampus.coolingUnitCount(project.config);
      unitSelect.replaceChildren(new Option('选择机组',''),...Array.from({length:count},(_,i)=>
        new Option('室外冷却机组 '+String(i+1).padStart(2,'0'),String(i+1))));
      coolingPicker.querySelector('label').textContent=hint||'点一台室外机组开始讲解，也可按编号选择';
      coolingPicker.hidden=false;$('cooling-tour-open').setAttribute('aria-expanded','true');
    }
    function startTour(kind,unit,speakIfAvailable){
      if(!gpuPanel.hidden)forgetGpu();
      const state=tour.getState();
      if(kind==='cooling'&&(!Number.isInteger(unit)||unit<1||unit>GridCampus.coolingUnitCount(project.config))){
        chooseCoolingOrigin('当前方案没有该编号，请选择一台已建模的室外机组');
        return;
      }
      endChoosing();
      if(state.active&&(kind!==tourKind||kind==='cooling'&&unit!==tourOrigin))tour.close();
      if(!tour.getState().active||state.status==='complete'||state.status==='error'){
        tourKind=kind;tourOrigin=unit;
        tourBranch={yardUnit,slot:rackState?.slotId||1,serverNumber:rackState?.serverNumber,gpuNumber:rackState?.gpuNumber};
        if(kind==='cooling')coolingUnit=unit;
        tour.setNarrative(kind,kind==='cooling'?'室外机组 '+String(unit).padStart(2,'0'):'');
      }
      return tour.start({speakIfAvailable});
    }
    $('tour-open').onclick=()=>startTour('power',null,true);
    $('cooling-tour-open').onclick=()=>{
      if(!coolingPicker.hidden){endChoosing();return;}
      if(observing?.key.startsWith('cooling-unit-'))startTour('cooling',observing.coolingUnit,true);
      else chooseCoolingOrigin();
    };
    $('cooling-pick-cancel').onclick=()=>{endChoosing();$('cooling-tour-open').focus({preventScroll:true});};
    unitSelect.onchange=()=>{if(unitSelect.value)startTour('cooling',Number(unitSelect.value),true);};
    function showLayout(on){
      layoutActive=on;
      const review=$('layout-review');review.hidden=!on;
      if(on&&campus){
        const r=campus.getLayoutReview(),spec=project.gridConnection?.station;
        review.querySelector('[data-layout-counts]').textContent='规划 '+number(r.halls,0)+' 间、'+number(r.racks,0)+' 柜。图中展开 '+r.shown+' 间、'+r.shownRacks+' 个代表柜，标出环路、服务路和出入口。';
        review.querySelector('[data-layout-emergency]').textContent=r.emergency.note;
        const yard=spec?spec.highKV+'/'+spec.lowKV+' kV，规划 '+spec.units+' 台 × '+spec.unitMVA+' MVA':'展示 '+r.mainUnits+' 台代表主变';
        review.querySelector('[data-layout-systems]').textContent='自建站'+(spec?'规格为':'')+yard+'，图内机房对应 '+r.hallFeeders+' 条园区馈线。'+(r.liquidRacks?r.liquidRacks+' 个液冷代表柜接入对应机房的 CDU。':'本图按风冷末端展示散热。');
      }
      $('layout').setAttribute('aria-pressed',String(on));
      modeButtons.find(b=>b.dataset.twinMode==='campus').setAttribute('aria-pressed',String(!on&&mode==='campus'));
      if(on)$('scene-source').textContent='点机房编号可进入剖视，室外机组台数为示意';
      else if(mode==='campus')$('scene-source').textContent=campusNote;
    }
    function openLayout(){
      if(!gpuPanel.hidden)forgetGpu();
      if(tour.getState().active)tour.close();
      if(observing)clearObservation();
      changeMode('campus');selectCampus(null);campus?.setLayoutView(true);
    }
    $('layout-emergency').onclick=()=>campus?.showEmergency();
    $('layout').onclick=()=>layoutActive?campus?.setLayoutView(false):openLayout();
    const overlay=GridDeviceOverlay.mount($('device-ink'),key=>observe(key),showCoolingParts);
    const panel=GridDeviceLinks.mount($('device-panel'),{
      onCoolingTour:unit=>startTour('cooling',unit,true),
      onSelect:key=>observe(key),onBack:()=>{
        if(observing){
          const yard=outside(observing.key);
          clearObservation();
          if(yard)changeMode('campus');
        }else if(rackState)campus?.closeRack();
      },
      onPreview:link=>{
        if(paintingPanel)return;
        closeCoolingParts();
        previewing=link;overlay.preview(link);
        if(!observing&&rackState&&link){
          const next=rackState.slotId?'psu':'rack';observe(next,{preview:link});
        }else if(observing){
          if(observing.key.startsWith('cooling-unit-')&&mode==='campus')changeMode('cutaway',true);
          closeView=false;panel.setCloseView(false);frameObservation();
        }
      },
      onView:(near,d)=>{
        closeCoolingParts();
        if(!observing)observe(d.key);
        if(d.key.startsWith('cooling-unit-'))changeMode(near?'campus':'cutaway',true);
        closeView=near;panel.setCloseView(near);frameObservation();
      },
      onParts:()=>coolingDetail.isOpen()?closeCoolingParts():showCoolingParts(),
      onDetail:(target,d)=>{
        if(d.key==='rack'||d.key==='psu'){
          if(mode!=='cutaway')changeMode('cutaway');
          if(rackState && d.key==='psu')campus?.selectRackSlot(rackState.slotId||1);
          else campus?.openRack(d.key==='psu'?1:null);
          return;
        }
        const revision=watchRevision;onInspect(target,{inPlace:true,valid:()=>revision===watchRevision});
      }
    });
    const coolingDetail=GridCoolingDetail.mount({stage:visual.querySelector('.tw-stage'),panel:panel.partsHost,
      onSelect:updateProjection,onClose:closeCoolingParts});
    function showCoolingParts(){
      if(!observing?.key.startsWith('cooling-unit-'))return;
      if(coolingDetail.isOpen())return;
      if(mode!=='campus')changeMode('campus',true);
      closeView=true;panel.setCloseView(true);frameObservation();
      $('device-ink').hidden=true;
      panel.partsHost.hidden=false;panel.setPartsOpen(true);
      coolingDetail.open(observing.title);
      $('scene-source').textContent='点部件标记可查看风机、换热面和水管接口';
      updateProjection();
    }
    function closeCoolingParts(){
      if(!coolingDetail.isOpen())return;
      coolingDetail.close();panel.partsHost.hidden=true;panel.setPartsOpen(false);
      $('device-ink').hidden=!observing;
      if(observing){
        $('scene-source').textContent='连线表示设备间的功能关系与传递方向';
        updateProjection();
      }
    }
    function configForDevice(){
      const units=GridCampus.yardUnitCount(project,metrics.facility);
      yardUnit=Math.min(yardUnit,units);
      const coolingUnits=GridCampus.coolingUnitCount(project.config);coolingUnit=Math.min(coolingUnit,coolingUnits);
      return {architecture:project.config.architecture,cooling:project.config.cooling,yardUnits:units,yardSpec:project.gridConnection?.station,yardUnit,coolingUnits,coolingUnit,
        profile:rackState?.rack.profile??GridRackStudy.clean(project.rackStudy).profile};
    }
    function updateProjection(){
      if(!observing||!campus)return;
      if(coolingDetail.isOpen()){
        coolingDetail.updateProjection(campus.getCoolingPartProjection(observing.key));
        return;
      }
      overlay.draw(keys=>campus.getEquipmentProjection(keys));
    }
    function paintObservation(d){
      paintingPanel=true;
      try{panel.update(d.key,configForDevice());}finally{paintingPanel=false;}
      overlay.update(d);overlay.setPlaying(playing);
      visual.classList.add('tw-observing');
      $('scene-source').textContent='连线表示设备间的功能关系与传递方向';updateProjection();
    }
    function clearObservation(restore=true){
      closeCoolingParts();
      ++watchRevision;observing=null;previewing=null;closeView=false;panel.clear();overlay.update(null);visual.classList.remove('tw-observing');
      if(restore)campus?.clearEquipmentFocus();
      if(mode!=='territory')$('scene-source').textContent=mode==='cutaway'?'机柜为代表性示意，规划数量按方案折算':campusNote;
    }
    function frameObservation(){
      if(!observing)return;
      const links=previewing?[previewing]:observing.links.filter(l=>l.kind!=='reference');
      const peers=closeView?[]:[...new Set(links.map(l=>l.key))];
      campus?.moveToEquipment(observing.key,{peers});
    }
    function observe(input,options={}){
      if(!project)return;
      if(typeof input!=='string')return;
      if(tour.getState().active)stopForInspection();
      const k=input.split('/')[0];
      const key=GridDeviceLinks.resolveSceneKey(k==='power'?'sub-transformer':k,configForDevice());
      if(!coolingPicker.hidden&&key.startsWith('cooling-unit-')){
        startTour('cooling',Number(key.slice(13)),true);return;
      }
      const unit=/^sub-transformer(?:-([2-4]))?$/.exec(key);
      if(unit)yardUnit=Number(unit[1]||1);
      const plant=/^cooling-unit-(\d+)$/.exec(key);if(plant)coolingUnit=Number(plant[1]);
      const cfg=configForDevice(),d=GridDeviceLinks.describe(key,cfg);if(!d)return;
      closeCoolingParts();
      const peers=[...new Set(d.links.filter(link=>link.kind!=='reference').map(link=>link.key))];
      const openRoom=!outside(key)||(!plant&&peers.some(p=>!outside(p)));
      if(mode==='territory')changeMode(openRoom?'cutaway':'campus');
      else if(openRoom&&mode==='campus')changeMode('cutaway');
      else if(plant&&mode==='cutaway')changeMode('campus');
      ++watchRevision;observing=d;previewing=options.preview||null;
      closeView=Boolean(plant);observationConfig=JSON.stringify(cfg);paintObservation(d);panel.setCloseView(closeView);if(previewing)overlay.preview(previewing);
      frameObservation();
    }
    function syncRack(state){
      const previous=rackState;rackState=state;
      const playback=tour.getState();
      const inspectedPlate=state?.gpuSelection&&tourKind==='cooling'&&playback.status==='paused'&&playback.step?.key==='gpu'?playback.step:null;
      const cooling=Boolean(state?.cooling||inspectedPlate),stop=state?.coolingStop||inspectedPlate;
      guideHost.hidden=!state||cooling;visual.classList.toggle('tw-rack-active',Boolean(state));
      guide.update(cooling?null:state);
      coolingInspect.hidden=!cooling||!stop;
      if(!coolingInspect.hidden){
        coolingInspect.querySelector('h3').textContent=stop.title;
        coolingInspect.querySelector('code').textContent=stop.nodeId||'';
        coolingInspect.querySelector('p').textContent=stop.text;
      }
      if(state){
        if(observing)clearObservation(false);
        if(cooling)panel.clear();
        else if(!previous||previous.cooling||Boolean(previous.slotId)!==Boolean(state.slotId))panel.update(state.slotId?'psu':'rack',configForDevice());
      }else if(!observing)panel.clear();
    }
    function inspectTarget(key){
      if(key===observing?.key&&key?.startsWith('cooling-unit-')){showCoolingParts();return;}
      if(mode==='cutaway' && (key==='psu'||key==='rack'||key?.startsWith('rack:'))){campus?.openRack(key==='psu'?1:null);return;}
      observe(key);
    }
    const planner=GridTwinPlan.mount({onApply:onPlan,onMix,onInspect:inspectTarget,onCircuit:key=>{if(observing)clearObservation();campus?.setCircuit?.(key);}});
    const renderDetails = () => {
      const config = project.config;
      const showingStation = mode === 'territory' && station;
      const descriptions = {
        it: ['IT 机房', number(config.it) + ' MW 设计 IT 功率，按 ' + number(config.density) + ' kW/柜折算，预计配置 ' + number(metrics.racks, 0) + ' 柜。'],
        cooling: [config.cooling, '方案采用' + config.cooling + '。当前工况下，制冷和其他辅助设施合计 ' + number(metrics.average - config.it * config.load / 100) + ' MW。'],
        power: [config.architecture + ' 供配电', '设施设计峰值为 ' + number(metrics.facility) + ' MW，当前工况年均负荷为 ' + number(metrics.average) + ' MW。'],
        campus: ['园区总体方案', number(config.it) + ' MW 设计 IT 功率，采用' + config.architecture + '和' + config.cooling + '。点选模型中的建筑或设备可查看参数。'],
        cabinets: ['清单机房','机柜、U 位和端口根据所选 AIDC 清单分配。可按柜号查看，也可直接选择一台交换机或存储设备。'],
        territory: [project.location.label, '点选区域图中的变电站可查看电压、距场址的直线距离和地图原始记录。']
      };
      const detail = showingStation
        ? [station.name || '未标注站名的变电站', (station.voltage || '电压未标注') + ' · 距场址 ' + distance(station.distanceKm) + (station.source==='manual'?' · 手动录入':' · OSM '+station.id) + (station.lifecycle ? ' · ' + station.lifecycle : '')]
        : descriptions[mode === 'territory' || mode==='cabinets' ? mode : selected || 'campus'];
      const campusFocus = Boolean(selected && mode !== 'territory' && mode !== 'cabinets');
      $('scene-detail').hidden = !campusFocus;
      if (campusFocus) {
        $('focus-name').textContent = detail[0];
        $('focus-value').textContent = {
          it: number(config.it) + ' MW · ' + number(metrics.racks,0) + ' 柜',
          cooling: '方案 PUE ' + number(config.pue,3),
          power: '设施峰值 ' + number(metrics.facility) + ' MW'
        }[selected];
      }
      $('drill').hidden = !campusFocus;
      $('drill').textContent = selected==='it' && mode==='campus' ? '进入机房剖视 ›' : '查看设备内部 ›';
      $('object-name').textContent = detail[0];
      $('object-description').textContent = detail[1];
      $('object-kind').textContent = showingStation ? (station.source==='manual'?'录入站点':'OSM 设施') : mode === 'territory' ? '选定场址' : '方案模型';
      const link = $('object-link');
      link.hidden = !(showingStation && /^https:\/\/(?:www\.)?openstreetmap\.org\//.test(station.url));
      if (link.hidden) link.removeAttribute('href'); else link.href = station.url;
      objectButtons.forEach(button => button.setAttribute('aria-pressed', String(mode !== 'territory' && mode !== 'cabinets' && selected === button.dataset.object)));
    };
    function selectCampus(key) {
      if (key && !['it','cooling','power'].includes(key)) return;
      selected = key || null;
      campus?.setSelected(selected);
      renderDetails();
    }
    function selectStation(row) {
      station = row ? {...row,distanceKm:GridNearby.distance(project.location.lat,project.location.lon,row.lat,row.lon)} : null;
      gridEditor?.selectStation(station);
      renderDetails();
      for (const button of $('stations').children) button.setAttribute('aria-pressed', String(button.dataset.id === station?.id));
    }
    function updateGrid(){
      if(mode!=='territory'||!territory)return;
      const plan=GridConnection.describe(project);
      const gridPlan={site:{...project.location,name:project.location.label,voltageKV:plan.station.highKV,
        lowKV:plan.station.lowKV,transformers:plan.station.units,unitMVA:plan.station.unitMVA,configured:plan.configured},
        connections:plan.links.map(station=>({station,circuits:station.circuits,distanceKm:station.distanceKm,voltageKV:plan.station.highKV}))};
      territory.update({project,metrics,stations:nearData,gridPlan});
      gridEditor.update({project,metrics,stations:nearData});
    }
    let cabinetTarget=null,cabinetKey='',cabinetView=null,cabinetRevision=0;
    function closeCabinetRoom(){
      cabinetRevision++;cabinetKey='';cabinetView?.dispose();cabinetView=null;
      $('cabinet-room').replaceChildren();
    }
    async function renderCabinetRoom(){
      const snapshot=project.aidc,target=cabinetTarget,host=$('cabinet-room');
      const key=JSON.stringify([project.id,target,snapshot?.sceneId,snapshot?.items]);
      if(key===cabinetKey)return;
      closeCabinetRoom();cabinetKey=key;
      const revision=cabinetRevision;
      host.append(element('p','正在读取设备清单…','cr-notice'));
      try{
        const {data,byId}=await GridCabinetRoom.catalog();
        if(revision!==cabinetRevision||!active||mode!=='cabinets')return;
        const currentId=snapshot?.sceneId||data.scenes[0].id;
        const scene=data.scenes.find(s=>s.id===(target||currentId));
        if(!scene)throw new Error('未找到这个场景。');
        const saved=scene.id===snapshot?.sceneId;
        const rows=GridCabinetRoom.records(saved?snapshot.items:scene.items,byId,data.layout);
        const picker=element('select','');picker.setAttribute('aria-label','查看机房场景');
        picker.add(new Option('当前项目机房',''));
        for(const other of data.scenes)picker.add(new Option(GridCabinetRoom.title(other),other.id));
        picker.value=target||'';
        picker.onchange=()=>{location.hash='twin/cabinets'+(picker.value?'/'+picker.value:'');};
        cabinetView=GridCabinetRoom.mount(host,scene,rows,data.layout,{
          source:saved?'项目已保存清单':'场景原始清单',actions:picker,
          edit:!snapshot||scene.id===currentId?()=>{location.hash='aidc/scene/'+scene.id;}:undefined
        });
      }catch(error){
        if(revision!==cabinetRevision)return;
        host.replaceChildren(element('p',error.message||'设备清单加载失败。','cr-notice'));
        const retry=element('button',target?'打开当前项目机房':'重新加载','cr-retry');retry.type='button';
        retry.onclick=()=>{cabinetKey='';if(target)location.hash='twin/cabinets';else renderCabinetRoom();};host.append(retry);
      }
    }
    function openCabinets(target){
      cabinetTarget=target||null;
      if(mode!=='cabinets')changeMode('cabinets');else renderCabinetRoom();
    }
    function renderScene() {
      const regional = mode === 'territory', cabinets=mode==='cabinets';
      $('cabinet-room').hidden=!cabinets;visual.classList.toggle('tw-cabinets',cabinets);
      if(!cabinets&&cabinetKey)closeCabinetRoom();
      $('territory').hidden = !regional;
      $('grid-connection').hidden=!regional;
      visual.classList.toggle('tw-regional',regional);
      visual.querySelector('.tw-drag-hint').lastChild.textContent=regional?'拖动平移 · 滚轮缩放':'拖动旋转 · 滚轮缩放';
      $('campus').hidden = regional||cabinets;
      modeButtons.forEach(btn => btn.setAttribute('aria-pressed', String(mode === btn.dataset.twinMode)));
      if (cabinets) {
        campus?.destroy();campus=null;territory?.destroy();territory=null;
        renderCabinetRoom();
      } else if (regional) {
        campus?.destroy();
        campus = null;
        const entering = !territory;
        if(entering)territory=GridTerritory.mount($('territory'),{onSelect:selectStation,onSelectSite:()=>selectStation(null),onPickLocation:onSetLocation});
        if(!gridEditor)gridEditor=GridConnection.mount($('grid-connection'),{onChange:onGridPlan,onSetLocation,
          onPickSite:()=>{territory.pickSite();$('territory').scrollIntoView({block:'nearest'});},
          onFocus:row=>{selectStation(row);if(row)territory.focusStation(row);else territory.reset();}});
        updateGrid();
        territory.setPlaying?.(playing);
        if (entering && station) territory.focusStation(station);
      } else {
        territory?.destroy();
        territory = null;
        if (!campus) campus = GridCampus.mount($('campus'), {onRackChange:syncRack,onGpuPick:rememberGpu,onGpuRoute:startGpuRoute,onProjectionChange:updateProjection,onTourInspect:inspectTourStop,onLayoutChange:showLayout,onHallChange:()=>clearObservation(false),onSelect:selectCampus,onInspect:inspectTarget,onOpenHall:()=>{selectCampus('it');changeMode('cutaway');}});
        campus.update({project, metrics});
        campus.setPlaying?.(playing);
        campus.setMode(mode);
        campus.setCircuit?.(planner.getCircuit());
        campus.setSelected(selected);
      }
      if(!observing)$('scene-source').textContent = {campus:campusNote, cutaway:'机柜为代表性示意，规划数量按方案折算',cabinets:'机柜排布按 AIDC 清单生成', territory:'规划距离按场址与站点代表坐标计算，实际线路长度以勘测为准'}[mode];
      planner.renderRoutes(mode);
      if(layoutActive)showLayout(true);
      renderDetails();
    }
    function changeMode(nextMode,keepObservation=false) {
      if (mode !== nextMode) {
        if(nextMode!=='campus')endChoosing();
        if(layoutActive)campus?.setLayoutView(false);
        if(nextMode==='territory'||nextMode==='cabinets'){
          if(tour.getState().active)tour.close();
          if(!gpuPanel.hidden)forgetGpu();
        }
        if(observing&&!keepObservation)clearObservation();
        if(mode==='cabinets'&&location.hash.startsWith('#twin/cabinets')){
          const hash=nextMode==='territory'?'#twin/grid':'#twin';
          history.replaceState(history.state,'',hash);
        }
        mode = nextMode;
        if(mode==='cutaway')onPreload?.();
        if (mode !== 'territory') selectStation(null);
        renderScene();
      }
    }
    function renderStations() {
      const list = $('stations');
      list.replaceChildren();
      for (const [index, row] of (nearData?.rows || []).slice(0,3).entries()) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.id = row.id;
        btn.setAttribute('aria-pressed', String(station?.id === row.id));
        btn.append(element('span', String(index + 1).padStart(2,'0'), 'tw-rank'));
        const title = element('span', '', 'tw-station-text');
        title.append(element('b', row.name || '未标注站名'), element('small', (row.voltage || '电压未标注') + ' · OSM ' + row.id));
        btn.append(title, element('strong', distance(row.distanceKm)), element('span', '›', 'tw-arrow'));
        btn.onclick = () => {
          changeMode('territory');
          selectStation(row);
          territory?.focusStation?.(row);
          if (matchMedia('(max-width: 850px)').matches) document.querySelector('.tw-visual').scrollIntoView({block:'start'});
        };
        list.append(btn);
      }
      const status = $('station-status');
      if (!nearData) { status.textContent = '正在查询场址周边 15 km 内的变电站…'; return; }
      if (nearData.status === 'unavailable' || nearData.complete === false || nearData.status === 'partial') {
        status.textContent = nearData.status === 'unavailable' ? '周边设施数据暂不可用。' : '仅显示已取得范围内的记录。';
        const retry = element('button','重新查询');
        retry.type = 'button';
        retry.onclick = () => queryStations(true);
        status.append(retry);
      } else {
        status.textContent = nearData.rows.length ? '15 km 内收录 ' + number(nearData.totalMatched ?? nearData.rows.length,0) + ' 座 · 按直线距离排序' : '15 km 范围内暂无已收录的变电站。';
      }
    }
    function queryStations(force = false) {
      const {lat, lon} = project.location;
      const key = lat + ',' + lon;
      if (!force && key === locationKey && (nearData || request)) return;
      request?.abort();
      const controller = new AbortController();
      request = controller;
      locationKey = key;
      nearData = null;
      selectStation(null);
      renderStations();
      updateGrid();
      GridNearby.find(lat,lon,{radiusKm:15,limit:1000,signal:controller.signal}).then(data => {
        if (active && !controller.signal.aborted) { nearData = data; renderStations(); updateGrid(); }
      }).catch(() => {
        if (active && !controller.signal.aborted) { nearData = {status:'unavailable',rows:[]}; renderStations(); updateGrid(); }
      }).finally(() => { if (request === controller) request = null; });
    }
    const expanded = () => document.fullscreenElement === visual || visual.classList.contains('tw-expanded');
    function syncExpanded() {
      const full = expanded();
      $('expand').setAttribute('aria-pressed', String(full));
      $('expand').setAttribute('aria-label', full ? '退出全屏' : '全屏查看场景');
      $('expand').title = full ? '退出全屏' : '全屏查看场景';
      campus?.resize(); territory?.resize();
    }
    function exitExpanded() {
      if (document.fullscreenElement === visual) document.exitFullscreen().catch(() => {});
      visual.classList.remove('tw-expanded');
      syncExpanded();
    }
    $('expand').onclick = async () => {
      if (expanded()) { exitExpanded(); return; }
      try { await visual.requestFullscreen(); }
      catch { visual.classList.add('tw-expanded'); }
      syncExpanded();
    };
    document.addEventListener('fullscreenchange', syncExpanded);
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && visual.classList.contains('tw-expanded')) exitExpanded(); });
    $('drill').onclick = () => selected==='it' && mode==='campus' ? changeMode('cutaway') : inspectTarget(selected==='it'?'rack':selected);
    $('yard-open').onclick=()=>observe('sub-transformer');
    function showMotion(){
      overlay.setPlaying(playing);
      $('motion').textContent=playing?'Ⅱ':'▷';
      $('motion').setAttribute('aria-label',playing?'暂停演示动效':'播放演示动效');
      $('motion').title=$('motion').getAttribute('aria-label');
    }
    $('motion').onclick=()=>{playing=!playing;campus?.setPlaying?.(playing);territory?.setPlaying?.(playing);showMotion();};
    showMotion();
    modeButtons.forEach(btn => btn.onclick = () => {if(btn.dataset.twinMode==='cabinets'){if(!location.hash.startsWith('#twin/cabinets'))location.hash='twin/cabinets';else openCabinets(cabinetTarget);return;}if(layoutActive)campus?.setLayoutView(false);if(observing)clearObservation();changeMode(btn.dataset.twinMode);});
    objectButtons.forEach(btn => btn.onclick = () => {
      if (mode === 'territory'||mode==='cabinets') changeMode('campus');
      if(observing)clearObservation();
      selectCampus(btn.dataset.object);
      if(btn.dataset.object==='power')observe('sub-transformer');
      if(btn.dataset.object==='cooling')observe('cooling');
    });
    for (const btn of document.querySelectorAll('[data-camera]')) btn.onclick = () => {
      const view = mode === 'territory' ? territory : campus;
      if (btn.dataset.camera === 'home' && observing) clearObservation();
      else if (btn.dataset.camera === 'home') view?.reset(); else view?.zoomBy(btn.dataset.camera === 'in' ? 1.2 : 1 / 1.2);
    };
    $('load').addEventListener('input', event => onLoad(event.target.valueAsNumber));
    $('all-stations').addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      window.addEventListener('hashchange', () => requestAnimationFrame(() => {
        if (location.hash === '#overview') document.getElementById('nearby-radius')?.closest('section')?.scrollIntoView({block:'start'});
      }), {once:true});
    });
    let beforeInspection;
    return {
      observe,openLayout,openCabinets,leaveCabinets(){if(mode==='cabinets')changeMode('campus');},showGpu,openGrid:()=>changeMode('territory'),startPowerTour:()=>startTour('power',null,false),
      startCoolingTour:unit=>unit===null?chooseCoolingOrigin():startTour('cooling',unit,false),
      getShareHash(){
        if(mode==='cabinets')return '#twin/cabinets'+(cabinetTarget?'/'+cabinetTarget:'');
        if(mode==='territory')return '#twin/grid';
        if(gpuTarget){
          const params=new URLSearchParams();
          for(const [param,value] of [['slot',gpuTarget.slot],['plant',gpuTarget.coolingUnit],['yard',gpuTarget.yardUnit]]){
            if(Number.isSafeInteger(value)&&value>1)params.set(param,String(value));
          }
          return '#twin/gpu-trace/'+gpuTarget.gpuId+(params.size?'?'+params:'');
        }
        if(tour.getState().active&&tourKind==='cooling')return '#twin/cooling-tour/'+tourOrigin;
        if(!coolingPicker.hidden)return '#twin/cooling-tour';
        return observing?'#twin/device/'+observing.key:tour.getState().active?'#twin/tour':layoutActive?'#twin/layout':rackState?'#twin/rack':'#twin';
      },
      openRack() {stopForInspection();if(observing)clearObservation(false);changeMode('cutaway');campus?.openRack();},
      async focusEquipment(key) {
        beforeInspection ??= campus?.getViewState?.();
        if(expanded())exitExpanded();
        return campus?.focusEquipment?.(key);
      },
      inspectContext() {
        const view=campus?.getViewState?.();
        return mode==='cutaway' && view?.hallNumber ? '机房 '+String(view.hallNumber).padStart(2,'0') : (mode==='cutaway'?'机房剖视':'园区');
      },
      suspendForInspection() { stopForInspection();guide.pause?.();overlay.setPlaying(false);campus?.setPlaying?.(false); territory?.setPlaying?.(false); },
      resumeFromInspection() {
        if(beforeInspection)campus?.restoreViewState?.(beforeInspection);
        beforeInspection=null;if(rackState&&!rackState.cooling)guide.update(rackState);overlay.setPlaying(playing);
        campus?.setPlaying?.(playing); territory?.setPlaying?.(playing);
      },
      update(nextProject) {
        active = true;
        if(tour.getState().active&&tourConfig!==geometryConfig(nextProject))tour.close();
        if(!gpuPanel.hidden&&gpuConfig!==geometryConfig(nextProject))forgetGpu();
        const projectChanged = project?.id !== nextProject.id;
        project = nextProject;
        if(!coolingPicker.hidden)chooseCoolingOrigin();
        if(projectChanged&&observing)clearObservation(false);
        metrics = GridDesign.calculate(project.config);
        try {metrics.layout=GridSpacePlan.calculate(project.config,project.rackStudy,project.spacePlan);} catch {metrics.layout=null;}
        planner.update(project,metrics.layout,mode);
        if (projectChanged) { selected = null; station = null; }
        const {it, load, pue} = project.config;
        const itAverage = it * load / 100;
        const values = {place:project.location.label, name:project.name, rate:number(load,2) + '%', average:number(metrics.average), pue:number(pue,3),
          'it-load':number(itAverage), 'aux-load':number(metrics.average - itAverage), it:number(it), racks:number(metrics.racks,0), energy:number(metrics.energy,2), cost:number(metrics.cost,4)};
        for (const [id, value] of Object.entries(values)) $(id).textContent = value;
        $('load').value = load;
        $('load').setAttribute('aria-valuetext', number(load) + '%');
        $('load').style.setProperty('--rate', load + '%');
        $('gauge').style.setProperty('--rate', load + '%');
        $('it-bar').style.width = (metrics.average ? 100 / pue : 0) + '%';
        $('aux-bar').style.width = (metrics.average ? 100 - 100 / pue : 0) + '%';
        queryStations();
        renderScene();
        if(observing && JSON.stringify(configForDevice())!==observationConfig)observe(observing.key);
      },
      pause() {
        endChoosing();
        if(cabinetKey)closeCabinetRoom();
        tour.close();if(!gpuPanel.hidden)forgetGpu();
        if(layoutActive)campus?.setLayoutView(false);
        clearObservation(false);guide.pause?.();active = false; beforeInspection=null;
        if (expanded()) exitExpanded();
        request?.abort();
        request = null;
        campus?.destroy(); territory?.destroy();
        campus = territory = null;
      }
    };
  }
  window.GridTwin = {mount};
})();
