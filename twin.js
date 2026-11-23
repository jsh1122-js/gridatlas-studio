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
  function mount({onLoad,onInspect,onPlan,onMix,onPreload}) {
    let project, metrics, campus, territory, locationKey, request, nearData;
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
    let tourConfig='';
    const geometryConfig=p=>JSON.stringify([p.id,p.config.architecture,p.config.cooling,p.config.it,p.config.pue,p.config.density,p.spacePlan,p.rackStudy,p.rackMix]);
    const tour=GridPowerTour.mount($('power-tour'),{
      onPrepare:()=>{
        const branch={slot:rackState?.slotId||1,serverNumber:rackState?.serverNumber,gpuNumber:rackState?.gpuNumber};
        tourConfig=geometryConfig(project);
        if(observing)clearObservation(false);
        if(mode!=='campus')changeMode('campus');
        return campus?.preparePowerTour({yardUnit,...branch})||[];
      },
      onTravel:request=>{
        if(observing)clearObservation(false);
        const room=request.step.scope!=='yard';
        if(mode!==(room?'cutaway':'campus'))changeMode(room?'cutaway':'campus');
        visual.classList.add('tw-following');
        $('scene-source').textContent='亮线沿本方案建模导体行进，设备内部的虚线表示能量变换';
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
      onInspect:inspectTourStop
    });
    function stopForInspection(){
      if(!tour.getState().active)return;
      tour.interrupt('inspect');visual.classList.remove('tw-following');campus?.haltPowerTour(true);
    }
    function inspectTourStop(step){
      stopForInspection();
      if(step.scope==='rack'){
        if(mode!=='cutaway')changeMode('cutaway');
        campus?.inspectTourLoad(step);
      }else if(step.key==='hall-entry'){
        changeMode('cutaway');selectCampus('it');
      }else observe(step.key);
    }
    function userInteracted(event){
      if(event.target.closest('#tw-power-tour,#tw-tour-open,.tw-tour-pin,#tw-expand'))return;
      if(event.type==='keydown'&&!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Home','Escape','Enter',' '].includes(event.key))return;
      stopForInspection();
    }
    for(const type of ['pointerdown','click','keydown','wheel'])visual.addEventListener(type,userInteracted,{capture:true,passive:true});
    $('tour-open').onclick=()=>tour.start({speakIfAvailable:true});
    function showLayout(on){
      layoutActive=on;$('layout').setAttribute('aria-pressed',String(on));
      modeButtons.find(b=>b.dataset.twinMode==='campus').setAttribute('aria-pressed',String(!on&&mode==='campus'));
      if(on)$('scene-source').textContent='点机房编号可进入剖视，室外机组台数为示意';
      else if(mode==='campus')$('scene-source').textContent=campusNote;
    }
    function openLayout(){
      if(tour.getState().active)tour.close();
      if(observing)clearObservation();
      changeMode('campus');selectCampus(null);campus?.setLayoutView(true);
    }
    $('layout').onclick=()=>layoutActive?campus?.setLayoutView(false):openLayout();
    const overlay=GridDeviceOverlay.mount($('device-ink'),key=>observe(key));
    const panel=GridDeviceLinks.mount($('device-panel'),{
      onSelect:key=>observe(key),onBack:()=>{
        if(observing){
          const yard=outside(observing.key);
          clearObservation();
          if(yard)changeMode('campus');
        }else if(rackState)campus?.closeRack();
      },
      onPreview:link=>{
        if(paintingPanel)return;
        previewing=link;overlay.preview(link);
        if(!observing&&rackState&&link){
          const next=rackState.slotId?'psu':'rack';observe(next,{preview:link});
        }else if(observing){
          if(observing.key.startsWith('cooling-unit-')&&mode==='campus')changeMode('cutaway',true);
          closeView=false;panel.setCloseView(false);frameObservation();
        }
      },
      onView:(near,d)=>{
        if(!observing)observe(d.key);
        if(d.key.startsWith('cooling-unit-'))changeMode(near?'campus':'cutaway',true);
        closeView=near;panel.setCloseView(near);frameObservation();
      },
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
    function configForDevice(){
      const units=Math.min(4,Math.max(2,Math.round(2+Math.log2(metrics.facility/80))));
      yardUnit=Math.min(yardUnit,units);
      const coolingUnits=GridCampus.coolingUnitCount(project.config);coolingUnit=Math.min(coolingUnit,coolingUnits);
      return {architecture:project.config.architecture,cooling:project.config.cooling,yardUnits:units,yardUnit,coolingUnits,coolingUnit,
        profile:rackState?.rack.profile??GridRackStudy.clean(project.rackStudy).profile};
    }
    function updateProjection(){
      if(!observing||!campus)return;
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
      const unit=/^sub-transformer(?:-([2-4]))?$/.exec(key);
      if(unit)yardUnit=Number(unit[1]||1);
      const plant=/^cooling-unit-(\d+)$/.exec(key);if(plant)coolingUnit=Number(plant[1]);
      const cfg=configForDevice(),d=GridDeviceLinks.describe(key,cfg);if(!d)return;
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
      guideHost.hidden=!state;visual.classList.toggle('tw-rack-active',Boolean(state));
      guide.update(state);
      if(state){
        if(observing)clearObservation(false);
        if(!previous||Boolean(previous.slotId)!==Boolean(state.slotId))panel.update(state.slotId?'psu':'rack',configForDevice());
      }else if(!observing)panel.clear();
    }
    function inspectTarget(key){
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
        territory: [project.location.label, '点选区域图中的变电站可查看电压、距场址的直线距离和地图原始记录。']
      };
      const detail = showingStation
        ? [station.name || '未标注站名的变电站', (station.voltage || '电压未标注') + ' · 距场址 ' + distance(station.distanceKm) + ' · OSM ' + station.id + (station.lifecycle ? ' · ' + station.lifecycle : '')]
        : descriptions[mode === 'territory' ? mode : selected || 'campus'];
      const campusFocus = Boolean(selected && mode !== 'territory');
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
      $('object-kind').textContent = showingStation ? 'OSM 设施' : mode === 'territory' ? '选定场址' : '方案模型';
      const link = $('object-link');
      link.hidden = !(showingStation && /^https:\/\/(?:www\.)?openstreetmap\.org\//.test(station.url));
      if (link.hidden) link.removeAttribute('href'); else link.href = station.url;
      objectButtons.forEach(button => button.setAttribute('aria-pressed', String(mode !== 'territory' && selected === button.dataset.object)));
    };
    function selectCampus(key) {
      if (key && !['it','cooling','power'].includes(key)) return;
      selected = key || null;
      campus?.setSelected(selected);
      renderDetails();
    }
    function selectStation(row) {
      station = row || null;
      renderDetails();
      for (const button of $('stations').children) button.setAttribute('aria-pressed', String(button.dataset.id === station?.id));
    }
    function renderScene() {
      const regional = mode === 'territory';
      $('territory').hidden = !regional;
      $('campus').hidden = regional;
      modeButtons.forEach(btn => btn.setAttribute('aria-pressed', String(mode === btn.dataset.twinMode)));
      if (regional) {
        campus?.destroy();
        campus = null;
        const entering = !territory;
        if (entering) territory = GridTerritory.mount($('territory'), {onSelect: selectStation});
        territory.update({project, metrics, stations: nearData});
        territory.setPlaying?.(playing);
        if (entering && station) territory.focusStation(station);
      } else {
        territory?.destroy();
        territory = null;
        if (!campus) campus = GridCampus.mount($('campus'), {onRackChange:syncRack,onProjectionChange:updateProjection,onTourInspect:inspectTourStop,onLayoutChange:showLayout,onHallChange:()=>clearObservation(false),onSelect:selectCampus,onInspect:inspectTarget,onOpenHall:()=>{selectCampus('it');changeMode('cutaway');}});
        campus.update({project, metrics});
        campus.setPlaying?.(playing);
        campus.setMode(mode);
        campus.setCircuit?.(planner.getCircuit());
        campus.setSelected(selected);
      }
      if(!observing)$('scene-source').textContent = {campus:campusNote, cutaway:'机柜为代表性示意，规划数量按方案折算', territory:'设施位置来自 OSM，距离按场址至站点代表点计算'}[mode];
      planner.renderRoutes(mode);
      if(layoutActive)showLayout(true);
      renderDetails();
    }
    function changeMode(nextMode,keepObservation=false) {
      if (mode !== nextMode) {
        if(layoutActive)campus?.setLayoutView(false);
        if(nextMode==='territory'&&tour.getState().active)tour.close();
        if(observing&&!keepObservation)clearObservation();
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
      territory?.update({project, metrics, stations:null});
      GridNearby.find(lat,lon,{radiusKm:15,limit:1000,signal:controller.signal}).then(data => {
        if (active && !controller.signal.aborted) { nearData = data; renderStations(); territory?.update({project, metrics, stations: data}); }
      }).catch(() => {
        if (active && !controller.signal.aborted) { nearData = {status:'unavailable',rows:[]}; renderStations(); territory?.update({project, metrics, stations:nearData}); }
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
    modeButtons.forEach(btn => btn.onclick = () => {if(layoutActive)campus?.setLayoutView(false);if(observing)clearObservation();changeMode(btn.dataset.twinMode);});
    objectButtons.forEach(btn => btn.onclick = () => {
      if (mode === 'territory') changeMode('campus');
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
      observe,openLayout,startPowerTour:()=>tour.start(),getShareHash(){return observing?'#twin/device/'+observing.key:tour.getState().active?'#twin/tour':layoutActive?'#twin/layout':rackState?'#twin/rack':'#twin';},
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
        beforeInspection=null;if(rackState)guide.update(rackState);overlay.setPlaying(playing);
        campus?.setPlaying?.(playing); territory?.setPlaying?.(playing);
      },
      update(nextProject) {
        active = true;
        if(tour.getState().active&&tourConfig!==geometryConfig(nextProject))tour.close();
        const projectChanged = project?.id !== nextProject.id;
        project = nextProject;
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
        tour.close();
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
