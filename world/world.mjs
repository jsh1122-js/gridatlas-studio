import {Map as GLMap, Marker, NavigationControl, ScaleControl, setWorkerUrl} from './vendor/maplibre-gl.mjs';

const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const valid = (lat,lon) => Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85.05 && Math.abs(lon) <= 180;
if(q.get('context')==='1') document.documentElement.classList.add('context');
const coords = [Number.parseFloat(q.get('lon')), Number.parseFloat(q.get('lat'))];
const home = valid(coords[1],coords[0]) ? coords : [109.84495,39.22415];
const stationPoint=[Number.parseFloat(q.get('stationLon')),Number.parseFloat(q.get('stationLat'))];
const previewPair=q.get('pair')==='1' && valid(coords[1],coords[0]) && valid(stationPoint[1],stationPoint[0]);
if(previewPair)document.documentElement.classList.add('context','pair-preview');
const groups = [
  ['底图',[['A','地理底图','osm_'],['N','卫星夜光','black_marble']]],
  ['注记',[['L','地名与道路','label_'],['B','行政界线','boundaries_']]],
  ['基础设施',[['P','电力','power_'],['T','通信','telecoms_'],['O','油气','petroleum_'],['I','其他管线','pipeline_'],['W','水务','water_']]],
  ['专题',[['S','光伏热力','heatmap_'],['E','OSMose 校验','osmose_errors_power']]]
];
const enabled = new Set(['A','B','L','P','T']);
const familyNames = {basemap:'地理底图',power:'电力',telecoms:'通信',water:'水务',petroleum:'油气',other_pipeline:'其他管线',solar_heatmap:'光伏热力',osmose_errors_power:'OSMose 校验',blackmarble:'卫星夜光'};
const keyLabels = {osm_id:'OSM 标识',is_node:'节点',name:'名称',name_zh:'中文名',name_en:'英文名',operator:'运营方',voltage:'电压 (kV)',frequency:'频率 (Hz)',ref:'编号',circuits:'回路数',cables:'电缆数',source:'能源类型',type:'类型',location:'位置类型',tags:'标签',wikidata:'Wikidata',power:'电力类型',substance:'介质',method:'方式',output:'功率 (MW)'};
let map,style,chosen,marker;
let statsReady, sourceFailures = new Set();
const featurePanel=$('feature-panel'), results=$('search-results');
function el(tag, content='',className='') { const n=document.createElement(tag); if(content !== '')n.textContent=content; if(className)n.className=className; return n; }
function link(label, href) { const n=el('a',label); n.href=href;n.target='_blank';n.rel='noopener noreferrer';return n; }
function report(message){$('state').textContent=message;}
function togglePanel(id=null){
  ['layers','stats','feature-panel','search-results'].forEach(key=>{$(key).hidden=key!==id;});
  $('layers-button').setAttribute('aria-expanded',String(id==='layers'));
  $('stats-button').setAttribute('aria-expanded',String(id==='stats'));
}
function atlasURL(point, zoom) { return 'https://openinframap.org/#'+zoom.toFixed(2)+'/'+point.lat.toFixed(5)+'/'+point.lng.toFixed(5)+'/'+[...enabled].sort().join(','); }
function syncLink(){if(map)$('original').href=atlasURL(map.getCenter().wrap(),map.getZoom());}
function groupStyle(l) {
  for(const [,choices] of groups)for(const [code,,prefix] of choices)if(l.id.startsWith(prefix))return code;
  return null;
}
function toggleLayers(){
  if(!style || !map || !map.isStyleLoaded() && !map.getLayer('osm_background')) return;
  for(const layer of style.layers){
    const code=groupStyle(layer); if(code)map.setLayoutProperty(layer.id,'visibility',enabled.has(code)?'visible':'none');
  }
  syncLink();
}
for(const [heading,choices] of groups) {
  $('layer-list').append(el('h3',heading));
  const box=el('div','','layer-group'); $('layer-list').append(box);
  for(const [code,label] of choices) {
    const row=el('label'), control=el('input');
    control.type=heading==='底图'?'radio':'checkbox'; control.name=heading==='底图'?'base':code;
    control.checked=enabled.has(code); control.dataset.layer=code;
    control.onchange=()=>{
      if(heading==='底图'){enabled.delete('A');enabled.delete('N');}
      if(control.checked)enabled.add(code);else enabled.delete(code);
      sourceFailures.clear();
      $('night-credit').hidden=!enabled.has('N'); $('qa-credit').hidden=!enabled.has('E');
      toggleLayers();
    };
    row.append(control,document.createTextNode(label));box.append(row);
  }
}
for(const [voltage,color] of [['< 10 kV','#7A7A85'],['10–24 kV','#6E97B8'],['25–51 kV','#55B555'],['52–131 kV','#B59F10'],['132–219 kV','#B55D00'],['220–309 kV','#C73030'],['310–549 kV','#B54EB2'],['≥ 550 kV','#00A4B0'],['高压直流','#4E01B5'],['牵引供电','#A8B596']]){
  const row=el('span'), line=el('i');line.style.backgroundColor=color;row.append(line,document.createTextNode(voltage));$('voltage').append(row);
}
$('layers-button').onclick=()=>togglePanel($('layers').hidden?'layers':null);
$('stats-button').onclick=()=>{const show=$('stats').hidden;togglePanel(show?'stats':null);if(show&&!statsReady)loadStats();};
document.querySelectorAll('.close').forEach(button=>button.onclick=()=>togglePanel());
document.addEventListener('keydown',e=>{if(e.key==='Escape')togglePanel();});
$('retry').onclick=()=>location.reload();

function featureTitle(f) {const p=f.properties;return p.name_zh || p.name || p.name_en || p.ref || f.sourceLayer;}
const osmCache=new Map();
async function osmRequest(part) {
  if(osmCache.has(part))return osmCache.get(part);
  const response=await fetch('https://api.openstreetmap.org/api/0.6/'+part+'.json');
  if(!response.ok)throw Error('OSM 数据暂未取得（'+response.status+'）');
  const body=await response.json();
  if(!Array.isArray(body.elements))throw Error('OSM 返回格式异常');
  if(osmCache.size>=80)osmCache.delete(osmCache.keys().next().value);
  osmCache.set(part,body.elements);
  return body.elements;
}
function sourceDetails(box,type,id){
  const block=el('details'),summary=el('summary','完整 OSM 原始标签与关系'),content=el('div');
  block.append(summary,content);box.append(block);
  let busy=false,loaded=false;
  async function load(){
    if(!block.open||busy||loaded)return; busy=true;content.replaceChildren(el('p','正在读取 OpenStreetMap 原始记录…'));
    try{
      const key=type+'/'+id, [obj]=await osmRequest(key);
      if(!obj)throw Error('OSM 当前未返回此对象');
      content.replaceChildren(el('p','OSM '+obj.type+' '+obj.id+' · 版本 '+obj.version+' · '+(obj.timestamp||'')));
      const dl=el('dl');
      for(const [k,v] of Object.entries(obj.tags||{}))dl.append(el('dt',k),el('dd',String(v)));
      content.append(dl,link('完整对象 JSON','https://api.openstreetmap.org/api/0.6/'+key+'.json'));
      const relations=el('button','载入所属关系');relations.type='button';content.append(relations);
      relations.onclick=async()=>{
        relations.disabled=true;relations.textContent='正在载入关系…';
        try{
          const parents=await osmRequest(key+'/relations');
          const list=el('div');list.append(el('p','所属关系 '+parents.length+' 项'));
          for(const parent of parents){
            list.append(link(parent.tags?.name||parent.tags?.ref||('Relation '+parent.id),'https://www.openstreetmap.org/relation/'+parent.id));
          }
          list.append(link('关系原始 JSON','https://api.openstreetmap.org/api/0.6/'+key+'/relations.json'));
          relations.replaceWith(list);
        }catch{relations.disabled=false;relations.textContent='关系暂未载入，重试';}
      };
      loaded=true;
    }catch(err){content.textContent=err.message+'。收起后可重新读取。';}
    finally{busy=false;}
  }
  block.addEventListener('toggle',load);
}
function details(feature,panel,point) {
  panel.replaceChildren();
  const typeName=familyNames[feature.source]||feature.source;
  panel.append(el('strong',String(featureTitle(feature))),el('p',typeName+' · '+feature.sourceLayer));
  const dl=el('dl');panel.append(dl);
  const props=Object.entries(feature.properties);
  const preferred=['name','name_zh','name_en','voltage','operator','ref','source','output','osm_id'];
  function rank(k){const i=preferred.indexOf(k);return i<0?99:i;}
  props.sort(([a],[b])=>rank(a)-rank(b)||a.localeCompare(b));
  for(const [k,v] of props){
    const label=k==='output'&&feature.source==='solar_heatmap'?'汇总功率 (kW)':keyLabels[k]||k;
    dl.append(el('dt',label),el('dd',typeof v==='string'?v:JSON.stringify(v)));
  }
  const id=Number(feature.properties.osm_id), isNode=[true,'true',1].includes(feature.properties.is_node);
  if(id){
    const osmType=id<0?'relation':isNode?'node':'way';panel.append(link('OpenStreetMap 对象','https://www.openstreetmap.org/'+osmType+'/'+Math.abs(id)));
    sourceDetails(panel,osmType,Math.abs(id));
    if(['power_plant','power_plant_point'].includes(feature.sourceLayer))panel.append(link('电厂档案','https://openinframap.org/stats/object/plant/'+id));
    if(['power_substation','power_substation_point','power_line'].includes(feature.sourceLayer))panel.append(link('回路资料（JSON）','https://openinframap.org/api/'+(feature.sourceLayer==='power_line'?'line/':'substation/')+id));
  }
  if(/^Q\d+$/.test(String(feature.properties.wikidata||'')))panel.append(link('Wikidata 档案','https://www.wikidata.org/wiki/'+feature.properties.wikidata));
  if(feature.source==='osmose_errors_power'&&feature.properties.uuid)panel.append(link('校验记录','https://osmose.openstreetmap.fr/en/issue/'+encodeURIComponent(feature.properties.uuid)));
  panel.append(link('此处原图',atlasURL(point,map.getZoom())));
}
function displayPoint(point, features=[]) {
  chosen=point.wrap();
  if(!marker)marker=new Marker({color:'#3058e6',scale:.75});
  marker.setLngLat(chosen).addTo(map);
  $('location-details').textContent=chosen.lat.toFixed(5)+'°, '+chosen.lng.toFixed(5)+'°';
  $('use-site').textContent=window.parent===window?'复制场址坐标':'选为方案场址';
  const box=$('feature-list');box.replaceChildren();togglePanel('feature-panel');
  const seen=new Set(),unique=[];
  for(const f of features) {
    const id=[f.source,f.sourceLayer,f.properties.osm_id??f.id??JSON.stringify(f.properties)].join('/');
    if(!seen.has(id)&&Object.keys(f.properties).length){seen.add(id);unique.push(f);}
  }
  unique.sort((a,b)=>Number(a.source==='basemap')-Number(b.source==='basemap'));
  if(!unique.length){box.append(el('p','此点未命中可见的矢量要素。可放大或开启其他图层。'));return;}
  const section=el('div','','feature'), content=el('div');box.append(section);
  if(unique.length>1){
    const select=el('select');select.setAttribute('aria-label','选择此点的地图要素');
    unique.forEach((f,i)=>{const o=el('option',(familyNames[f.source]||f.source)+' · '+featureTitle(f));o.value=String(i);select.append(o);});
    select.onchange=()=>details(unique[Number(select.value)],content,chosen);
    section.append(select);
  }
  section.append(content);details(unique[0],content,chosen);
}
$('use-site').onclick=async()=>{
  if(!chosen)return;
  if(window.parent!==window){window.parent.postMessage({type:'gridatlas-pick',lat:chosen.lat,lon:chosen.lng},location.origin);report('已将坐标发送到当前方案');}
  else{try{await navigator.clipboard.writeText(chosen.lat.toFixed(5)+', '+chosen.lng.toFixed(5));report('已复制场址坐标');}catch{report('可在当前位置面板选中并复制经纬度');}}
};
async function loadStats(){
  try {
    const res=await fetch('./stats.json');if(!res.ok)throw Error();const data=await res.json();
    statsReady=true;$('stats-date').textContent='全球已绘制线路 · '+data.retrieved+' 采集';
    const summary=el('details');summary.append(el('summary','各电压等级线路长度'));
    const table=el('div','','stats-table'), dl=el('dl');table.append(dl);summary.append(table);
    for(const [category,length,pct] of data.rows){dl.append(el('dt',category==='Total'?'合计':category==='No voltage tagged'?'未标电压':category),el('dd',length+' · '+pct));}
    $('stat-table').replaceChildren(link('站内国家电力统计','../stats/index.html'),summary);
    for(const region of data.regions){const option=el('option');option.value=region;$('regions').append(option);}
    const links=$('stat-links');links.className='link-list';
    function redraw(){
      links.replaceChildren();const region=$('region').value.trim(), match=data.regions.find(item=>item.toLowerCase()===region.toLowerCase());
      if(match){const base='https://openinframap.org/stats/area/'+encodeURIComponent(match);links.append(link('地区统计',base),link('投运电厂名录',base+'/plants'),link('在建电厂名录',base+'/plants/construction'));}
      links.append(link('全球统计原页','https://openinframap.org/stats'),link('历史变化','https://openinframap.org/stats/charts'));
    }
    $('region').oninput=redraw;redraw();
  } catch { $('stats-date').textContent='统计索引暂时未载入。';$('stat-links').replaceChildren(link('查看站内统计','../stats/index.html')); }
}
let nextGeocode=0,searchSerial=0;
const searchCache=new Map();
$('search').onsubmit=async event=>{
  event.preventDefault();const raw=$('query').value.trim(); if(!raw||!map)return;
  const ticket=++searchSerial;
  const parts=raw.split(/[，,;；\s]+/);
  if(parts.length===2&&parts.every(v=>/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(v))){
    const [lat,lon]=parts.map(Number);
    if(!valid(lat,lon)){results.textContent='纬度需在 ±85.05° 以内，经度需在 ±180° 以内。';togglePanel('search-results');return;}
    map.jumpTo({center:[lon,lat],zoom:12.74});togglePanel();report('已定位到输入坐标');return;
  }
  results.textContent='正在查找地点…';togglePanel('search-results');
  try{
    let places=searchCache.get(raw.toLowerCase());
    if(!places){
      if(Date.now()<nextGeocode)throw new Error('请稍后再搜索。');nextGeocode=Date.now()+1200;
      const url=new URL('https://nominatim.openstreetmap.org/search');
      url.search=new URLSearchParams({q:raw,format:'jsonv2','accept-language':'zh-CN,en',limit:'6'});
      const res=await fetch(url);if(!res.ok)throw Error('地名服务暂时不可用，可输入纬度、经度。');
      places=await res.json();searchCache.set(raw.toLowerCase(),places);
    }
    if(ticket!==searchSerial)return;results.replaceChildren();
    if(!places.length)results.textContent='未找到该地点。可输入纬度、经度定位。';
    for(const place of places){
      const item=el('button',place.display_name);item.onclick=()=>{
        const bbox=place.boundingbox?.map(Number);
        if(bbox?.length===4&&bbox.every(Number.isFinite))map.fitBounds([[bbox[2],bbox[0]],[bbox[3],bbox[1]]],{padding:44,maxZoom:15,duration:350});
        else map.jumpTo({center:[Number(place.lon),Number(place.lat)],zoom:13});
        togglePanel();
      };results.append(item);
    }
  }catch(error){if(ticket===searchSerial)results.textContent=error.message==='请稍后再搜索。'?error.message:'地名服务暂时不可用，可输入纬度、经度。';}
};
function paintStatus() {
  if(sourceFailures.size){report('部分图层暂未载入 · '+[...sourceFailures].map(k=>familyNames[k]||k).join('、'));$('retry').hidden=false;}
  else {report('全球图层 · 点击设施查看资料');$('retry').hidden=true;}
}
async function start(){
  try{
    const res=await fetch('./style.json');if(!res.ok)throw Error('样式文件未载入');style=await res.json();
    style.sprite=new URL('./sprite',location.href).href;
    for(const layer of style.layers){const code=groupStyle(layer);if(code)layer.layout={...layer.layout,visibility:enabled.has(code)?'visible':'none'};}
    let pairPath;
    if(previewPair){
      pairPath=window.GridStationView.arc({lat:home[1],lon:home[0]},{lat:stationPoint[1],lon:stationPoint[0]});
      style.sources.gridatlas_pair={type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'LineString',coordinates:pairPath}}};
      style.layers.push({id:'gridatlas_pair',type:'line',source:'gridatlas_pair',paint:{'line-color':'#176a7d','line-width':3,'line-dasharray':[2.4,1.7]}});
    }
    setWorkerUrl(new URL('./vendor/maplibre-gl-worker.mjs',location.href).href);
    map=new GLMap({container:'map',style,center:home,zoom:12.74,maxZoom:20,attributionControl:false,localIdeographFontFamily:'"PingFang SC","Microsoft YaHei",sans-serif',dragRotate:false});
    if(previewPair){
      for(const [i,caption] of ['候选场址','变电站'].entries()){
        const mark=el('div',caption,'paired-point '+(i?'paired-station':'paired-site'));
        new Marker({element:mark,anchor:'bottom'}).setLngLat(i?pairPath[pairPath.length-1]:home).addTo(map);
      }
      const fit=()=>{
        const end=pairPath[pairPath.length-1];
        map.fitBounds([[Math.min(home[0],end[0]),Math.min(home[1],end[1])],[Math.max(home[0],end[0]),Math.max(home[1],end[1])]],{padding:48,maxZoom:15.5,duration:0});
      };
      fit();
      window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='gridatlas-fit-pair')fit()});
    }else{
      marker=new Marker({color:'#3058e6',scale:.75}).setLngLat(home).addTo(map);
      marker.getElement().setAttribute('aria-label','场址坐标');
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({showCompass:false}),'top-right');map.addControl(new ScaleControl({maxWidth:90,unit:'metric'}),'bottom-left');
    map.on('error',event=>{
      const source=event.sourceId||event.source?.id;
      if(source)sourceFailures.add(source);
      else if(event.tile || !event.error?.message?.includes('image'))sourceFailures.add('地图资源');
      paintStatus();
    });
    map.on('idle',paintStatus);
    map.on('movestart',()=>{sourceFailures.clear();report('正在载入当前视野…');});
    map.on('moveend',syncLink);map.on('load',()=>{syncLink();paintStatus();});syncLink();
    map.on('click',event=>{
      if(previewPair)return;
      if(q.get('context')==='1' && window.parent!==window){
        const point=event.lngLat.wrap();
        window.parent.postMessage({type:'gridatlas-pick',lat:point.lat,lon:point.lng},location.origin);
        return;
      }
      const x=event.point.x,y=event.point.y;
      displayPoint(event.lngLat,map.queryRenderedFeatures([[x-4,y-4],[x+4,y+4]]));
    });
  }catch{report('当前浏览器未能启动交互地图。可重试或打开原图。');$('retry').hidden=false;$('original').href=atlasURL({lat:home[1],lng:home[0]},12.74);}
}
start();
