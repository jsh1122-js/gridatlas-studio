(()=>{
  "use strict";
  const index=window.GridStatsIndex,regions=index.regions,store=window.GridStatsRegions={};
  const $=s=>document.querySelector(s),view=$("#view"),info=$("#info"),select=$("#region"),cache=new Map();
  const pretty=new Intl.NumberFormat("zh-CN",{maximumFractionDigits:3});
  const present=v=>v==null||v===""?"—":v;
  const route=(id,tail="")=>"https://openinframap.org"+regions[id].url.split("/").map(w=>encodeURIComponent(w)).join("/").slice(0,-7)+tail;
  function link(text,href){const a=document.createElement("a");a.textContent=text;a.href=href;a.target="_blank";a.rel="noopener";return a}
  function el(tag,txt,cls){const n=document.createElement(tag);if(txt!=null)n.textContent=txt;if(cls)n.className=cls;return n}
  const translations={China:"中国",Taiwan:"台湾",Alaska:"阿拉斯加",Hawaii:"夏威夷",Russia:"俄罗斯",Turkey:"土耳其",Iran:"伊朗",Macedonia:"北马其顿","Federal Republic of Somalia":"索马里","Democratic Republic of the Congo":"刚果民主共和国","Republic of the Congo":"刚果共和国","United States":"美国","United Kingdom":"英国","South Korea":"韩国","North Korea":"朝鲜","Czech Republic":"捷克","Republic of Mauritius":"毛里求斯","Grand Duchy of Luxembourg":"卢森堡",Laos:"老挝",Swaziland:"斯威士兰","Ivory Coast":"科特迪瓦","East Timor":"东帝汶","Cape Verde":"佛得角",Micronesia:"密克罗尼西亚",Syria:"叙利亚",Bolivia:"玻利维亚",Venezuela:"委内瑞拉",Tanzania:"坦桑尼亚","Faeroe":"法罗群岛","Azores":"亚速尔群岛","Easter Island":"复活节岛","Canary Islands":"加那利群岛","Galapagos":"加拉帕戈斯群岛","Madeira":"马德拉群岛","Macquarie Island":"麦夸里岛","Svalbard":"斯瓦尔巴群岛","Andaman and Nicobar":"安达曼和尼科巴群岛"};
  const en=new Intl.DisplayNames("en",{type:"region"}),zh=new Intl.DisplayNames("zh-CN",{type:"region"});
  for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const c=String.fromCharCode(a,b);if(en.of(c)!==c&&!translations[en.of(c)])translations[en.of(c)]=zh.of(c)}
  const title=i=>translations[regions[i].name]?translations[regions[i].name]+" · "+regions[i].name:regions[i].name;
  const names={coal:"煤炭",gas:"天然气",solar:"太阳能",wind:"风能",hydro:"水能",nuclear:"核能",biomass:"生物质",geothermal:"地热",waste:"废弃物",oil:"石油",battery:"电池储能",diesel:"柴油",biogas:"沼气",tidal:"潮汐能",biofuel:"生物燃料","[unspecified]":"未标明",All:"合计",Total:"合计","No voltage tagged":"未标注电压"};
  const naming=t=>names[t]||t||"—";
  const fmt=v=>Number.isFinite(v)?pretty.format(v):"—";
  const rowsPerPage=40;
  let selected=regions.findIndex(r=>r.name==="China"),tab="summary",generation=0,filter="",source="",sort="original",page=0,lastData=null;
  function options(query=""){
    const q=query.trim().toLowerCase();select.replaceChildren();
    if(!q||"全球总览 global world".includes(q))select.add(new Option("全球总览","-1"));
    regions.forEach((r,i)=>{if(!q||title(i).toLowerCase().includes(q))select.add(new Option(title(i),String(i)))});
    if(!select.options.length){select.add(new Option("无匹配区域",""));select.disabled=true;return}
    select.disabled=false;
    const prior=[...select.options].some(o=>o.value===String(selected));if(prior)select.value=String(selected);
    else select.selectedIndex=0;
  }
  function loadRegion(id){
    if(store[id])return Promise.resolve(store[id]);if(cache.has(id))return cache.get(id);
    const promise=new Promise((resolve,reject)=>{
      const s=document.createElement("script");s.src=(index.regionBase||"regions")+"/"+id+".js";s.async=true;
      s.onload=()=>{s.remove();if(store[id])resolve(store[id]);else reject(Error("无区域数据"))};
      s.onerror=()=>{s.remove();cache.delete(id);reject(Error("区域文件读取失败"))};
      document.head.append(s);
    });cache.set(id,promise);return promise;
  }
  function table(headers,rows,cls=""){
    const wrap=el("div",null,"table-wrap"),t=el("table",null,cls),head=t.createTHead(),tr=head.insertRow();
    for(const name of headers){const cell=el("th",name);cell.scope="col";tr.append(cell)}
    const body=t.createTBody();
    for(const row of rows){const r=body.insertRow();for(const v of row){const td=r.insertCell();if(v instanceof Node)td.append(v);else td.textContent=present(v)}}
    if(!rows.length){const td=body.insertRow().insertCell();td.colSpan=headers.length;td.textContent="此项暂无记录。"}
    wrap.append(t);return wrap;
  }
  function panelTable(title,columns,rows){const d=el("div");d.append(el("h2",title),table(columns,rows));return d}
  function setKpis(values){$("#kpis").replaceChildren(...values.map(([k,v])=>{const c=el("article");c.append(el("small",k),el("strong",v));return c}))}
  function compactLines(arr){return (arr||[]).map(([range,length,percent])=>[naming(range),length,percent])}
  function groupLinks(id){
    const d=el("div",null,"more-links");
    d.append(link("原站区域统计",route(id)),link("原站电厂目录",route(id,"/plants")),link("原站在建目录",route(id,"/plants/construction")));return d;
  }
  function globalSummary(){
    const total=index.globalLines.find(r=>r[0]==="Total");
    setKpis([["统计区域",String(regions.length)],["电厂目录记录",fmt(regions.reduce((s,r)=>s+(r.plants||0),0))],["已收录全球线路",total?.[1]||"—"]]);
    info.textContent="统计对象为原站公开地理区域。按区域查看来源、运营方、装机及分电压线路统计。";
    const d=el("div",null,"split"),directory=el("div");directory.append(el("h2","区域目录"));
    const list=regions.map((r,i)=>{const b=el("button",title(i));b.addEventListener("click",()=>{selected=i;$("#region-search").value="";options();resetFilters();render()});return[b,fmt(r.plants),fmt(r.construction)]});
    directory.append(table(["区域","电厂条目","在建条目"],list));d.append(panelTable("全球线路长度",["电压区间","长度","占比"],compactLines(index.globalLines)),directory);view.append(d);
  }
  function regionalSummary(id,record){
    const data=record.area;
    if(!data){info.textContent="区域统计快照缺失，可查看原站页面。";view.append(groupLinks(id));return}
    const total=data.sources.find(r=>r[0]==="All")||[],line=data.lines.find(r=>r[0]==="Total")||[];
    setKpis([["统计中的电厂数",total[2]||"—"],["已标注装机",total[1]||"—"],["已收录线路",line[1]||"—"]]);
    info.textContent="原站统计日期 "+data.date+"。同一电厂登记多种能源时，此表按首个来源统计。";
    const d=el("div",null,"split");d.append(panelTable("按能源来源汇总",["能源","已标注装机","电厂数"],data.sources.map(r=>[naming(r[0]),r[1],r[2]])),panelTable("按电压区间汇总",["电压区间","线路长度","占比"],compactLines(data.lines)));
    view.append(d,groupLinks(id));
  }
  function showHistory(data){
    if(!data?.history?.length){info.textContent="所选区域未提供可读取的历史序列。";return}
    info.textContent="按原站图表中的月均观察值列出。空白月份或空字段保留为缺失。";
    const rows=data.history.toReversed?data.history.toReversed():[...data.history].reverse();
    view.append(table(["月份","月均电厂数","月均已标注装机（GW）","月均线路长度（km）","月均变电站数"],rows.map(([date,r])=>[date,fmt(r.plant_count),fmt(r.total_output),fmt(r.line_length),fmt(r.substation_count)])));
  }
  function capacity(value){
    const m=/^([\d.,]+)\s*(GW|MW|kW|W)$/i.exec(value);if(!m)return -1;
    return Number(m[1].replaceAll(",",""))*({gw:1000,mw:1,kw:.001,w:.000001}[m[2].toLowerCase()]||1);
  }
  function resetFilters(){filter="";source="";sort="original";page=0}
  function drawList(entries,hosts){
    const selectedSource=source,terms=filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let matches=entries.filter(([id,r])=>(!selectedSource||r[5].split(";").includes(selectedSource))&&(!terms.length||terms.every(q=>(r.slice(1).join(" ")+" "+naming(r[5])+" "+title(id)).toLowerCase().includes(q))));
    if(sort==="capacity")matches.sort((a,b)=>capacity(b[1][4])-capacity(a[1][4]));
    const pages=Math.max(1,Math.ceil(matches.length/rowsPerPage));page=Math.min(page,pages-1);
    const isBuild=tab==="construction";
    const rows=matches.slice(page*rowsPerPage,(page+1)*rowsPerPage).map(([id,r])=>{
      const loc=link(r[1]==="[unnamed]"?(r[2]||"未命名设施"):r[1],route(id,"/plants/"+encodeURIComponent(r[0])));
      const wd=r[7]&&/^Q\d+$/.test(r[7])?link(r[7],"https://www.wikidata.org/wiki/"+r[7]):r[7];
      const values=[loc,r[2],translations[regions[id].name]||regions[id].name,r[3],r[4],naming(r[5]),r[6]];
      if(isBuild)values.push(r[8]);values.push(wd);return values;
    });
    const headers=["电厂名称","英文名称","区域","运营方","标注装机","能源来源","发电方式"];if(isBuild)headers.push("原站完工日期");headers.push("Wikidata");
    const nav=el("div",null,"page-nav"),prev=el("button","上一页"),next=el("button","下一页");prev.disabled=page===0;next.disabled=page>=pages-1;
    prev.onclick=()=>{page--;drawList(entries,hosts)};next.onclick=()=>{page++;drawList(entries,hosts)};
    nav.append(el("span","匹配 "+fmt(matches.length)+" 条 · 第 "+fmt(page+1)+" / "+fmt(pages)+" 页"),prev,next);
    hosts.replaceChildren(table(headers,rows,"facility-table"),nav);
  }
  function showList(records){
    const entries=[];let skipped=0;
    for(const [id,record] of records){if(!Array.isArray(record?.[tab])){skipped++;continue}for(const r of record[tab])entries.push([id,r])}
    info.textContent=(selected<0?"所有区域":title(selected))+" · "+fmt(entries.length)+" 条目录记录。点击电厂名称可查看原站设备详情。"+(skipped?" 缺少 "+skipped+" 个区域的本地目录。":"");
    const tools=el("div",null,"filters"),search=el("input"),chooser=el("select"),sorter=el("select"),host=el("div");
    search.type="search";search.placeholder="名称、运营方、能源或 Wikidata";search.value=filter;
    const sources=new Set();for(const [,r] of entries)for(const key of r[5].split(";"))if(key)sources.add(key);
    chooser.add(new Option("全部能源",""));[...sources].sort().forEach(x=>chooser.add(new Option(naming(x),x)));chooser.value=source;
    sorter.add(new Option("原站顺序","original"));sorter.add(new Option("装机由高到低","capacity"));sorter.value=sort;
    for(const [caption,control] of [["搜索电厂",search],["能源来源",chooser],["排序",sorter]]){const l=el("label",caption);l.append(control);tools.append(l)}
    let debounce;search.oninput=()=>{filter=search.value;page=0;clearTimeout(debounce);debounce=setTimeout(()=>drawList(entries,host),110)};
    chooser.onchange=()=>{source=chooser.value;page=0;drawList(entries,host)};sorter.onchange=()=>{sort=sorter.value;page=0;drawList(entries,host)};
    view.append(tools,host);drawList(entries,host);if(selected>=0)view.append(groupLinks(selected));
  }
  async function render(){
    const token=++generation;view.replaceChildren();info.textContent="正在读取区域数据…";
    document.querySelectorAll("[data-tab]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.tab===tab)));
    const original=$("#original");original.href=selected<0?index.source:route(selected);lastData=null;
    if(selected<0){
      globalSummary();lastData=index;
      if(tab==="summary")return;view.replaceChildren();
      if(tab==="history"){info.textContent="2026-11-23 核验原站全球历史图表时返回 HTTP 504。可重试原站，或选择区域查看已收录的月均序列。";view.append(link("在原站查看全球历史图表","https://openinframap.org/stats/charts"));return}
      const pairs=[];let cursor=0;info.textContent="正在读取全球区域名录…";
      async function worker(){while(cursor<regions.length&&token===generation){const id=cursor++;try{const r=await loadRegion(id);pairs.push([id,r])}catch{pairs.push([id,null])}}}
      await Promise.all(Array.from({length:6},worker));if(token!==generation)return;pairs.sort((a,b)=>a[0]-b[0]);showList(pairs);return;
    }
    const id=selected;
    try {
      const record=await loadRegion(id);if(token!==generation)return;lastData=record;regionalSummary(id,record);
      if(tab==="summary")return;view.replaceChildren();
      if(tab==="history")showHistory(record.area);else showList([[id,record]]);
    }catch{if(token!==generation)return;info.textContent="所选区域的本地文件未能载入。可打开原站目录。";setKpis([["区域",title(id)],["电厂条目",fmt(regions[id].plants)],["在建条目",fmt(regions[id].construction)]]);view.append(groupLinks(id))}
  }
  $("#capture-date").textContent=index.date;
  if(index.sourceManifest)$("#source-manifest").href=index.sourceManifest;
  options();
  $("#region-search").addEventListener("input",e=>{options(e.target.value);if(!select.disabled&&select.value!==String(selected)){selected=Number(select.value);resetFilters();render()}});
  select.addEventListener("change",()=>{selected=Number(select.value);resetFilters();render()});
  document.querySelector(".tabs").addEventListener("click",e=>{if(e.target.dataset.tab){tab=e.target.dataset.tab;resetFilters();render()}});
  $("#download").addEventListener("click",async()=>{
    if(!lastData)return;
    const id=selected,button=$("#download");let payloadData=lastData;
    button.disabled=true;button.textContent="正在打包…";
    try {
      if(id<0){
        const all=Array(regions.length);let cursor=0;
        async function collect(){
          while(cursor<all.length){const at=cursor++;all[at]=await loadRegion(at)}
        }
        await Promise.all(Array.from({length:6},collect));payloadData={index,records:all};
      }
      const payload={attribution:index.attribution,retrieved:index.date,url:id<0?index.source:route(id),plantColumns:["id","name","englishName","operator","output","source","method","wikidata","completionDate"],data:payloadData};
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload)],{type:"application/json"})),a=el("a");
      a.href=url;a.download="gridatlas-"+(id<0?"global-catalog":regions[id].name)+"-"+index.date.replaceAll("-","")+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    }catch{info.textContent="部分数据未能载入，完整文件尚未生成。请重试。"}
    finally{button.disabled=false;button.textContent="下载所选数据"}
  });render();
})();
