'use strict';
const $=id=>document.getElementById(id);
const names={
  indicator:'指标',updated_at:'上游更新时间',is_baseline:'基线数据标记',as_of:'数据所属时间',note:'数据说明',unit:'单位',units:'单位',source:'来源',sources:'数据来源',source_url:'来源网址',last_crawl:'上次采集',crawl_meta:'采集信息',
  national:'全国',provinces:'分省统计',name:'名称',title:'标题',date:'日期',value:'数值',label:'指标名称',columns:'字段定义',url:'原文地址',code:'代码',kpis:'重点指标',companies:'企业',articles:'研究文章',news:'资讯',standards:'标准',policies:'政策',fields:'研究领域',experts:'专家',publications:'发布',description:'说明',grid_investment:'电网投资',generation_investment:'电源投资',investment_trends:'投资动态',recent_deals:'近期交易',
  spot_markets:'现货市场',green_certs:'绿证交易',auxiliary_services:'辅助服务',proxy_market:'代理购电',on_grid_price:'上网电价',retail_price:'零售电价',on_grid_src:'上网价来源',retail_src:'零售价来源',on_grid_as_of:'上网价所属期',retail_as_of:'零售价所属期',tou:'分时电价',company_news:'企业动态',energy_detail:'能源明细',five_cake:'产业环节',regions:'区域数据',calculator:'测算参数',cost_breakdown:'成本构成',compute_hubs:'算力枢纽',dc_projects:'数据中心项目',uhv_lines:'特高压线路',clean_bases:'清洁能源基地',hydro_integrated:'水风光一体化',offshore_wind:'海上风电',desert_bases:'沙戈荒基地',pumped_hydro:'抽水蓄能',direct_green_power:'绿电直供',vendor_share:'厂商份额',cell_share:'电芯份额',current:'当前价格',tech_compare:'技术比较',bid_prices:'中标价格',projects:'项目',organizations:'机构',org:'机构',meta:'元数据',heat:'热度',domain:'领域',unit_price:'单价'
};
let sets=[],records=[],limit=40;
const text=v=>document.createTextNode(String(v));
function el(tag,cls,content){const x=document.createElement(tag);if(cls)x.className=cls;if(content!==undefined)x.textContent=content;return x;}
function titleOf(v,fallback) {
  if(v&&typeof v==='object')for(const k of ['title','name','label','项目名称','标准编号','名称','project','company','date','month','id','year','category','region','province','method','domain','m','source'])if(['string','number'].includes(typeof v[k]))return String(v[k]);
  if(v!==null&&typeof v!=='object')return String(v).slice(0,90);return fallback;
}
function urlOf(v){if(typeof v!=='string')return null;try{const a=new URL(v,'https://newdpower.cloud/');return /^https?:$/.test(a.protocol)&&(/^(https?:\/\/|\/(?!\/))/.test(v))?a.href:null;}catch{return null;}}
function urlLink(url,label){const a=el('a','',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function fieldsTree(v,depth=0) {
  if(v===null)return text('缺失');
  if(typeof v!=='object'){const u=urlOf(v);return u?urlLink(u,String(v)):text(v===true?'是':v===false?'否':v);}
  const box=el('div',depth?'nested':'');
  for(const [key,value] of Object.entries(v)){
    const title=Array.isArray(v)?String(Number(key)+1):names[key]||key;
    if(value!==null&&typeof value==='object'){
      const d=el('details','tree');d.append(el('summary','',title+'（'+Object.keys(value).length+'）'));d.addEventListener('toggle',()=>{if(d.open&&d.childElementCount===1)d.append(fieldsTree(value,depth+1));});box.append(d);
    }else{const row=el('div','property');row.append(el('span','',title));const cell=el('span');cell.append(fieldsTree(value,depth+1));row.append(cell);box.append(row);}
  }return box;
}
function makeRecords(d){
  const rows=[];
  for(const [group,items] of Object.entries(d.data)){
    if(Array.isArray(items)){items.forEach((v,i)=>rows.push({group,v,title:titleOf(v,(names[group]||group)+' · '+(i+1)),d}));}
    else if(items!==null&&typeof items==='object'){
      Object.entries(items).forEach(([key,v])=>rows.push({group,v,title:names[key]||titleOf(v,key),d,key}));
    }else{rows.push({group:'元数据',v:{[group]:items},title:names[group]||group,d});}
  }
  return rows.map(r=>({...r, index:(r.d.name+' '+r.title+' '+r.group+' '+(names[r.group]||'')+' '+JSON.stringify(r.v)).toLowerCase()}));
}
const current=()=>sets.find(d=>d.id===$('dataset').value);
function sourceInfo(d){
  const host=$('source');host.replaceChildren();
  host.append(el('div','src-note','采集日期　'+window.catalogDate),el('div','src-note','上游标记　'+(d.asOf?String(d.asOf).slice(0,10):'未提供')),el('div','src-note','数值与估算口径以记录内来源、所属期和单位为准。'));
  const a=el('p','src-note');a.append(urlLink(d.url,'查看上游原始资料'));host.append(a);
  if(d.url.endsWith('.json')){
    const b=el('button','raw-btn','在线查看完整原表');
    b.onclick=()=>{$('raw-title').textContent=d.name+' · 上游实时原表';$('raw-frame').src=d.url;$('raw-dialog').showModal();};
    host.append(b);
  }
}
function selectDataset(){
  const d=current();$('section').replaceChildren(new Option('全部分组',''));
  for(const group of new Set(d.rows.map(r=>r.group)))$('section').add(new Option(names[group]||group,group));
  sourceInfo(d);filter();
}
function filter(){
  const q=$('search').value.trim().toLowerCase(),across=$('across').checked&&q!=='';
  const groups=across?sets:[current()];const section=across?'':$('section').value;
  records=groups.flatMap(d=>d.rows.filter(r=>(!section||r.group===section)&&(!q||r.index.includes(q))));
  limit=40;render();
}
function render(){
  const host=$('rows');host.replaceChildren();
  $('results').textContent='找到 '+records.length.toLocaleString('zh-CN')+' 条记录，已显示 '+Math.min(limit,records.length)+' 条。点击记录查看字段、单位和来源。';
  for(const r of records.slice(0,limit)){const row=el('details','row'),s=el('summary','',r.title);s.append(el('small','',r.d.name+' / '+(names[r.group]||r.group)));row.append(s);
    row.addEventListener('toggle',()=>{if(row.open&&row.childElementCount===1){const body=el('div','record');if(r.key)body.append(el('div','meta',names[r.key]||r.key));body.append(fieldsTree(r.v));row.append(body);}});host.append(row);}
  $('more').hidden=limit>=records.length;
}
async function init(){
  const resp=await fetch('catalog.json');if(!resp.ok)throw Error('数据快照未能加载，请刷新重试。');
  const data=await resp.json();window.catalogDate=data.retrieved.slice(0,10);sets=data.datasets;
  for(const d of sets){d.rows=makeRecords(d);$('dataset').add(new Option(d.name,d.id));}
  $('dataset').addEventListener('change',selectDataset);$('section').addEventListener('change',filter);
  $('search').addEventListener('input',filter);$('across').addEventListener('change',filter);
  $('more').addEventListener('click',()=>{limit+=40;render();});selectDataset();
}
init().catch(e=>$('results').textContent=e.message);

$('close-raw').onclick=()=>$('raw-dialog').close();
$('raw-dialog').addEventListener('close',()=>$('raw-frame').removeAttribute('src'));
