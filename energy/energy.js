'use strict';
const $=id=>document.getElementById(id);
const labels={policy:'政策与价格公示','ai-reports':'AI 简报',news:'发布与更正公告',knowledge:'储能知识库',policy_regions:'政策地区入口','ai-reports_regions':'简报地区入口',base:'导航入口'};
const categories=Object.keys(labels);
const PAGE=30;
let catalog,rows=[],page=0;
const el=(tag,content)=>{const n=document.createElement(tag);if(content!=null)n.textContent=String(content);return n;};
function link(title,url){const a=el('a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function showTab(name){
  if(name!=='simulation')stopHourPlayback();
  for(const v of document.querySelectorAll('.view'))v.hidden=v.id!==name;
  for(const b of document.querySelectorAll('nav [data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===name));
}
for(const b of document.querySelectorAll('nav [data-view]'))b.onclick=()=>showTab(b.dataset.view);
function table(headers,cls=''){const t=el('table');t.className=cls;const tr=t.createTHead().insertRow();for(const h of headers)tr.append(el('th',h));return [t,t.createTBody()];}
function recordLabel(r){
  if(r.title)return r.title;
  if(r.category==='policy'||r.category==='ai-reports')return [r.regionLabel||r.region,r.period,labels[r.category]].filter(Boolean).join(' · ');
  const pathname=new URL(r.url).pathname;
  if(r.category==='base'&&pathname==='/')return 'EnergyDC 首页';
  if(r.region)return (r.regionLabel||r.region)+' · '+labels[r.category];
  return r.slug||pathname.split('/').filter(Boolean).pop()||r.url;
}
function draw(){
  const n=Math.max(1,Math.ceil(rows.length/PAGE));page=Math.min(Math.max(0,page),n-1);
  const checked=catalog.generatedAt||catalog.checkedAt;
  $('catalog-status').textContent='公开目录共 '+catalog.records.length.toLocaleString('zh-CN')+' 个网址 · 当前匹配 '+rows.length.toLocaleString('zh-CN')+' 个'+(checked?' · 快照日期 '+checked.slice(0,10):'');
  const [t,body]=table(['资料入口','类别','目录修改日期','来源'],'catalog-table');
  rows.slice(page*PAGE,(page+1)*PAGE).forEach(r=>{
    const tr=body.insertRow(),name=tr.insertCell();
    name.append(el('span',recordLabel(r)));
    const path=new URL(r.url).pathname;
    if(['policy','ai-reports'].includes(r.category)&&!r.title)name.append(el('small','记录 '+path.split('/').filter(Boolean).pop().slice(0,8)));
    tr.insertCell().textContent=labels[r.category]||r.category;
    tr.insertCell().textContent=(r.lastmod||'未提供').slice(0,10);
    tr.insertCell().append(link('查看原站',r.url));
  });
  $('list').replaceChildren(rows.length?t:el('p','当前条件没有匹配的入口。'));
  $('prev').disabled=page===0;$('next').disabled=page>=n-1;$('pages').textContent=(page+1)+' / '+n;
}
function filter(){if(!catalog)return;const query=$('search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  rows=catalog.records.filter(r=>(!$('category').value||r.category===$('category').value)&&(!$('region').value||r.region===$('region').value)&&(!$('period').value||r.period===$('period').value)&&query.every(q=>r.search.includes(q)));
  page=0;draw();
}
async function init(){
  const resp=await fetch('catalog.json',{cache:'no-cache'});if(!resp.ok)throw Error('公开目录未能加载，请刷新重试。');
  catalog=await resp.json();
  $('category').add(new Option('全部资料',''));
  for(const cat of categories){const n=catalog.records.filter(r=>r.category===cat).length;if(n)$('category').add(new Option(labels[cat]+'（'+n+'）',cat));}
  const regions=new Map;
  for(const r of catalog.records){
    r.search=[r.title,labels[r.category],r.region,r.regionLabel,r.period,r.url].filter(Boolean).join(' ').toLowerCase();
    if(r.region)regions.set(r.region,r.regionLabel||r.region);
  }
  for(const [k,v] of [...regions].sort((a,b)=>a[1].localeCompare(b[1],'zh-CN')))$('region').add(new Option(v,k));
  for(const v of [...new Set(catalog.records.map(r=>r.period).filter(Boolean))].sort().reverse())$('period').add(new Option(v,v));
  catalog.records.sort((a,b)=>(b.lastmod||'').localeCompare(a.lastmod||'')||categories.indexOf(a.category)-categories.indexOf(b.category)||a.url.localeCompare(b.url));
  for(const k of ['category','region','period'])$(k).onchange=filter;$('search').oninput=filter;
  $('prev').onclick=()=>{page--;draw();};$('next').onclick=()=>{page++;draw();};filter();
}
async function loadExamples(){
  const resp=await fetch('public-tariffs.json');if(!resp.ok)throw Error('暂未能加载电价样本。');
  const data=await resp.json();setupSimulation(data.profiles);const host=$('tariffs');host.replaceChildren();
  for(const p of data.profiles){
    const block=el('article');block.className='sample-block';
    block.append(el('h2',p.title),el('p',[p.date,p.region,p.customerClass,p.tariffSystem,p.voltage,p.dayType].filter(Boolean).join(' · ')));
    const [t,body]=table(['执行时段','时段类型','电价（元/kWh）']);
    p.intervals.forEach(i=>{const tr=body.insertRow();tr.insertCell().textContent=i.start+' – '+i.end;tr.insertCell().textContent=i.period;tr.insertCell().textContent=i.price;});block.append(t);
    if(typeof p.flatLoadAverage==='number'){const line=el('p','24 小时负荷恒定时，加权平均购电单价约 '+p.flatLoadAverage.toFixed(4)+' 元/kWh。');line.className='note';block.append(line);}
    if(Number.isFinite(p.demandCharge) && Number.isFinite(p.capacityCharge)){
      const fee=el('p','基本电价　最大需量 '+p.demandCharge.toFixed(2)+' '+p.demandChargeUnit+'；容量 '+p.capacityCharge.toFixed(2)+' '+p.capacityChargeUnit+'。');fee.className='fine';block.append(fee);
    }
    if(p.note){const note=el('p',p.note);note.className='note';block.append(note);}
    const cites=el('div');cites.className='links';for(const s of p.sources||[])cites.append(link(s.label,s.url));block.append(cites);host.append(block);
  }
  const [t,body]=table(['资料','上游更新节奏','依据']);
  for(const c of data.updateCadence){
    const tr=body.insertRow();tr.insertCell().textContent=c.category;const detail=tr.insertCell();detail.textContent=c.cadence;
    if(c.detail)detail.append(el('small',c.detail));tr.insertCell().append(link(c.basis,c.url));
  }
  $('cadence').replaceChildren(t);
}

if(window.EnergyCsv)window.EnergyCsv.mount($('csv-host'));

const periodColors = {高峰:'#f8b974',尖峰:'#f47d80',平时:'#7bbbe5',低谷:'#58d8bf',深谷:'#9c9bed'};
const hourLabel = value => String(value).padStart(2,'0')+':00';
const minutes = time => {
  const [h,m] = time.split(':').map(Number);
  return h*60+m;
};
let profiles=[], scenario, segments=[], hourly=[], plotGeometry, timer=null;
let projectMW=null, overridden=false;
const chart=$('tariff-chart');
const timeControl=$('sim-hour');

function stopHourPlayback(){
  if(timer!==null){clearInterval(timer);timer=null;}
  $('hour-play').textContent='播放';
  $('hour-play').setAttribute('aria-pressed','false');
}

function setupSimulation(data){
  profiles = [...data].sort((a,b)=>b.month.localeCompare(a.month)||a.date.localeCompare(b.date));
  const select=$('scenario-profile');
  for(const p of profiles)select.add(new Option(p.date+' · '+p.dayType,p.id));
  select.addEventListener('change',()=>chooseProfile(select.value));
  $('view-source').addEventListener('click',()=>showTab('tariff'));
  $('hour-play').addEventListener('click',()=>{
    if(timer!==null){stopHourPlayback();return;}
    if(+timeControl.value===23)timeControl.value='0';
    $('hour-play').textContent='暂停';$('hour-play').setAttribute('aria-pressed','true');
    updateHour();
    timer=setInterval(()=>{
      const next=Number(timeControl.value)+1;
      if(next>23){stopHourPlayback();return;}
      timeControl.value=String(next);updateHour();
    },900);
  });
  timeControl.addEventListener('input',()=>{stopHourPlayback();updateHour();});
  $('sim-load').addEventListener('input',()=>{
    overridden=true;updateLoadOrigin();updateHour();
  });
  $('sync-load').addEventListener('click',()=>{
    if(projectMW===null)return;
    overridden=false;$('sim-load').value=String(projectMW);updateLoadOrigin();updateHour();
  });
  chart.addEventListener('pointerdown',e=>{
    if(!plotGeometry)return;
    chart.setPointerCapture(e.pointerId);selectAtPointer(e);
  });
  chart.addEventListener('pointermove',e=>{if(chart.hasPointerCapture(e.pointerId))selectAtPointer(e);});
  function selectAtPointer(e){
    const x=e.clientX-chart.getBoundingClientRect().left;
    const value=Math.floor((x-plotGeometry.x)/plotGeometry.span*24);
    timeControl.value=String(Math.min(23,Math.max(0,value)));
    stopHourPlayback();updateHour();
  }
  new ResizeObserver(()=>drawChart()).observe(chart);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopHourPlayback();});
  chooseProfile(select.value);
}
function chooseProfile(id){
  scenario=profiles.find(p=>p.id===id);
  segments=scenario.intervals.map(s=>({...s,startMinute:minutes(s.start),endMinute:minutes(s.end),color:periodColors[s.period]||'#bbcad6'}));
  hourly=Array.from({length:24},(_,h)=>{
    const slices=segments.map(s=>({s,minutes:Math.max(0,Math.min(s.endMinute,(h+1)*60)-Math.max(s.startMinute,h*60))})).filter(v=>v.minutes>0);
    return {price:slices.reduce((sum,v)=>sum+v.s.price*v.minutes/60,0),period:[...new Set(slices.map(v=>v.s.period))].join(' / '),color:slices[0]?.s.color||'#bbcad6'};
  });
  const legend=$('scenario-legend');legend.replaceChildren();
  for(const [name,color] of Object.entries(periodColors)){
    if(!segments.some(s=>s.period===name))continue;
    const item=el('span'),mark=el('i');mark.style.background=color;item.append(mark,el('span',name));legend.append(item);
  }
  $('scenario-scope').textContent=scenario.region+' · '+scenario.customerClass+' · '+scenario.tariffSystem+' · '+scenario.voltage;
  $('mean-price').textContent=scenario.flatLoadAverage.toFixed(4);
  const prices=segments.map(s=>s.price);
  $('price-spread').textContent=(Math.max(...prices)-Math.min(...prices)).toFixed(4);
  updateLoadOrigin();
  updateHour();
}
function updateLoadOrigin(){
  $('load-origin').textContent=overridden?'自定义模拟负荷':projectMW!==null?'取自当前方案的平均设施负荷':'独立演示负荷';
  $('sync-load').hidden=!overridden||projectMW===null;
}
function updateHour(){
  if(!scenario)return;
  const hour=Number(timeControl.value), sample=hourly[hour];
  $('hour-label').textContent=hourLabel(hour);
  timeControl.setAttribute('aria-valuetext',hourLabel(hour)+' 至 '+hourLabel(hour+1)+'，'+sample.period+'，'+sample.price.toFixed(6)+' 元每千瓦时');
  $('interval-label').textContent=hourLabel(hour)+' – '+hourLabel(hour+1);
  $('period-tag').textContent=sample.period;$('period-tag').style.color=sample.color;
  $('period-price').textContent=sample.price.toFixed(6);
  const field=$('sim-load'),load=field.valueAsNumber;
  const valid=Number.isFinite(load)&&load>=0&&Number.isFinite(load*24000*scenario.flatLoadAverage);
  field.setAttribute('aria-invalid',String(!valid));
  $('hour-cost').textContent=valid?(load*1000*sample.price).toLocaleString('zh-CN',{maximumFractionDigits:2})+' 元':'—';
  $('day-cost').textContent=valid?(load*2.4*scenario.flatLoadAverage).toLocaleString('zh-CN',{maximumFractionDigits:4}):'—';
  if(!valid)$('load-origin').textContent='请输入有效的非负负荷';
  drawChart();
}
function drawChart(){
  if(!scenario)return;
  const width=chart.clientWidth, height=chart.clientHeight;
  if(!width||!height)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  chart.width=Math.round(width*dpr);chart.height=Math.round(height*dpr);
  const ctx=chart.getContext('2d');ctx.scale(dpr,dpr);
  const left=width<400?39:45,right=width-18,top=34,bottom=height-30,span=right-left;
  plotGeometry={x:left,span};
  const maxPrice=Math.max(...segments.map(s=>s.price));
  const axisMax=Math.max(.25, Math.ceil(maxPrice/.25)*.25);
  const x=minute=>left+minute/1440*span;
  const y=price=>bottom-price/axisMax*(bottom-top);
  ctx.font='11px "SFMono-Regular",Consolas,monospace';
  ctx.fillStyle='#9bb6c6';ctx.textAlign='left';ctx.fillText('元/kWh',2,15);
  ctx.lineWidth=1;
  for(let tick=0;tick<=4;tick++){
    const value=axisMax*tick/4,yy=y(value);
    ctx.strokeStyle='#294357';ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(right,yy);ctx.stroke();
    ctx.textAlign='right';ctx.fillStyle='#a0b9c7';ctx.fillText(value.toFixed(2),left-8,yy+4);
  }
  const spacing=width<400?6:3;
  for(let h=0;h<=24;h+=spacing){
    const xx=x(h*60);
    ctx.strokeStyle='#233d50';ctx.setLineDash([2,5]);ctx.beginPath();ctx.moveTo(xx,top);ctx.lineTo(xx,bottom);ctx.stroke();ctx.setLineDash([]);
    ctx.textAlign=h===24?'right':h===0?'left':'center';ctx.fillStyle='#a5bfcc';ctx.fillText(hourLabel(h),xx,bottom+19);
  }
  for(const [i,s] of segments.entries()){
    const xx=x(s.startMinute),end=x(s.endMinute),yy=y(s.price);
    const fill=ctx.createLinearGradient(0,yy,0,bottom);
    fill.addColorStop(0,s.color+'53');fill.addColorStop(1,s.color+'0a');
    ctx.fillStyle=fill;ctx.fillRect(xx,yy,end-xx,bottom-yy);
    ctx.strokeStyle=s.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(end,yy);ctx.stroke();
    if(i>0){ctx.strokeStyle='#9fb6c7';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(xx,y(segments[i-1].price));ctx.lineTo(xx,yy);ctx.stroke();}
    ctx.fillStyle=s.color;ctx.fillRect(xx,bottom+2,Math.max(1,end-xx-1),2);
  }
  const hour=Number(timeControl.value),xx=x((hour+.5)*60), sample=hourly[hour];
  const yy=y(segments.find(s=>s.startMinute<=(hour+.5)*60&&s.endMinute>(hour+.5)*60)?.price??sample.price);
  ctx.fillStyle='rgba(219,244,248,.055)';ctx.fillRect(x(hour*60),top,span/24,bottom-top);
  ctx.strokeStyle='#cdece8';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(xx,top-2);ctx.lineTo(xx,bottom+3);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle=sample.color;ctx.beginPath();ctx.arc(xx,yy,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#102336';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#f6fffc';ctx.beginPath();ctx.arc(xx,yy,2.6,0,Math.PI*2);ctx.fill();
}
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==window.parent||e.data?.type!=='gridatlas-twin-context')return;
  const value=e.data.averageMW;
  if(!Number.isFinite(value)||value<0)return;
  projectMW=value;
  if(!overridden)$('sim-load').value=String(value);
  updateLoadOrigin();updateHour();
});
if(window.parent!==window)window.parent.postMessage({type:'gridatlas-twin-ready'},location.origin);
init().catch(e=>$('catalog-status').textContent=e.message);
loadExamples().catch(e=>{$('tariffs').textContent=e.message;$('scenario-scope').textContent=e.message;});
