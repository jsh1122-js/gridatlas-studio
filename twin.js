(() => {
  'use strict';
  const $ = id => document.getElementById('tw-' + id);
  const number = (n, digits = 2) => Number.isFinite(n) ? n.toLocaleString('zh-CN', {maximumFractionDigits: digits}) : '—';
  const distance = n => n < 1 ? Math.round(n * 1000) + ' m' : n.toFixed(2) + ' km';
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function mount({onLoad,onInspect,onPlan,onMix}) {
    let project, metrics, campus, territory, locationKey, request, nearData;
    let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mode = 'campus', selected = null, station = null, active = false;
    const modeButtons = [...document.querySelectorAll('[data-twin-mode]')];
    const objectButtons = [...document.querySelectorAll('[data-object]')];
    const planner=GridTwinPlan.mount({onApply:onPlan,onMix,onInspect,onCircuit:key=>campus?.setCircuit?.(key)});
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
        if (!campus) campus = GridCampus.mount($('campus'), {onSelect:selectCampus,onInspect,onOpenHall:()=>{selectCampus('it');changeMode('cutaway');}});
        campus.update({project, metrics});
        campus.setPlaying?.(playing);
        campus.setMode(mode);
        campus.setCircuit?.(planner.getCircuit());
        campus.setSelected(selected);
      }
      $('scene-source').textContent = {campus:'园区建筑与设备布局为方案示意', cutaway:'机柜为代表性示意，规划数量按方案折算', territory:'设施位置来自 OSM，距离按场址至站点代表点计算'}[mode];
      planner.renderRoutes(mode);
      renderDetails();
    }
    function changeMode(nextMode) {
      if (mode !== nextMode) {
        mode = nextMode;
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
    const visual = document.querySelector('.tw-visual');
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
    $('drill').onclick = () => selected==='it' && mode==='campus' ? changeMode('cutaway') : onInspect(selected==='it'?'rack':selected);
    function showMotion(){
      $('motion').textContent=playing?'Ⅱ':'▷';
      $('motion').setAttribute('aria-label',playing?'暂停演示动效':'播放演示动效');
      $('motion').title=$('motion').getAttribute('aria-label');
    }
    $('motion').onclick=()=>{playing=!playing;campus?.setPlaying?.(playing);territory?.setPlaying?.(playing);showMotion();};
    showMotion();
    modeButtons.forEach(btn => btn.onclick = () => changeMode(btn.dataset.twinMode));
    objectButtons.forEach(btn => btn.onclick = () => {
      if (mode === 'territory') changeMode('campus');
      selectCampus(btn.dataset.object);
    });
    for (const btn of document.querySelectorAll('[data-camera]')) btn.onclick = () => {
      const view = mode === 'territory' ? territory : campus;
      if (btn.dataset.camera === 'home') view?.reset(); else view?.zoomBy(btn.dataset.camera === 'in' ? 1.2 : 1 / 1.2);
    };
    $('load').addEventListener('input', event => onLoad(event.target.valueAsNumber));
    $('all-stations').addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      window.addEventListener('hashchange', () => requestAnimationFrame(() => {
        if (location.hash === '#overview') document.getElementById('nearby-radius')?.closest('section')?.scrollIntoView({block:'start'});
      }), {once:true});
    });
    return {
      update(nextProject) {
        active = true;
        const projectChanged = project?.id !== nextProject.id;
        project = nextProject;
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
      },
      pause() {
        active = false;
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
