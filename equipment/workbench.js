import {createViewer} from './viewer.js';
import {mountFabric} from './fabric.js';
import {powerCategoryNames,powerSettings,powerDestination,powerExhibit} from './power-equipment.js';

const $ = id => document.getElementById('eq-'+id);
const create = (tag,text) => {const node=document.createElement(tag);node.textContent=text;return node;};
const digit = n => String(n).padStart(2,'0');
const categories = {rack:'算力机柜',ups:'UPS 供电',liquid:'冷板液冷',air:'机房风冷',...powerCategoryNames};
const modes = {mains:'市电双变换',battery:'电池供电',bypass:'静态旁路'};
const isNVL = profile => profile==='gb200'||profile==='gb300';
const chipDoc = 'https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era/';
const hardware = 'https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html';
const facilities = 'https://docs.nvidia.com/dsx/facilities-infra/reference-design-overview/';
const upsGuide = 'https://www.vertiv.com/4983d1/globalassets/products/critical-power/uninterruptible-power-supplies-ups/vertiv-liebert-gxt5-ups-1500-10000va-230vac-ups--international-models/vertiv-liebert-gxt5-installer-user-guide-230v-sl-70547.pdf';
const paths = {
  mains:['交流输入','整流器','直流母线','逆变器','交流输出'],
  battery:['电池组','直流母线','逆变器','交流输出'],
  bypass:['旁路交流输入','静态旁路开关','交流输出']
};
const upsParts = {
  frame:['UPS 机柜','在线双变换 UPS 将整流、逆变、旁路和输出配电集成在一起，左侧为独立电池柜。'],
  input:['交流输入','正常供电时，交流输入经整流器转换为直流，再进入逆变器。'],
  rectifier:['整流器','整流器将输入交流电转换为直流电；直流母线向逆变器供能，充电支路维持电池储能。'],
  battery:['电池组','市电超出允许范围时，电池经直流母线向逆变器供电。续航取决于电池配置、荷电状态及实际负荷。'],
  inverter:['逆变器','逆变器把直流母线上的电能转换成交流电，支撑市电双变换和电池供电工况。'],
  bypass:['静态旁路','静态开关将旁路交流电源接到输出端。该路径依赖合格的旁路电源。'],
  output:['交流输出','输出端连接下游配电。切换上方工况，可比较到达同一负荷的不同路径。']
};
const liquidParts = {
  frame:['液冷单元','液冷分配单元（CDU）通过换热器把两侧流体隔开，将服务器冷板吸收的热量交给设施侧水系统。'],
  cdu:['CDU 换热器','机房侧和设备侧各自循环。热量在换热表面传递，两侧的水质、压力和流量可分别管理。'],
  supply:['二次侧供液','冷却液离开 CDU，经过机柜供液歧管进入冷板。蓝色标记供液方向。'],
  plates:['芯片冷板','芯片热量经导热界面传到冷板，再由流经内部通道的冷却液带走。'],
  return:['二次侧回液','吸热后的冷却液经回液歧管回到 CDU 换热器。橙色标记回液方向。'],
  primary:['一次侧设施水','一次侧由设施冷源提供冷水，吸收换热器传来的热量后，经其自身回路返回冷源。']
};
const airParts = {
  frame:['机房空气处理机组','本例采用冷冻水型空气处理机组（CRAH）。机柜与空调通过冷热通道组织空气循环。'],
  coil:['冷却盘管','热回风掠过盘管翅片，热量由空气传给管内冷冻水。'],
  fan:['送风机','风机推动机房空气。一些实际机组会采用不同的风机、盘管顺序和送风方式。'],
  cold:['冷通道','蓝色路径表示冷空气进入机柜进风面，为服务器提供冷却空气。'],
  rack:['风冷机柜','服务器从冷通道吸入空气，使其通过板卡和散热器，受热空气从机柜后部排出。'],
  hot:['热通道','橙色路径汇集服务器排风，并将热空气送回空气处理机组。通道隔离有助于减少冷、热空气混合。']
};
function rackParts(s,n) {
  const gb=isNVL(s.profile),ultra=s.profile==='gb300',chip=ultra?'Blackwell Ultra':'Blackwell',unit=gb?'计算托盘':'4U 服务器';
  if(s.level==='rack')return {
    frame:[gb?s.profile.toUpperCase()+' NVL72 整柜':'42U PCIe 参考柜',gb?'18 个计算托盘通过柜内 NVLink 交换系统互联。选择托盘可继续查看其中的 CPU、GPU 和冷却组件。':'此参考柜按每台 4U、每张 PCIe 加速卡含 1 颗 GPU 建模。服务器数量、卡数均可调整。'],
    ['unit-'+s.unit]:[unit+' '+digit(s.unit),gb?'本托盘含两颗 Grace CPU 和四颗 '+chip+' GPU，可打开板级视图查看。':'本台服务器安装 '+n.perNode+' 张单 GPU PCIe 加速卡，可打开服务器逐卡查看。'],
    fabric:[gb?'NVLink 交换托盘':'网络互联',gb?'9 个 NVLink 交换托盘把柜内 GPU 接入同一个 NVLink 域。跨柜通信另经计算节点网卡连接集群网络。':'柜内各服务器通过网卡接入机架交换机，再连接集群网络。具体链路速率和拓扑取决于网络选型。'],
    power:['机柜配电',gb?'电源架把交流输入转换为直流，经机柜母排配送给计算和交换托盘。':'机架配电向服务器电源单元供电；电源额定值和冗余方式需随实际配置确定。'],
    cooling:[gb?'冷却歧管':'风冷散热',gb?'柜内歧管为计算托盘的 CPU 和 GPU 冷板供回液；网络和存储等其余部分仍有风冷。':'服务器以进风、散热器和排风形成气流，机房冷热通道连接机柜与空调。']
  };
  if(s.level==='tray'){
    const parts={frame:[unit+' '+digit(s.unit),gb?'每个计算托盘承载两颗 Grace CPU 及四颗 '+chip+' GPU。点选 GPU 可查看单颗封装。':'这是当前机柜中的一台 4U 服务器。每张 PCIe 加速卡在本例中配置一颗 GPU。']};
    for(let i=1;i<=n.perNode;i++)parts['gpu-'+i]=[gb?'GPU '+digit(i):'PCIe 卡 '+digit(i),gb?'打开这颗 '+chip+' GPU，查看封装、承载板与冷板的相对位置。':'打开此卡搭载的单颗 GPU，查看芯片封装与风冷散热器。'];
    if(gb)parts.cpu=['Grace CPU','每托盘含两颗 Grace CPU，每颗 CPU 与两颗 '+chip+' GPU 组成一个 '+s.profile.toUpperCase()+' Superchip。'];
    parts.fabric=[gb?'托盘互联':'网卡接口',gb?'托盘后部的 NVLink 连接器连接机柜交换托盘。集群网卡另将节点连接到柜外网络。':'板卡经主机 PCIe 总线连接 CPU，服务器网络适配器负责机外通信。'];
    if(gb)parts.cooling=['冷板管路','托盘供回液管路连接芯片冷板与机柜歧管，带走 CPU 和 GPU 的热量。'];
    return parts;
  }
  return {
    package:['GPU 封装','当前选中第 '+s.unit+' 个'+unit+'中的第 '+s.gpu+' 颗 GPU。数量按单个 GPU 封装计数，板上组件位置与封装比例为示意。'],
    ...(ultra?{hbm:['HBM3e 显存','单颗 Blackwell Ultra GPU 具有 288 GB HBM3e。显存堆叠与计算裸片位于同一封装，图中块体仅标识功能位置。']}:{}),
    substrate:['承载板','承载板向封装提供机械支撑，并通过互连与板卡上的供电、信号网络连接。'],
    thermal:[gb?'液冷冷板':'风冷散热器',gb?'热量经导热界面传入金属冷板，再由二次侧冷却液带走。':'热量从芯片传到散热器底座和金属翅片，由服务器气流带出机箱。']
  };
}
let catalogPromise;
function devices() {
  if(!catalogPromise)catalogPromise=fetch(new URL('../aidc/records.json',import.meta.url)).then(async r=>{
    if(!r.ok)throw Error('设备库未载入');
    const json=await r.json();return new Map(json.devices.flatMap(group=>group.devices.map(row=>[row.id,row])));
  }).catch(e=>{catalogPromise=null;throw e;});
  return catalogPromise;
}
function exhibit(s,project) {
  if(Object.hasOwn(powerSettings,s.category))return powerExhibit(s,project);
  const n=GridRackStudy.count(s),gb=isNVL(s.profile),ultra=s.profile==='gb300',unit=gb?'计算托盘':'服务器';
  if(s.category==='rack'){
    const model=gb?s.profile.toUpperCase()+' NVL72':'42U PCIe 参考柜';
    let facts;
    if(s.level==='gpu'){
      facts=[['所属'+unit,digit(s.unit)+' / '+n.nodes],['GPU 位置',digit(s.gpu)+' / '+n.perNode],
        ['选中 GPU','1 颗'],['散热方式',gb?'芯片冷板':'风冷散热器']];
    }else if(s.level==='tray'){
      facts=[['当前'+unit,digit(s.unit)+' / '+n.nodes],['本'+unit+' GPU',n.perNode+' 颗'],
        gb?['本托盘 Grace CPU','2 颗']:['本机 PCIe 加速卡',n.perNode+' 张'],['占用空间',gb?'1U':'4U']];
    }else{
      facts=gb?[['整柜 GPU',n.gpus+' 颗'],['计算托盘',n.nodes+' × '+n.perNode+' GPU'],['整柜 Grace CPU','36 颗'],['整柜交换托盘','9 个']]:
        [['整柜 GPU',n.gpus+' 颗'],['服务器',n.nodes+' 台 × 4U'],['每台 PCIe 加速卡',n.perNode+' 张'],['服务器占用',n.nodes*4+' / 42 U']];
    }
    if(ultra&&s.level==='gpu')facts.push(['单 GPU 显存','288 GB HBM3e']);
    return {title:s.level==='rack'?model:s.level==='tray'?unit+' '+digit(s.unit):'GPU '+digit(s.gpu)+' · 单颗封装',
      caption:s.level==='rack'?'点选'+unit+'查看内部':s.level==='tray'?'点选 GPU 查看单颗封装':'点选封装层或调节拆解程度',
      parts:rackParts(s,n),facts,pathTitle:gb?'柜内 NVLink 互联':'服务器与集群互联',
      path:gb?['托盘 GPU','NVLink 背板','NVLink 交换托盘','对端托盘 GPU']:['GPU 加速卡','主机 PCIe','服务器网卡','机架交换机','集群网络'],
      note:gb?'每托盘 4 张 '+(ultra?'ConnectX-8 800G':'ConnectX-7 400G')+' 集群网卡承担跨柜通信。机柜管理网络经独立的机顶交换机连接管理控制器。':'PCIe 用于主机与加速卡通信。跨服务器通信经过网卡和交换机；实际带宽取决于所选硬件。',
      origin:gb?'数量按 NVIDIA DGX '+s.profile.toUpperCase()+' 用户指南。模型用于识别主要部件及连接关系，部件外形和尺寸作了简化。':'通用配置假设为 42U 机柜、4U 服务器、每台 1–4 张单 GPU PCIe 加速卡。具体型号、功率、安装空间和链路需按项目选型复核。',
      url:gb?hardware:'#aidc',source:gb?'NVIDIA · DGX '+s.profile.toUpperCase()+' 硬件指南':'查看方案设备目录',extraSources:ultra?[['NVIDIA · Blackwell Ultra 芯片与 HBM3e',chipDoc]]:[]};
  }
  if(s.category==='ups')return {title:'在线双变换 UPS',caption:modes[s.condition]+' · 供电路径演示',parts:upsParts,
    facts:[['所选工况',modes[s.condition]],['输出路径',s.condition==='bypass'?'静态开关':'逆变器'],['电源',s.condition==='battery'?'直流电池':s.condition==='bypass'?'旁路交流':'市电交流'],['方案供电',project.config.architecture]],
    pathTitle:'当前供电路径',path:paths[s.condition],note:'监控侧可由 UPS 控制器上送工况、告警与电池状态。此处工况由上方按钮切换。',
    origin:'在线双变换及静态旁路按厂家工作原理绘制。设备容量、电池数量和续航时间以实际选型为准。',url:upsGuide,source:'Vertiv · UPS 用户指南，第 2.7 节'};
  if(s.category==='liquid')return {title:'冷板与液冷分配单元',caption:'设施侧 / 技术侧 · 双回路换热',parts:liquidParts,
    facts:[['一次侧','设施水系统'],['二次侧','设备冷却液'],['换热位置','CDU 换热器'],['方案制冷',project.config.cooling]],
    pathTitle:'设备侧循环',path:['CDU 供液','供液歧管','芯片冷板','回液歧管','CDU 回液'],
    note:'一次侧独立循环：设施冷源 → CDU 一次侧 → 设施冷源。两侧仅通过换热器交换热量。CDU 控制器可向楼宇管理系统上送温度、流量和告警。',
    origin:'液－液 CDU 和芯片冷板采用两条独立回路。图中颗粒演示流向，温度、流量和泵速需由现场测点提供。',url:facilities,source:'NVIDIA DSX · 设施基础架构参考设计'};
  return {title:'空气处理机组与冷热通道',caption:'机房空气循环 · 送风与回风',parts:airParts,
    facts:[['送风侧','冷通道'],['回风侧','热通道'],['热量交接','空气 / 冷冻水'],['方案制冷',project.config.cooling]],
    pathTitle:'机房气流路径',path:['机房空调','冷通道','服务器风道','热通道','空调回风'],
    note:'冷冻水吸收盘管处的热量并回到设施冷源。空调控制器可向楼宇管理系统上送风机与温度状态。',
    origin:'按冷冻水型 CRAH 与冷热通道绘制。通道布置、实际风量及传感器数据由项目设计与现场系统确定。',url:facilities,source:'NVIDIA DSX · 设施基础架构参考设计'};
}
function numbered(select,count,format,value) {
  select.replaceChildren(...Array.from({length:count},(_,i)=>new Option(format(i+1),String(i+1))));
  select.value=String(value);
}
function toggleButton(label,pressed,action) {
  const button=create('button',label);button.type='button';button.setAttribute('aria-pressed',String(pressed));
  button.addEventListener('click',action);return button;
}
export function mount({onChange}={}) {
  const workbench=$('stage').closest('.eq-workbench'), reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const state={...GridRackStudy.defaults,category:'rack',level:'rack',unit:1,gpu:1,condition:'mains',operating:'loaded'};
  let project,active=false,previewProfile=false,part='frame',split=0,playing=!reduce.matches,orbit=false,data,revision=0;
  const fabric=mountFabric($('fabric'));
  const viewer=createViewer($('canvas'),{onPick:key=>choosePart(key,true),onEngine:label=>{$('engine').textContent=label;}});
  const rack=()=>state.category==='rack';
  const numberState=()=>GridRackStudy.count(state);
  const extras=create('span','');extras.className='eq-source-extra';$('source').after(extras);
  const links=create('div','');links.className='eq-equipment-links';$('path-note').after(links);
  const history=[];
  const sample=()=>({profile:state.profile,servers:state.servers,cards:state.cards});
  const previewNote=create('small','当前查看所选机柜的型号。更改型号可设置方案参考柜。');
  previewNote.className='eq-preview-note';$('profile-label').append(previewNote);
  const unitLabel=()=>isNVL(state.profile)?'计算托盘':'服务器';
  numbered($('servers'),10,n=>n+' 台',state.servers);
  numbered($('cards'),4,n=>n+' 张',state.cards);
  function setLevel(level){
    state.level=level;part=level==='gpu'?'package':'frame';draw();
  }
  function choosePart(key,drill) {
    if(!active||typeof key!=='string')return;
    const target=/^(unit|gpu)-(\d+)$/.exec(key);
    if(target&&rack()){
      const index=Number(target[2]),n=numberState();
      if(target[1]==='unit'&&state.level==='rack'&&index>=1&&index<=n.nodes){
        state.unit=index;state.gpu=1;
        if(drill){setLevel('tray');return;}
        part=key;draw();return;
      }
      if(target[1]==='gpu'&&state.level==='tray'&&index>=1&&index<=n.perNode){
        state.gpu=index;
        if(drill){setLevel('gpu');return;}
      }
    }
    if(!Object.hasOwn(data.parts,key))return;
    part=key;paintDetail();
  }
  function paintDetail(){
    if(!Object.hasOwn(data.parts,part))part=Object.keys(data.parts)[0];
    $('detail-title').textContent=data.parts[part][0];$('description').textContent=data.parts[part][1];
    for(const button of $('objects').children)button.setAttribute('aria-pressed',String(button.dataset.part===part));
    if(rack()&&state.level==='tray')$('unit').value=String(state.gpu);
    viewer.select(part);
  }
  function crumbs(){
    const box=$('crumbs');box.replaceChildren();
    const tiers=[['rack',categories[state.category]]];
    if(rack()&&state.level!=='rack')tiers.push(['tray',unitLabel()+' '+digit(state.unit)]);
    if(rack()&&state.level==='gpu')tiers.push(['gpu','GPU '+digit(state.gpu)]);
    tiers.forEach(([level,label],i)=>{
      if(i){const arrow=create('i','/');arrow.setAttribute('aria-hidden','true');box.append(arrow);}
      const last=i===tiers.length-1,el=create(last?'span':'button',label);
      if(last)el.setAttribute('aria-current','location');
      else{el.type='button';el.title='返回'+label;el.onclick=()=>setLevel(level);}
      box.append(el);
    });
  }
  function drillControls(){
    $('drill-controls').hidden=!rack();
    if(!rack())return;
    const n=numberState(),isGpu=state.level==='gpu',isRack=state.level==='rack';
    $('unit-label').hidden=isGpu;
    if(!isGpu){
      $('unit-text').textContent=isRack?unitLabel():'选择 GPU';
      numbered($('unit'),isRack?n.nodes:n.perNode,i=>(isRack?unitLabel():'GPU')+' '+digit(i),isRack?state.unit:state.gpu);
    }
    $('drill').textContent=isGpu?'返回'+unitLabel():isRack?'查看'+unitLabel()+'内部':'查看单颗 GPU';
  }
  function draw(){
    if(!active)return;
    const focused=document.activeElement;
    const restoreFocus=['modes','objects','crumbs'].find(id=>$(id).contains(focused));
    data=exhibit(state,project);
    for(const b of document.querySelectorAll('[data-eq-category]'))b.setAttribute('aria-pressed',String(b.dataset.eqCategory===state.category));
    $('profile-label').hidden=!rack();$('custom').hidden=!rack()||state.profile!=='pcie';
    previewNote.hidden=!previewProfile;$('profile').value=state.profile;$('servers').value=String(state.servers);$('cards').value=String(state.cards);
    const modeBox=$('modes'),isUps=state.category==='ups',settings=isUps?modes:powerSettings[state.category];
    modeBox.hidden=!settings;
    modeBox.replaceChildren(...Object.entries(settings||{}).map(([key,label])=>{
      const field=isUps?'condition':'operating';
      return toggleButton(label,key===state[field],()=>{
        if(key===state[field])return;
        state[field]=key;
        part=isUps?(key==='mains'?'rectifier':key):({transformer:'lowSide',switchgear:'breaker',sst:'frontEnd',hvdc:key==='stored'?'storage':'frontEnd'})[state.category];
        draw();
      });
    }));
    $('model-label').textContent=data.title;$('stage-caption').textContent=data.caption;
    $('objects').replaceChildren(...Object.entries(data.parts).map(([key,[label]])=>{
      const b=toggleButton(label,key===part,()=>choosePart(key,true));b.dataset.part=key;return b;
    }));
    $('facts').replaceChildren(...data.facts.map(([key,value])=>{
      const div=document.createElement('div');div.append(create('span',key),create('strong',String(value??'未设置')));return div;
    }));
    $('path-title').textContent=data.pathTitle;
    const path=$('path');path.replaceChildren();
    data.path.forEach((name,i)=>{
      if(i){const arrow=create('i','→');arrow.setAttribute('aria-hidden','true');path.append(arrow);}
      path.append(create('span',name));
    });
    $('path-note').textContent=data.note;$('origin').textContent=data.origin;
    const link=$('source');link.href=data.url;link.target=data.url.startsWith('#')?'_self':'_blank';link.textContent=data.source;
    extras.replaceChildren(...(data.extraSources||[]).map(([name,url])=>{
      const a=create('a',name);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
    }));
    links.replaceChildren();
    if(history.length){
      const prev=history.at(-1),back=create('button','返回'+categories[prev.category]);back.type='button';
      back.onclick=()=>{Object.assign(state,history.pop());part='frame';draw();};links.append(back);
    }
    for(const [key,title] of data.related||[]){
      const b=create('button',title+' ›');b.type='button';
      b.onclick=()=>{history.push({category:state.category,operating:state.operating,level:state.level});navigate(key);};links.append(b);
    }
    links.hidden=!links.childElementCount;
    crumbs();drillControls();
    viewer.show({...state});fabric.update({...state});viewer.setExplode(split/100);viewer.setLoad(project.config.load/100);
    paintDetail();motion();
    if(restoreFocus){
      const focusTarget=$(restoreFocus).querySelector('[aria-pressed="true"],button')||$('detail-title');
      if(focusTarget.tagName!=='BUTTON')focusTarget.tabIndex=-1;
      focusTarget.focus({preventScroll:true});
    }
  }
  async function showBom(items){
    const token=++revision,host=$('project-bom');
    const names={gb200:'GB200 NVL72',gb300:'GB300 NVL72',pcie:'PCIe 参考柜'};
    const mix=Array.isArray(project.rackMix)?project.rackMix.filter(row=>row&&Object.hasOwn(names,row.profile)&&Number.isInteger(row.count)&&row.count>0):[];
    const mixText=mix.length?'方案机柜组合：'+mix.map(row=>names[row.profile]+' × '+row.count.toLocaleString('zh-CN')+' 柜').join('，')+'。':'';
    const write=text=>{host.textContent=mixText+text;};
    if(!Array.isArray(items)||!items.some(i=>i.count>0)){write('当前方案没有已保存的 AIDC 设备清单。页面参考柜按单柜独立计数。');return;}
    write('正在核对已保存的 AIDC 设备清单…');
    try{
      const table=await devices();if(token!==revision)return;
      let known=0,knownUnits=0,missing=0,compute=0,unknown=0;
      for(const item of items){
        if(!item.count)continue;
        const d=table.get(item.dev);
        if(!d){unknown+=item.count;continue;}
        if(d.role!=='it_rack')continue;
        compute+=item.count;
        const perUnit=d.compute?.gpus;
        if(Number.isSafeInteger(perUnit)&&perUnit>=0){known+=perUnit*item.count;knownUnits+=item.count;}
        else missing+=item.count;
      }
      if(!compute&&!unknown){write('已保存的 AIDC 清单没有算力设备条目。参考柜按单柜独立计数。');return;}
      const fmt=n=>n.toLocaleString('zh-CN');
      write('AIDC 清单按型号与数量汇总：'+(knownUnits?'已标注 '+fmt(known)+' 颗 GPU / 加速处理器':'尚无可核算芯片数量的算力设备')+
        (missing?'，另有 '+fmt(missing)+' 个算力设备单位缺少芯片数字段':'')+
        (unknown?'，另有 '+fmt(unknown)+' 个未识别设备单位':'')+'。此数覆盖整份 AIDC 清单，与机柜组合及页面参考柜分别计数。');
    }catch{
      if(token===revision)write('方案已保存 AIDC 设备清单，暂时无法载入型号库核对总数。参考柜仍可独立查看。');
    }
  }
  function navigate(key){
    const category=key==='800v'?'sst':key;
    if(!Object.hasOwn(categories,category))return;
    state.category=category;state.level='rack';part='frame';
    if(powerSettings[category])state.operating=key==='800v'?'conventional':Object.keys(powerSettings[category])[0];
    draw();
  }
  function motion(){
    const run=active&&!document.hidden;
    viewer.setPlaying(playing&&run);viewer.setOrbit(orbit&&run);
    const label=playing?'暂停演示动效':'播放演示动效';
    const button=$('motion');button.textContent=playing?'Ⅱ':'▶';button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(playing));
    const rot=$('rotate');rot.setAttribute('aria-pressed',String(orbit));rot.title=orbit?'停止自动旋转':'自动旋转';
  }
  function expandStatus(){
    const yes=document.fullscreenElement===workbench||workbench.classList.contains('eq-expanded');
    $('expand').setAttribute('aria-pressed',String(yes));
    $('expand').title=yes?'退出全屏':'全屏查看设备';$('expand').setAttribute('aria-label',$('expand').title);
    return yes;
  }
  function closeExpanded(){
    if(document.fullscreenElement===workbench)document.exitFullscreen().catch(()=>{});
    workbench.classList.remove('eq-expanded');expandStatus();
  }
  $('expand').onclick=async()=>{
    if(expandStatus()){closeExpanded();return;}
    try{await workbench.requestFullscreen();}catch{workbench.classList.add('eq-expanded');}
    expandStatus();
  };
  document.addEventListener('fullscreenchange',expandStatus);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&workbench.classList.contains('eq-expanded'))closeExpanded();});
  document.addEventListener('visibilitychange',motion);
  reduce.addEventListener('change',e=>{if(e.matches){playing=false;orbit=false;motion();}});
  for(const b of document.querySelectorAll('[data-eq-category]'))b.onclick=()=>{if(b.dataset.eqCategory!==state.category){history.length=0;navigate(b.dataset.eqCategory);}};
  for(const name of ['profile','servers','cards'])$(name).onchange=()=>{
    const next=GridRackStudy.clean({...sample(),[name]:name==='profile'?$(name).value:Number($(name).value)});
    if(state[name]===next[name])return;
    Object.assign(state,next);const n=numberState();state.unit=Math.min(state.unit,n.nodes);state.gpu=Math.min(state.gpu,n.perNode);
    if(name==='profile')previewProfile=false;
    if(!previewProfile)onChange?.({...next});setLevel('rack');
  };
  $('unit').onchange=()=>choosePart((state.level==='rack'?'unit-':'gpu-')+$('unit').value,false);
  $('drill').onclick=()=>setLevel(state.level==='rack'?'tray':state.level==='tray'?'gpu':'tray');
  $('motion').onclick=()=>{playing=!playing;motion();};
  $('rotate').onclick=()=>{orbit=!orbit;motion();};
  $('zoom-in').onclick=()=>viewer.zoomBy(1.18);$('zoom-out').onclick=()=>viewer.zoomBy(1/1.18);
  $('reset').onclick=()=>{orbit=false;viewer.reset();motion();};
  $('explode').oninput=()=>{split=Number($('explode').value);$('explode-value').textContent=split+'%';viewer.setExplode(split/100);};
  for(const b of workbench.querySelectorAll('[aria-label]'))if(b.tagName==='BUTTON')b.title=b.getAttribute('aria-label');
  expandStatus();
  return {
    open(next,target){
      const different=!project||project.id!==next.id;project=next;
      Object.assign(state,GridRackStudy.clean(project.rackStudy));active=true;
      $('project').textContent=project.name;
      if(different){history.length=0;state.unit=1;state.gpu=1;state.condition='mains';state.level='rack';state.category='rack';part='frame';}
      const n=numberState();state.unit=Math.min(state.unit,n.nodes);state.gpu=Math.min(state.gpu,n.perNode);
      const override=typeof target==='string'&&/^rack:(gb200|gb300|pcie)$/.exec(target);
      previewProfile=Boolean(override&&override[1]!==state.profile);
      if(override){state.profile=override[1];state.unit=1;state.gpu=1;}
      const dest=override?'rack':target==='cooling'?(project.config.cooling==='风冷'?'air':'liquid'):target==='power'?powerDestination(project.config.architecture):target==='it'?'rack':target;
      if(dest&&(dest==='800v'||Object.hasOwn(categories,dest))){history.length=0;navigate(dest);}else draw();
      showBom(project.aidc?.items);
    },
    pause(){active=false;fabric.pause();motion();closeExpanded();}
  };
}
