(() => {
  'use strict';

  function defaults() {
    return {version:1,station:{highKV:110,lowKV:10,unitMVA:63,units:2},links:[]};
  }
  function number(value,label,max,integer=false,min=0) {
    if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isSafeInteger(value)))throw Error('请检查'+label+'。');
    return value;
  }
  function string(value,label,max,optional=false) {
    if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/u.test(value))throw Error('请检查'+label+'。');
    const clean=value.trim();if(!clean&&!optional)throw Error('请填写'+label+'。');return clean;
  }
  function clean(raw) {
    if(!raw||raw.version!==1||!raw.station||!Array.isArray(raw.links)||raw.links.length>1000)throw Error('外电接入方案格式无效。');
    const s=raw.station,station={
      highKV:number(s.highKV,'自建站高压侧电压',2000),lowKV:number(s.lowKV,'自建站低压侧电压',2000),
      unitMVA:number(s.unitMVA,'单台主变容量',10000),units:number(s.units,'主变台数',10000,true,1)
    };
    if(station.lowKV<=0||station.highKV<=station.lowKV||station.unitMVA<=0)throw Error('高压侧电压须高于低压侧，电压和主变容量均须为正数。');
    const ids=new Set();
    const links=raw.links.map(row=>{
      if(!row||!['osm','manual'].includes(row.source))throw Error('请核对上级站点来源。');
      const id=string(row.id,'站点编号',125);
      if(!(row.source==='osm'?/^(node|way|relation)\/[1-9]\d*$/:/^manual-[\w-]+$/).test(id)||ids.has(id))throw Error('上级站点编号无效或重复。');
      ids.add(id);
      return {id,name:string(row.name,'站名',250,true),lat:number(row.lat,'站点纬度',90,false,-90),
        lon:number(row.lon,'站点经度',180,false,-180),voltage:string(row.voltage??'','上级站电压',100,true),
        source:row.source,sourceLabel:string(row.sourceLabel??'','资料来源',170,true),
        asOf:row.asOf==null?null:string(row.asOf,'资料日期',64,true),
        circuits:number(row.circuits,'拟接入回数',10000,true,1),
        existingCircuits:row.existingCircuits==null?null:number(row.existingCircuits,'已知出线回数',10000,true)};
    });
    return {version:1,station,links};
  }
  function describe(project) {
    const plan=project.gridConnection?clean(project.gridConnection):defaults(),location=project.location;
    const links=plan.links.map(row=>({...row,...voltageCheck(row,plan.station.highKV),distanceKm:GridNearby.distance(location.lat,location.lon,row.lat,row.lon)}))
      .sort((a,b)=>a.distanceKm-b.distanceKm||a.id.localeCompare(b.id));
    return {station:plan.station,links,totalMVA:plan.station.units*plan.station.unitMVA,
      totalCircuits:links.reduce((sum,row)=>sum+row.circuits,0),configured:Boolean(project.gridConnection)};
  }
  const fmt=(v,d=2)=>v.toLocaleString('zh-CN',{maximumFractionDigits:d});
  const title=row=>row.name||(row.voltage?row.voltage+' ': '')+'变电站 · '+row.id;
  function voltageCheck(row,highKV){
    const label=row.voltage||'',source=row.source==='manual'?'录入电压':'公开电压';
    const voltageList=/^\s*(?:\d+(?:\.\d+)?\s*(?:kV|千伏)?\s*[/、;；,，]\s*)*\d+(?:\.\d+)?\s*(?:kV|千伏)\s*$/iu;
    if(!voltageList.test(label))return {voltageStatus:'unknown',voltageNote:'上级站接入电压侧待核，现有资料未标明可核对的电压等级。'};
    const listed=label.match(/\d+(?:\.\d+)?/g).map(Number).includes(highKV);
    return {voltageStatus:listed?'listed':'unlisted',voltageNote:listed?
      source+'列有 '+fmt(highKV)+' kV，具体接入间隔待核。':source+'未列 '+fmt(highKV)+' kV，接入电压侧及间隔待核。'};
  }
  const input=(name,value,type='number')=>{
    const el=document.createElement('input');el.name=name;el.type=type;el.value=value;return el;
  };
  const element=(tag,text,cls)=>{
    const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;
  };
  function field(caption,control) {
    const label=element('label');label.append(element('span',caption),control);return label;
  }
  function mount(host,{onChange,onFocus,onPickSite,onSetLocation}={}) {
    host.classList.add('gc-panel');
    host.innerHTML=`
      <header><h2>外电接入方案</h2><p data-gc-summary></p></header>
      <section><h3>园区自建变电站</h3><p data-gc-site></p>
        <form id="gc-spec" class="gc-fields">
          <label><span>高压侧（kV）</span><input name="highKV" type="number" min="0.001" max="2000" step="any" list="gc-volts" required></label>
          <label><span>低压侧（kV）</span><input name="lowKV" type="number" min="0.001" max="2000" step="any" list="gc-volts" required></label>
          <label><span>单台主变容量（MVA）</span><input name="unitMVA" type="number" min="0.001" max="10000" step="any" required></label>
          <label><span>主变台数</span><input name="units" type="number" min="1" max="10000" step="1" required></label>
          <datalist id="gc-volts"><option value="10"><option value="35"><option value="66"><option value="110"><option value="220"><option value="330"><option value="500"><option value="750"></datalist>
          <button type="submit">保存自建站规格</button>
        </form>
        <details id="gc-site-edit"><summary>调整场址坐标</summary>
          <form id="gc-location" class="gc-fields">
            <label><span>场址纬度（WGS84）</span><input name="lat" type="number" min="-90" max="90" step="any" required></label>
            <label><span>场址经度（WGS84）</span><input name="lon" type="number" min="-180" max="180" step="any" required></label>
            <label class="gc-wide"><span>场址名称</span><input name="label" maxlength="200"></label>
            <button type="submit">保存场址</button><button type="button" data-gc-pick>地图选址</button>
          </form>
        </details>
      </section>
      <section><h3>上级变电站</h3>
        <form id="gc-add" class="gc-fields"><label class="gc-wide"><span>周边公开站点</span><select name="stationId"></select></label>
          <label><span>拟接入回数</span><input name="circuits" type="number" min="1" max="10000" step="1" value="1" required></label>
          <button type="submit">加入接入方案</button><p class="gc-wide gc-voltage" data-gc-preview hidden></p>
        </form>
        <details id="gc-manual"><summary>按已知坐标手动添加</summary>
          <form class="gc-fields"><label class="gc-wide"><span>站名</span><input name="name" maxlength="250" required></label>
            <label><span>站点纬度（WGS84）</span><input name="lat" type="number" min="-90" max="90" step="any" required></label>
            <label><span>站点经度（WGS84）</span><input name="lon" type="number" min="-180" max="180" step="any" required></label>
            <label><span>电压等级（kV，选填）</span><input name="voltage" type="number" min="0.001" max="2000" step="any"></label>
            <label><span>拟接入回数</span><input name="circuits" type="number" min="1" max="10000" step="1" value="1" required></label>
            <button type="submit">添加手动站</button>
          </form>
        </details>
        <div data-gc-links></div>
        <p class="gc-note">距离按场址至站点代表坐标的大圆距离计算。拟接入回数为规划设想，已有出线回数按掌握资料填写。可用间隔、接入容量和线路走廊以接入系统审查为准。</p>
      </section><p role="status" data-gc-status></p>`;
    const spec=host.querySelector('#gc-spec'),location=host.querySelector('#gc-location'),add=host.querySelector('#gc-add');
    const manual=host.querySelector('#gc-manual form'),list=host.querySelector('[data-gc-links]'),status=host.querySelector('[data-gc-status]');
    const fieldOf=(f,k)=>f.elements.namedItem(k);
    const val=(f,k)=>fieldOf(f,k).value;
    const numeric=(f,k)=>fieldOf(f,k).valueAsNumber;
    const stationSelect=fieldOf(add,'stationId');
    let project,plan,available=null,contextKey='',planKey='',candidatesKey='',candidate=null;
    function save(next,message) {
      const checked=clean(next);onChange?.(checked);
      update({project:{...project,gridConnection:checked},stations:available});
      status.textContent=message;
    }
    function submit(form,action){
      form.addEventListener('submit',event=>{event.preventDefault();try{action();}catch(e){status.textContent=e.message;}});
    }
    submit(spec,()=>save({...plan,station:Object.fromEntries(['highKV','lowKV','unitMVA','units'].map(k=>[k,numeric(spec,k)]))},'已保存自建站规格。'));
    submit(location,()=>{
      const lat=numeric(location,'lat'),lon=numeric(location,'lon'),label=val(location,'label').trim();
      onSetLocation?.(lat,lon,label);status.textContent='已设置场址坐标。';
    });
    host.querySelector('[data-gc-pick]').onclick=()=>onPickSite?.();
    const nearbyRows=()=>Array.isArray(available)?available:(available?.rows||[]);
    function candidateRows(){
      const byId=new Map(nearbyRows().map(row=>[row.id,row]));if(candidate)byId.set(candidate.id,candidate);
      for(const link of plan.links)byId.delete(link.id);
      return [...byId.values()].sort((a,b)=>GridNearby.distance(project.location.lat,project.location.lon,a.lat,a.lon)-GridNearby.distance(project.location.lat,project.location.lon,b.lat,b.lon)||a.id.localeCompare(b.id));
    }
    function updateCandidates(force=false){
      const rows=candidateRows(),key=JSON.stringify(rows.map(r=>[r.id,r.name,r.lat,r.lon,r.voltage]));
      if(!force&&key===candidatesKey)return;candidatesKey=key;
      const previous=stationSelect.value;
      const options=rows.map(row=>{
        const d=GridNearby.distance(project.location.lat,project.location.lon,row.lat,row.lon);
        return new Option(title(row)+' · '+fmt(d)+' km',row.id);
      });
      stationSelect.replaceChildren(new Option(options.length?'选择公开站点':'暂无可添加公开站点，可按坐标手动添加',''),...options);
      if(options.some(o=>o.value===previous))stationSelect.value=previous;
      stationSelect.disabled=!options.length;candidateStatus();
    }
    function candidateStatus(){
      const row=candidateRows().find(r=>r.id===stationSelect.value),note=add.querySelector('[data-gc-preview]');
      add.querySelector('button').disabled=!row;note.hidden=!row;
      if(row)note.textContent=voltageCheck(row,plan.station.highKV).voltageNote;
    }
    stationSelect.onchange=candidateStatus;
    submit(add,()=>{
      const row=candidateRows().find(s=>s.id===stationSelect.value);
      if(!row)throw Error('请选择尚未加入的公开站点。');
      const link={id:row.id,name:row.name||'',lat:row.lat,lon:row.lon,voltage:row.voltage||'',source:'osm',
        sourceLabel:available?.source||'OpenStreetMap',asOf:available?.asOf||null,circuits:numeric(add,'circuits'),existingCircuits:null};
      save({...plan,links:[...plan.links,link]},'已加入 '+title(link)+'。');
    });
    submit(manual,()=>{
      const voltage=val(manual,'voltage');
      const id='manual-'+(window.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
      const link={id,name:val(manual,'name').trim(),lat:numeric(manual,'lat'),lon:numeric(manual,'lon'),
        voltage:voltage?voltage+' kV':'',source:'manual',sourceLabel:'用户录入',asOf:null,
        circuits:numeric(manual,'circuits'),existingCircuits:null};
      if(!link.name)throw Error('请填写站名。');
      if(plan.links.some(r=>r.source==='manual'&&r.name===link.name&&r.lat===link.lat&&r.lon===link.lon))throw Error('相同名称和坐标的站点已加入。');
      save({...plan,links:[...plan.links,link]},'已加入 '+link.name+'。');manual.reset();
    });
    function renderLinks(rows){
      list.replaceChildren();
      for(const row of rows){
        const box=element('article');box.dataset.linkId=row.id;
        const heading=element('h4',title(row)),meta=element('p',[row.voltage||'电压未标注',fmt(row.distanceKm)+' km 直线',row.sourceLabel||(row.source==='osm'?'OpenStreetMap':'用户录入'),row.asOf].filter(Boolean).join(' · '));
        if(row.source==='osm'){
          const source=element('a','原始站点');source.href='https://www.openstreetmap.org/'+row.id;
          source.target='_blank';source.rel='noopener noreferrer';meta.append(' · ',source);
        }
        const note=element('p',row.voltageNote,'gc-voltage');note.dataset.gcVoltage=row.voltageStatus;
        box.append(heading,meta,note);
        const f=element('form',null,'gc-fields'),count=input('circuits',row.circuits),known=input('existingCircuits',row.existingCircuits??'');
        for(const el of [count,known]){el.min=el===count?'1':'0';el.max='10000';el.step='1';}
        count.required=true;known.placeholder='未知';
        const saveBtn=element('button','保存回数');saveBtn.type='submit';
        const locate=element('button','地图定位');locate.type='button';locate.onclick=()=>onFocus?.(row);
        const remove=element('button','移除');remove.type='button';
        remove.onclick=()=>save({...plan,links:plan.links.filter(r=>r.id!==row.id)},'已从接入方案移除 '+title(row)+'。');
        f.append(field('拟接入回数',count),field('上级站已有出线回数（选填）',known));
        const actions=element('div',null,'gc-link-actions');actions.append(saveBtn,locate,remove);f.append(actions);
        submit(f,()=>save({...plan,links:plan.links.map(r=>r.id===row.id?{...r,circuits:count.valueAsNumber,existingCircuits:known.value===''?null:known.valueAsNumber}:r)},'已保存 '+title(row)+' 的回数。'));
        box.append(f);list.append(box);
      }
    }
    function update({project:next,stations}){
      if(!next?.location)return;
      const newKey=JSON.stringify([next.id,next.location.lat,next.location.lon]);
      const moved=newKey!==contextKey;
      if(moved){contextKey=newKey;candidate=null;status.textContent='';manual.reset();add.reset();}
      const oldName=project?.location?.label;
      project=next;
      available=stations;
      if(moved||oldName!==project.location.label){
        for(const k of ['lat','lon','label'])fieldOf(location,k).value=project.location[k]??'';
        host.querySelector('[data-gc-site]').textContent=(project.location.label||'园区场址')+' · '+fmt(project.location.lat,5)+'°, '+fmt(project.location.lon,5)+'°';
      }
      const key=JSON.stringify(next.gridConnection||null);
      if(moved||key!==planKey){
        const previous=plan;
        planKey=key;plan=next.gridConnection?clean(next.gridConnection):defaults();
        const data=describe(next);
        if(moved||JSON.stringify(previous?.station)!==JSON.stringify(plan.station)){
          for(const [k,v] of Object.entries(plan.station))fieldOf(spec,k).value=v;
        }
        host.querySelector('[data-gc-summary]').textContent=(data.configured?'已保存方案':'初始方案')+' · 主变铭牌合计 '+fmt(data.totalMVA)+' MVA · 拟接入 '+data.links.length+' 座 / '+data.totalCircuits+' 回';
        if(moved||JSON.stringify(previous?.links)!==JSON.stringify(plan.links))renderLinks(data.links);
        else for(const [i,link] of data.links.entries()){
          const note=list.children[i].querySelector('[data-gc-voltage]');note.dataset.gcVoltage=link.voltageStatus;note.textContent=link.voltageNote;
        }
        candidateStatus();
      }
      updateCandidates(moved);
    }
    function selectStation(row){
      if(!project||!row?.id||!Number.isFinite(row.lat)||!Number.isFinite(row.lon))return false;
      if(plan.links.some(r=>r.id===row.id)){status.textContent=title(row)+' 已在接入方案中。';return true;}
      if(!/^(node|way|relation)\/[1-9]\d*$/.test(row.id))return false;
      candidate=row;updateCandidates(true);stationSelect.value=row.id;stationSelect.onchange();return true;
    }
    return {update,selectStation};
  }
  window.GridConnection=Object.freeze({defaults,clean,describe,mount});
})();
