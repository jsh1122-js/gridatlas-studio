(() => {
  'use strict';
  const radius=document.getElementById('nearby-radius');
  const voltage=document.getElementById('nearby-voltage');
  const state=document.getElementById('nearby-state');
  const results=document.getElementById('nearby-table');
  const more=document.getElementById('nearby-more');
  const retry=document.getElementById('nearby-retry');
  const textElement=(tag,value)=>{const element=document.createElement(tag);element.textContent=value;return element;};
  let point, requestKey='', controller, timer, response, shown=5;
  function renderRows() {
    results.replaceChildren();
    more.hidden=true;
    if(!response?.rows.length)return;
    const minVoltage=Number(voltage.value);
    const rows=minVoltage ? response.rows.filter(r=>(r.voltage.match(/[0-9.]+/g)||[]).some(v=>Number(v)>=minVoltage)) : response.rows;
    if(minVoltage){
      const n=textElement('p','在当前记录中，已标电压符合筛选条件的有 '+rows.length+' 座。');
      n.className='near-filter-count';results.append(n);
    }
    if(!rows.length)return;
    const table=document.createElement('table');
    const head=table.createTHead().insertRow();
    ['顺序','变电站','已知电压','直线距离','设施位置'].forEach(label=>head.append(textElement('th',label)));
    const body=table.createTBody();
    for(const [index,r] of rows.slice(0,shown).entries()) {
      const tr=body.insertRow();
      tr.insertCell().append(textElement('span',String(index+1)));
      const name=tr.insertCell();
      name.append(textElement('b',r.name||'未标注站名'),textElement('small','OSM '+r.id));
      if(r.lifecycle)name.append(textElement('small',r.lifecycle));
      tr.insertCell().textContent=r.voltage||'未标注';
      const distance=tr.insertCell();
      distance.className='near-distance';
      distance.textContent=r.distanceKm<1?Math.round(r.distanceKm*1000)+' m':r.distanceKm.toFixed(2)+' km';
      const location=tr.insertCell();
      const focus=textElement('button','图上查看');
      focus.type='button';focus.className='station-focus';
      focus.onclick=()=>window.GridStationView.open(point,r);
      location.append(focus);
      const a=textElement('a','OSM');
      a.href=r.url;a.target='_blank';a.rel='noopener noreferrer';
      a.setAttribute('aria-label','查看第 '+(index+1)+' 座变电站的地图与原始记录');
      location.append(a,textElement('small',r.lat.toFixed(5)+', '+r.lon.toFixed(5)));
    }
    results.append(table);
    more.hidden=shown>=rows.length;
    more.textContent='再显示 '+Math.min(20,rows.length-shown)+' 座';
  }
  function select(lat,lon,force=false) {
    point={lat,lon};
    const radiusKm=Number(radius.value), key=[lat,lon,radiusKm].join('/');
    if(key===requestKey&&!force)return;
    requestKey=key;
    controller?.abort();controller=new AbortController();
    const signal=controller.signal;clearTimeout(timer);
    response=null;shown=5;renderRows();retry.hidden=true;state.textContent='正在查询所选场址周边 '+radiusKm+' km 内的变电站…';
    timer=setTimeout(async()=>{
      try{
        const data=await window.GridNearby.find(lat,lon,{radiusKm,limit:Number.MAX_SAFE_INTEGER,signal});
        if(signal.aborted || key!==requestKey)return;
        response=data;renderRows();
        const scope='半径 '+radiusKm+' km';
        const count=data.totalMatched??data.rows.length;
        const source=data.source?( ' · '+data.source ):'';
        const date=data.asOf?(' · '+String(data.asOf).slice(0,10)):'';
        if(data.status==='unavailable'){state.textContent=scope+' · 暂未取得变电站数据，请重试。';retry.hidden=false;}
        else if(data.status==='partial'||!data.complete){
          state.textContent=scope+' · 部分范围尚未取得，当前已识别 '+count+' 座。'+source+date;retry.hidden=false;
        }else if(!count){state.textContent=scope+' · 所用数据范围内没有已收录的变电站。'+source+date;}
        else{state.textContent=scope+' · 共 '+count+' 座，按由近到远排列'+source+date;}
      }catch(e){
        if(signal.aborted)return;
        state.textContent='本次查询未取得结果，可重新查询。';retry.hidden=false;
      }
    },180);
  }
  voltage.addEventListener('change',()=>{shown=5;renderRows();});
  radius.addEventListener('change',()=>{if(point)select(point.lat,point.lon);});
  retry.addEventListener('click',()=>{if(point)select(point.lat,point.lon,true);});
  more.addEventListener('click',()=>{shown+=20;renderRows();});
  window.GridNearbyUI=Object.freeze({select});
})();
