(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const paths = {
    drop:'M12 2c-2 4-7 9-7 13a7 7 0 0 0 14 0c0-4-5-9-7-13z M9 16c0 2 1 3 3 3',
    fan:'M12 10c-6-10 5-11 4-5l-2 6 M14 12c10-5 11 6 4 5l-5-3 M11 14c4 10-7 10-5 4l4-5 M14 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0',
    expand:'M3 9V3h6 M15 3h6v6 M21 15v6h-6 M9 21H3v-6',
    cube:'m12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
    orbit:'M8 9c-4 2-6 5-5 7 1.3 2.7 7.2 2.5 12.4-.4s8.1-7.4 6.5-9.5c-1.2-1.8-4.5-1.6-7.4-.6 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2',
    overview:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    network:'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
    library:'M3 5h6l2 2h10v12H3z', book:'M3 5q5-2 9 1 4-3 9-1v14q-5-2-9 1-4-3-9-1z M12 6v14',
    export:'M12 3v12 M8 11l4 4 4-4 M4 15v5h16v-5',import:'M12 15V3 M8 7l4-4 4 4 M4 15v5h16v-5',
    plus:'M12 5v14 M5 12h14',minus:'M5 12h14', map:'m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
    layers:'m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5',chev:'m6 9 6 6 6-6',
    target:'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
    focus:'M4 9V4h5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    cursor:'M4 3l5 16 3-6 6-3z',sliders:'M3 6h5 M12 6h9 M3 12h11 M18 12h3 M3 18h3 M10 18h11 M8 3v6 M16 9v6 M8 15v6',
    edit:'m4 20 4-1L20 7l-3-3L5 16z M14 7l3 3',pin:'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z M14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0',
    x:'M6 6l12 12 M18 6 6 18',refresh:'M4 10a8 8 0 0 1 14-4l2 3 M20 4v5h-5 M20 14a8 8 0 0 1-14 4l-2-3 M4 20v-5h5',
    info:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 11v6 M12 7v.1',bolt:'m14 2-10 12h7l-1 8 10-13h-7z',
    server:'M4 3h16v7H4z M4 14h16v7H4z M7 6.5h2 M7 17.5h2',energy:'M3 20h18 M5 16l4-5 4 2 6-9 M15 4h4v4',
    cost:'M5 4l7 8 7-8 M6 12h12 M6 16h12 M12 12v8', globe:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2c6 5 6 15 0 20-6-5-6-15 0-20',
    print:'M6 8V3h12v5 M6 17H3V8h18v9h-3 M6 14h12v7H6z'
  };
  function icons(node = document) {
    node.querySelectorAll('i[data-i]:empty').forEach(i => {
      const path = paths[i.dataset.i];
      if (path) i.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" class="ico"><path d="' + path + '"/></svg>';
    });
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  const reference = {lat:39.22415,lon:109.84495,label:'伊金霍洛旗 · 札萨克镇'};
  const key = 'gridatlas.workspace.v1';
  const createId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'p-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  function newProject(name,location=reference) {
    return {id:createId(),name,location:{...location},config:{...GridDesign.defaults},updatedAt:new Date().toISOString()};
  }
  function valid(p) {
    return p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.location?.label === 'string'
      && Number.isFinite(p.location.lat) && Math.abs(p.location.lat)<=90 && Number.isFinite(p.location.lon) && Math.abs(p.location.lon)<=180 && GridDesign.validateConfig(p.config);
  }
  let storeOK = true;
  let equipment,equipmentModule,equipmentTarget,map,design,twin,activeRoute,dialogSubmit,aidcProjectId;
  function loadState() {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(data?.projects)) {
        const projects = data.projects.filter(valid);
        if (projects.length) return {projects,current:projects.some(p=>p.id===data.current)?data.current:projects[0].id};
      }
    } catch { storeOK = false; }
    const first = newProject('鄂尔多斯选址方案');
    return {projects:[first],current:first.id};
  }
  let state = loadState();
  const current = () => state.projects.find(p=>p.id===state.current);
  function persist() {
    try { localStorage.setItem(key,JSON.stringify(state)); storeOK = true; } catch { storeOK = false; }
    $('#save-state').classList.toggle('failed',!storeOK);
    $('#save-state span').textContent = storeOK ? '已存本机' : '仅本次会话';
  }
  function energyContext() {
    const frame=$('#energy-frame');
    if(frame.hasAttribute('src'))frame.contentWindow?.postMessage({type:'gridatlas-twin-context',averageMW:GridDesign.calculate(current().config).average},location.origin);
  }
  function changed() {
    current().updatedAt=new Date().toISOString();
    persist();
    if(activeRoute==='twin')twin?.update(current());
    energyContext();
  }
  const num = (n,d=2) => n.toLocaleString('zh-CN',{maximumFractionDigits:d});
  const fmtCoord = (n,positive,negative) => Math.abs(n).toFixed(5) + '°' + (n<0?negative:positive);
  function coords(loc) {return fmtCoord(loc.lat,'N','S') + '  ' + fmtCoord(loc.lon,'E','W');}
  function notice(message) {
    const el=$('#toast');clearTimeout(notice.timer);el.textContent=message;el.hidden=false;
    notice.timer=setTimeout(()=>el.hidden=true,2600);
  }
  const metrics = [
    ['facility','设施峰值功率','MW','设计 IT 功率 × PUE','bolt','#3865dd','#eaf0ff'],
    ['racks','规划机柜数','柜','按单柜设计功率向上取整','server','#7956bd','#f1ebfc'],
    ['energy','年设施用电量','GWh','按年平均负载与 8,760 小时折算','energy','#168775','#e5f5f1'],
    ['cost','预计年电费','亿元','年设施用电量 × 到户平均电价','cost','#ac731f','#fcf2df']
  ];
  function updateMetrics() {
    const values=GridDesign.calculate(current().config);
    $('#metrics-grid').innerHTML=metrics.map(([id,title,unit,hint,icon,color,bg])=>
      '<article class="metric-card"><div class="metric-label"><span class="metric-icon" style="color:'+color+';background:'+bg+'"><i data-i="'+icon+'"></i></span>'+title+'</div><div class="metric-value"><strong>'+num(values[id],id==='cost'?4:2)+'</strong><span>'+unit+'</span></div><p class="metric-desc">'+hint+'</p></article>').join('');
    icons($('#metrics-grid'));
  }
  const quick = [['it','设计 IT 功率','MW',0],['pue','设计 PUE','',1],['load','年平均负载率','%',0],['tariff','到户平均电价','元/kWh',0]];
  $('#quick-fields').innerHTML = quick.map(([id,title,unit,min])=>'<label>'+title+'<span class="num-wrap"><input aria-label="'+title+'" type="number" inputmode="decimal" step="any" min="'+min+'" '+(id==='load'?'max="100"':'')+' data-quick="'+id+'"><span>'+unit+'</span></span></label>').join('');
  function renderMapContext(loc){
    const bounds=window.GridMapData.bounds;
    const regional=loc.lon>=bounds[0] && loc.lon<=bounds[2] && loc.lat>=bounds[1] && loc.lat<=bounds[3];
    const polar=Math.abs(loc.lat)>85.05;
    const frame=$('#context-map');
    $('.geo-card').classList.toggle('world-context',!regional);
    $('#geo-map').hidden=!regional;frame.hidden=regional||polar;$('#polar-map').hidden=!polar;
    $('.geo-coordinate-action').hidden=regional;
    if(!regional&&!polar){
      const src='world/index.html?lat='+loc.lat+'&lon='+loc.lon+'&context=1';
      if(frame.getAttribute('src')!==src)frame.src=src;
    }else if(frame.hasAttribute('src'))frame.removeAttribute('src');
    if(regional)map?.resize?.();
  }
  function updateLocation() {
    const loc=current().location;
    $('#current-name').textContent=current().name;$('#location-name').textContent=loc.label||'自选场址';
    $('#map-coordinate').textContent=coords(loc);
    renderMapContext(loc);
    window.GridNearbyUI?.select(loc.lat,loc.lon);
  }
  function refreshOverview() {
    updateLocation();for(const input of all('[data-quick]')) input.value=current().config[input.dataset.quick];
    $('#quick-error').textContent='';updateMetrics();
  }
  function setLocation(lat,lon,label) {
    if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)return;
    const match=Math.abs(reference.lat-lat)<0.00001 && Math.abs(reference.lon-lon)<0.00001;
    current().location={lat:+lat.toFixed(6),lon:+lon.toFixed(6),label:label||(match?reference.label:'自选候选场址')};
    changed();updateLocation();map?.setLocation(lat,lon);
  }
  $('#quick-fields').addEventListener('input',()=>{
    const inputs=all('[data-quick]'), config={...current().config};
    for(const input of inputs)config[input.dataset.quick]=input.valueAsNumber;
    if(!GridDesign.validateConfig(config)){$('#quick-error').textContent='请检查数值。IT 功率应大于 0，PUE 至少为 1，负载率在 0–100% 之间，电价应为非负数。测算保留上一次有效值。';return;}
    $('#quick-error').textContent='';current().config=config;changed();updateMetrics();
  });
  function renderLibrary() {
    $('#project-list').innerHTML=state.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=>{
      const m=GridDesign.calculate(p.config);
      return '<article class="library-item"><div class="lib-head"><i data-i="library"></i><span>'+(p.id===state.current?'当前方案':'')+'</span></div><h2>'+esc(p.name)+'</h2><p>'+esc(p.location.label)+'</p><p>'+coords(p.location)+'</p><div class="lib-metrics"><span>'+num(p.config.it)+' MW IT</span><span>'+num(m.energy)+' GWh/年</span></div><div class="lib-actions"><small>'+esc(new Date(p.updatedAt).toLocaleDateString('zh-CN'))+'</small><button class="small-btn" data-open="'+esc(p.id)+'">打开方案</button></div></article>';
    }).join('');
    icons($('#project-list'));
  }
  function mountWorld() {
    const f=$('#world-frame'), l=current().location;
    const selection=l.lat.toFixed(6)+','+l.lon.toFixed(6);
    if (f.dataset.location!==selection) {
      f.src='world/index.html?lat='+l.lat+'&lon='+l.lon;f.dataset.location=selection;
    }
  }
  function restoreAidcProject(){
    const api=$('#aidc-frame').contentWindow?.GridAidcProject;
    if(!api || aidcProjectId===state.current)return;
    if(!api.restore(current().aidc??null)){notice('当前清单无法在本版本恢复');return;}
    aidcProjectId=state.current;
  }
  function route() {
    const allowed=['twin','equipment','overview','world','design','aidc','industry','energy','library'];
    let id=location.hash.slice(1);if(!allowed.includes(id))id='twin';
    if(activeRoute==='twin' && id!=='twin')twin?.pause();
    if(activeRoute==='equipment' && id!=='equipment')equipment?.pause();
    activeRoute=id;
    for(const page of all('.page'))page.hidden=page.id!==id;
    for(const a of all('[data-route]')){if(a.dataset.route===id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
    if(id==='twin'){
      if(!twin)twin=GridTwin.mount({onInspect:part=>{equipmentTarget=part;goto('equipment');},onLoad:value=>{
        if(!Number.isFinite(value)||value<0||value>100)return;
        current().config.load=value;changed();
      }});
      twin.update(current());
    }else if(id==='equipment') {
      equipmentModule ||= import('./equipment/workbench.js').catch(error=>{equipmentModule=null;throw error;});
      equipmentModule.then(module=>{
        if(activeRoute!=='equipment')return;
        equipment ||= module.mount({onChange:study=>{current().rackStudy=GridRackStudy.clean(study);changed();}});
        equipment.open(current(),equipmentTarget);equipmentTarget=null;
      }).catch(()=>{if(activeRoute==='equipment')notice('设备视图暂未加载，请刷新页面重试。');});
    }else if(id==='overview') {
      refreshOverview();
      if(!map && window.GridMap)map=GridMap.mount($('#geo-map'),{...current().location,onPick:(lat,lon)=>setLocation(lat,lon)});
      map?.resize?.();
    } else if(id==='design') {
      if(!design)design=GridDesign.mount($('#design'),{getConfig:()=>current().config,getLocation:()=>current().location,onChange:cfg=>{current().config=cfg;changed();}});
      design.render();
    } else if(id==='library')renderLibrary();
    else if(id==='world')mountWorld();
    else if(id==='aidc' || id==='industry' || id==='energy') {
      const f=$('#'+id+'-frame');
      if(!f.hasAttribute('src'))f.src=id+'/index.html';
      else if(id==='aidc')restoreAidcProject();
      else if(id==='energy')energyContext();
    }
    document.title=({twin:'算电数字孪生',equipment:'设备剖解',overview:'算电选址工作台',world:'全球基础设施地图',design:'方案设计',aidc:'AIDC 数据台',industry:'电力行业数据库',energy:'电价与政策资料',library:'方案库'})[id]+' · 算电图研';
    scrollTo(0,0);
  }
  function goto(id) {if(location.hash==='#'+id)route();else location.hash=id;}
  window.addEventListener('hashchange',route);
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin || !event.data)return;
    if(event.source===$('#energy-frame').contentWindow && event.data.type==='gridatlas-twin-ready'){energyContext();return;}
    if(event.source===$('#energy-frame').contentWindow && event.data.type==='gridatlas-open-twin'){goto('twin');return;}
    if(event.source===$('#aidc-frame').contentWindow && event.data.type==='gridatlas-aidc-ready'){
      aidcProjectId=null;restoreAidcProject();return;
    }
    if(event.source===$('#aidc-frame').contentWindow && event.data.type==='gridatlas-aidc-state'){
      if(aidcProjectId===state.current){
        try{const api=$('#aidc-frame').contentWindow.GridAidcProject;current().aidc=GridIO.cleanAidc(api.getSnapshot());changed();}catch{notice('AIDC 清单未能保存，请核对参数');}
      }
      return;
    }
    if(event.source===$('#aidc-frame').contentWindow && event.data.type==='gridatlas-aidc-apply') {
      const {location:loc,config,mode}=event.data;
      if(!['site','scene'].includes(mode) || !loc || !Number.isFinite(loc.lat) || Math.abs(loc.lat)>90 ||
        !Number.isFinite(loc.lon) || Math.abs(loc.lon)>180 || !config || typeof config!=='object')return;
      const next={...current().config};
      for(const k of ['it','load','green','tariff','pue'])if(Object.hasOwn(config,k))next[k]=config[k];
      if(!GridDesign.validateConfig(next)){notice('来源参数超出方案支持的范围');return;}
      const snap=$('#aidc-frame').contentWindow?.GridAidcProject?.getSnapshot();
      if(snap)current().aidc=GridIO.cleanAidc(snap);
      current().config=next;
      setLocation(loc.lat,loc.lon,String(loc.label||'AIDC 参考站址').slice(0,120));
      goto('overview');notice('已将所选站址和对应参数带入当前方案');return;
    }
    if(![$('#world-frame').contentWindow,$('#context-map').contentWindow].includes(event.source) || event.data.type!=='gridatlas-pick')return;
    const {lat,lon}=event.data;
    if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)return;
    setLocation(lat,lon);goto('overview');notice('所选坐标已写入当前方案');
  });
  const dialog=$('#dialog');
  function closeDialog(){dialog.close();dialogSubmit=null;}
  function showDialog(title,body,submit='',handler=null) {
    $('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-error').textContent='';
    $('#dialog-actions').innerHTML=submit?'<button type="button" class="btn" data-action="close">取消</button><button class="btn primary" type="submit">'+submit+'</button>':'';
    dialogSubmit=handler;icons(dialog);if(!dialog.open)dialog.showModal();
    const first=dialog.querySelector('#dialog-body input');if(first){first.focus();if(first.type==='text')first.select();}
  }
  $('#dialog-form').addEventListener('submit',event=>{
    event.preventDefault();if(!dialogSubmit)return;try{dialogSubmit();closeDialog();}catch(e){$('#dialog-error').textContent=e.message;}
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
  function projectDialog(isNew) {
    const initial=isNew?'新建选址方案':current().name;
    showDialog(isNew?'新建方案':'修改方案名称',(isNew?'<p class="dialog-note">采用当前场址和默认测算参数。</p>':'')+'<label class="dlg-field">方案名称<input id="name-input" maxlength="100" required type="text" value="'+esc(initial)+'"></label>',isNew?'创建方案':'保存',()=>{
      const name=$('#name-input').value.trim();if(!name)throw Error('请输入方案名称。');
      if(isNew){const p=newProject(name,current().location);state.projects.push(p);state.current=p.id;}else current().name=name;
      changed();refreshOverview();goto('overview');
    });
  }
  function coordinateDialog() {
    const l=current().location;
    showDialog('定位候选场址','<p class="dialog-note">输入 WGS 84 十进制度经纬度。西经与南纬使用负值。</p><label class="dlg-field">纬度<input id="lat" type="number" min="-90" max="90" step="any" required value="'+l.lat+'"></label><label class="dlg-field">经度<input id="lon" type="number" min="-180" max="180" step="any" required value="'+l.lon+'"></label><label class="dlg-field">场址名称<input id="place" maxlength="120" placeholder="自选候选场址"></label>','应用坐标',()=>{
      const lat=$('#lat').valueAsNumber,lon=$('#lon').valueAsNumber;setLocation(lat,lon,$('#place').value.trim()||(lat===l.lat&&lon===l.lon?l.label:null));
    });
  }
  function exportDialog() {
    showDialog('导出当前方案','<p class="dialog-note">'+esc(current().name)+'</p><button type="button" class="option-row" data-action="json"><i data-i="export"></i><span><b>下载方案文件</b><small>JSON 格式，可在方案库中重新导入</small></span></button><button type="button" class="option-row" data-action="print"><i data-i="print"></i><span><b>打印测算报告</b><small>包含场址、配置、指标和计算假设，可存为 PDF</small></span></button>');
  }
  function help(source=false) {
    const body=source?'<p>全球地图按视野加载 OpenInfraMap 的公开基础设施数据。区域电网保留伊金霍洛旗附近的 OpenStreetMap 快照与地形采样。园区与机房根据方案参数生成，设备与运行负荷为设计示意和测算值，数据署名和覆盖范围见地图。</p><p>AIDC 数据台列出 NewdPower 公开的设计数据和来源。原站设备价格与性能口径以各记录说明为准。</p><p>快速测算采用固定 PUE、平均负载率及全年 8,760 小时。绿电比例为方案目标；可供容量、接入条件与结算电价需项目资料确认。</p><p><a href="https://openinframap.org/about" target="_blank" rel="noopener">OpenInfraMap 数据说明</a>　<a href="https://newdpower.cloud/aidc-design.html" target="_blank" rel="noopener">NewdPower 设计原页</a></p>':'<p><b>三维场景</b>　在数字孪生页拖动旋转园区，点选建筑查看方案参数。切换机房剖视可看机柜排布，切换区域电网可查看周边变电站。右侧负载率会写入当前方案。</p><p><b>选场址</b>　点击选址测算地图，或在全球地图里找到目标位置并应用到当前方案。「附近变电站」会按球面直线距离排序，可切换搜索半径并查看原始设施。</p><p><b>配方案</b>　在方案设计中修改规模、供电、制冷和电价。AIDC 数据台提供设备、场景和详细资料。</p><p><b>带走结果</b>　方案自动保存在本浏览器。通过选址测算页导出可移交的 JSON 或可打印的测算报告。</p>';
    showDialog(source?'数据来源与测算口径':'使用说明','<div class="help-text">'+body+'</div>');
  }
  const actions={close:closeDialog,help:()=>help(),sources:()=>help(true),new:()=>projectDialog(true),rename:()=>projectDialog(false),coordinates:coordinateDialog,design:()=>goto('design'),export:exportDialog,import:()=>$('#import-file').click(),json:()=>{GridIO.downloadJSON(current());closeDialog();},print:async()=>{closeDialog();await GridIO.printReport(current());}};
  document.addEventListener('click',async e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;
    if(action && actions[action]){try{await actions[action]();}catch(err){notice(err.message);}return;}
    const open=e.target.closest('[data-open]');if(open){state.current=open.dataset.open;persist();map?.setLocation(current().location.lat,current().location.lon);goto('overview');return;}
    const control=e.target.closest('[data-map]')?.dataset.map;if(control==='reset')map?.reset();else if(control)map?.zoomBy(control==='plus'?1:-1);
    const inLayers=e.target.closest('.layer-wrap');if(e.target.closest('#layer-button')){const yes=$('#layers').hidden;$('#layers').hidden=!yes;$('#layer-button').setAttribute('aria-expanded',String(yes));}else if(!inLayers){$('#layers').hidden=true;$('#layer-button').setAttribute('aria-expanded','false');}
  });
  $('#layers').addEventListener('change',e=>{if(e.target.dataset.layer)map?.setLayer(e.target.dataset.layer,e.target.checked);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#layers').hidden){$('#layers').hidden=true;$('#layer-button').setAttribute('aria-expanded','false');$('#layer-button').focus();}});
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    try{const p=await GridIO.readProject(file);p.id=createId();state.projects.push(p);state.current=p.id;changed();map?.setLocation(p.location.lat,p.location.lon);goto('overview');notice('方案已导入');}catch(e){notice(e.message);}finally{event.target.value='';}
  });
  icons();persist();route();
})();
