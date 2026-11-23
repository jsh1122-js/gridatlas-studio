const circuits={power:'供电',liquid:'液冷',air:'风冷',network:'网络'};
const archNames={ac:'交流 UPS',dc800:'800V 直流',sst:'SST 800V 直流',hvdc:'集中式 HVDC'};
const references={
  ac:['Schneider Electric · 数据中心配电设备','https://download.se.com/files?p_Doc_Ref=SPD_VAVR-8W4MEX_EN&p_File_Name=VAVR-8W4MEX_R2_EN.pdf'],
  dc:['NVIDIA · 800 VDC 供电架构','https://www.nvidia.com/en-us/data-center/technologies/800-vdc-architecture/'],
  hvdc:['Vertiv · 400 VDC 整流及配电系统','https://www.vertiv.com/en-emea/products-catalog/critical-power/dc-power-systems/netsure-400v-dc-distributed-system/'],
  thermal:['NVIDIA DSX · 数据中心冷却基础设施','https://docs.nvidia.com/dsx/facilities-infra/reference-design-overview/'],
  network:['NVIDIA · 集群和管理网络接口','https://docs.nvidia.com/dgx/dgxgb200-user-guide/networking.html']
};
const node=(id,title,category,part,note)=>({id,title,category,part,note});
const edge=(from,to,kind,medium,route='direct')=>({from,to,kind,medium,route});
const mediumNames={power:'电能',cold:'供液',warm:'回液',heat:'传热',fresh:'冷空气',hot:'热空气',data:'双向数据'};
const defaultArch=name=>Object.keys(archNames).find(k=>archNames[k]===name)||'ac';
function currentArch(s){
  if(s.category==='ups')return 'ac';
  if(s.category==='transformer'&&defaultArch(s.architecture)==='sst')return 'dc800';
  if(s.category==='800v'||(s.category==='sst'&&s.operating==='conventional'))return 'dc800';
  if(s.category==='sst')return 'sst';
  if(s.category==='hvdc')return 'hvdc';
  return defaultArch(s.architecture);
}
function powerCondition(s){
  if(s.category==='ups'&&['battery','bypass'].includes(s.condition))return s.condition;
  if(s.category==='hvdc'&&s.operating==='stored')return 'stored';
  if(s.category==='switchgear'&&s.operating==='open')return 'open';
  if(s.category==='transformer'&&s.operating==='idle')return 'idle';
  return 'normal';
}
function power(s,variant){
  const arch=variant||currentArch(s),ac=arch==='ac',hv=arch==='hvdc';
  const conv=arch==='dc800'?'800v':arch==='sst'?'sst':'hvdc';
  const nodes=[node('grid','中压开关柜','switchgear','cable','园区中压馈线经开关设备送往下一级。')];
  if(arch!=='sst')nodes.push(node('transformer','配电变压器','transformer','lowSide','一次侧进中压交流，二次侧向 UPS 或集中整流设备送低压交流。'));
  if(ac)nodes.push(
    node('ups','交流 UPS','ups','frame','正常工况下交流输入经整流、逆变后向列端送电。电池和旁路工况可在 UPS 模型中切换。'),
    node('row','交流列头柜','rowdist','branches','列头柜接受上游馈电，分支保护并计量送往各机柜的交流回路。'),
    node('pdu','机柜 PDU','pdu','outlets','机柜 PDU 将一条交流支路分到多个电源输入口。'),
    node('psu','机柜 PSU','psu','converter','电源模块把交流转换成机柜或服务器需要的直流电。高密度整柜可采用集中电源架。'),
    node('load','服务器 / 板上负载','rack','frame','直流电进入服务器，板上调压电路再为 CPU、GPU、内存等提供工作电压。')
  );else nodes.push(
    node('converter',arch==='sst'?'SST 隔离变换':hv?'HVDC 集中整流':'集中整流器',conv,hv?'frontEnd':'isolation',arch==='sst'?'本参考路线在设施侧以功率电子变换和高频隔离将中压交流变为 800 VDC。':'设施侧整流器接收上游交流电，建立直流母线。'),
    node('dcrow','列端直流分配','rowdist','branches','列端采用具有相应直流额定值的分配和支路保护设备。'),
    node('bus',hv?'直流馈线 / 母排':'800 V 直流母排','pdu','rail','直流电缆或母排把已保护的支路接至兼容的机架输入。'),
    node('rackdc','机架侧 DC/DC','psu','converter','兼容输入的直流变换器将设施侧直流电降至机架内供电轨。机架输入和各级额定值按实际型号核对。'),
    node('load','服务器 / 板上负载','rack','frame','机架内部直流电经板级调压电路送达处理器和其他负载。')
  );
  const media=ac?['中压电缆 · 交流','变压器二次侧 · 低压交流','UPS 输出馈线 · 交流','列端分支电缆 · 交流','PDU 电源线 · 交流','直流供电轨 / 板级调压']:
    [...(arch==='sst'?['中压交流输入']:['中压电缆 · 交流','变压器二次侧 · 交流']),hv?'整流后直流电':'800 V 直流电','受保护直流支路','机架直流输入','低压直流供电轨'];
  const condition=powerCondition(s);
  const names={battery:'电池供电',bypass:'静态旁路',stored:'电池供电',open:'馈线断开',idle:'二次侧空载'};
  let note=ac?'参考交流馈线，列头柜分支到机柜，PSU 完成末端 AC/DC 变换。实际冗余和旁路按项目接线图确定。':'直流路线使用匹配的列端分配和机架变换设备。现有机柜接入设施侧直流母线前须核对输入接口。';
  if(condition==='battery'){
    nodes.splice(0,3,node('storage','UPS 电池组','ups','battery','电池经直流母线向逆变器送电。'),node('ups','UPS 逆变器','ups','inverter','逆变器把电池侧直流电转换为供给列头柜的交流电。'));
    media.splice(0,2,'电池支路 · 直流母线');note='电池供电期间，负载电能由电池经过逆变器送往列头柜。';
  }else if(condition==='bypass'){
    nodes.splice(0,3,node('bypassSource','旁路交流电源','ups','bypass','合格的旁路交流电源送至 UPS 静态开关。'),node('ups','UPS 静态旁路','ups','bypass','静态旁路开关把旁路交流电接至 UPS 输出。'));
    media.splice(0,2,'旁路交流馈线');note='旁路交流输入经静态开关直接向下游馈电。旁路来源取决于项目接线。';
  }else if(condition==='stored'){
    nodes.splice(0,3,node('storage','HVDC 电池组','hvdc','storage','储能支路经过直流保护接入直流母线。'),node('converter','HVDC 直流母线','hvdc','dcBus','直流母线接受电池支路供电并送往受保护的直流馈线。'));
    media.splice(0,2,'电池支路 · 受保护直流输入');media[1]='母线输出 · 直流电';note='电池支路向直流母线供电，负载继续经直流馈线接入。';
  }
  const edges=nodes.slice(1).map((n,i)=>edge(nodes[i].id,n.id,'power',media[i]));
  if(condition==='open'||condition==='idle'){
    const first=condition==='open'?0:1;
    for(const e of edges.slice(first))e.inactive=true;
    note=condition==='open'?'所选出线断路器已断开，虚线表示这条馈线的下游设备连接。':'二次侧开路时仍有感应电压。虚线表示二次侧及下游未带负荷的连接。';
  }
  const legend=[['power','电能传递方向']];if(edges.some(e=>e.inactive))legend.push(['inactive','无负载电流']);
  return {mode:'power',variant:arch,condition,title:archNames[arch]+(names[condition]?' · '+names[condition]:''),nodes,edges,legend,note,source:ac?references.ac:hv?references.hvdc:references.dc};
}
function liquid(){
  const nodes=[
    node('facility','设施冷源','liquid','primary','设施水从冷源送至 CDU，在换热器中吸收热量后返回设施冷源。'),
    node('primary','CDU 一次侧','liquid','primary','设施水流经换热器一次侧。热量从较热的二次侧传来，两路液体在换热壁两侧流动。'),
    node('secondary','CDU 二次侧','liquid','cdu','技术冷却液在 CDU 释放热量，降温后再次送往机柜。'),
    node('supply','供液歧管','liquid','supply','机柜歧管将来自 CDU 的低温技术冷却液分配到各芯片冷板。'),
    node('plates','芯片冷板','liquid','plates','芯片经导热界面把热量传给冷板，流经冷板的技术冷却液升温。'),
    node('return','回液歧管','liquid','return','回液歧管汇集从冷板流出的较暖冷却液，送回 CDU 二次侧。')
  ];
  const edges=[edge('facility','primary','cold','一次侧设施水 · 供水','facilitySupply'),edge('primary','facility','warm','一次侧设施水 · 回水','facilityReturn'),edge('secondary','primary','heat','换热壁传热 · 无流体交换'),edge('secondary','supply','cold','二次侧技术冷却液 · 供液','secSupply'),edge('supply','plates','cold','分支软管 · 冷板入口','toPlate'),edge('plates','return','warm','分支软管 · 冷板出口','fromPlate'),edge('return','secondary','warm','二次侧技术冷却液 · 回液','secReturn')];
  return {mode:'liquid',title:'CDU 双回路换热',nodes,edges,legend:[['cold','供液'],['warm','回液'],['heat','隔壁传热']],note:'两个闭合回路各自循环。只有热量从设备侧跨过 CDU 换热壁进入设施水侧。',source:references.thermal};
}
function air(){
  const nodes=[node('coil','CRAH 冷却盘管','air','coil','热回风流经盘管，热量从空气传到盘管内的冷冻水。'),node('blower','CRAH 送风机','air','fan','本例采用冷冻水型机房空气处理机组，送风机驱动冷空气进入冷通道。'),node('cold','冷通道','air','cold','冷通道把低温空气送至机柜进风面。'),node('rackfan','服务器风扇','fan','impeller','服务器风扇产生压差，使空气流经板卡和散热器。机内风扇布置随服务器设计变化。'),node('load','服务器散热面','rack','fan','气流带走板卡、散热器和其他热源释放的热量。'),node('hot','热通道 / 回风','air','hot','热通道汇集机柜排风，将较暖空气引回机房空调盘管。')];
  const edges=[edge('coil','blower','fresh','降温后的机房空气'),edge('blower','cold','fresh','机组送风'),edge('cold','rackfan','fresh','冷通道 → 机柜进风面'),edge('rackfan','load','fresh','服务器风道'),edge('load','hot','hot','服务器排出的热空气'),edge('hot','coil','hot','机房热回风','loop')];
  return {mode:'air',title:'冷热通道空气循环',nodes,edges,legend:[['fresh','送风 / 进风'],['hot','排风 / 回风']],note:'空气回到 CRAH 盘管后重新降温。盘管内的设施冷冻水在独立水路中带走热量。',source:references.thermal};
}
function network(s){
  const mg=s.operating==='management'&&s.category==='network';
  const nodes=[node('tor',mg?'管理交换机':'ToR / 接入交换机','network','tor',mg?'独立管理网络用于监控、固件和带外管理访问。':'服务器接入机架或叶层交换设备，再经上层网络与其他服务器通信。'),node('patch','配线 / 跳线','network','patch','跳线接续交换端口和服务器端口。配线架整理和转接端口，理线架固定线缆。'),node('nic',mg?'管理网络端口':'服务器网卡','network','nic',mg?'管理网络端口连接服务器管理控制器。':'网卡接收和发送链路数据，并经主机 I/O 与服务器交换数据。'),node('server',mg?'服务器管理控制器':'服务器 / 计算托盘','rack',mg?'network':'frame',mg?'管理控制器通过独立通道传送运行状态与管理命令。':'应用运行在服务器或计算托盘上，跨服务器消息通过网卡进入集群网络。')];
  const edges=[edge('tor','patch','data',mg?'管理以太网跳线':'光纤或兼容铜缆 · 双向'),edge('patch','nic','data',mg?'管理以太网 · 双向':'端口与收发接口 · 双向'),edge('nic','server','data',mg?'管理接口 · 双向':'主机 I/O 互联 · 双向')];
  return {mode:'network',title:mg?'带外管理网络':'数据网络物理链路',nodes,edges,legend:[['data','双向收发']],note:mg?'管理通道与生产计算网络分别规划。':'具体交换机位置、跳线材质和速率按网络配置确定。GPU 柜内 NVLink 域另见 GPU 通信路径。',source:references.network};
}
function categoryMode(s,current){
  if(s.category==='liquid')return 'liquid';
  if(s.category==='air'||s.category==='fan')return 'air';
  if(s.category==='network')return 'network';
  if(s.category==='rack'){
    if(['manager','network','fabric'].includes(s.part))return 'network';
    if(s.part==='fan')return 'air';
    if(['cooling','thermal'].includes(s.part))return s.profile==='pcie'?'air':'liquid';
    if(['psu','power','pdu'].includes(s.part))return 'power';
    return current||'power';
  }
  return 'power';
}
export function relationGraph(mode,state={},variant){return mode==='liquid'?liquid():mode==='air'?air():mode==='network'?network(state):power(state,variant);}
function nodeFor(graph,s){
  const {category,part}=s;
  if(graph.mode==='power'&&graph.condition==='bypass'&&category==='ups')return graph.nodes.find(n=>n.id==='ups');
  if(graph.mode==='power'&&graph.condition==='stored'&&category==='hvdc'&&['storage','dcBus','frame'].includes(part))return graph.nodes.find(n=>n.id===(part==='storage'?'storage':'converter'));
  if(graph.mode==='power'&&category==='rack')return graph.nodes.find(n=>n.id===({pdu:graph.variant==='ac'?'pdu':'bus',psu:graph.variant==='ac'?'psu':'rackdc',power:graph.variant==='ac'?'psu':'rackdc'}[part]||'load'));
  if(graph.mode==='power'&&graph.variant!=='ac'&&['sst','800v','hvdc'].includes(category)){
    const component={dcBus:'bus',feeder:'dcrow',rackDc:'rackdc',frontEnd:graph.variant==='dc800'?'transformer':'converter'}[part]||'converter';
    return graph.nodes.find(n=>n.id===component);
  }
  if(graph.mode==='network'&&category==='rack')return graph.nodes.find(n=>n.id=== (part==='manager'?'patch':'server'));
  if(graph.mode==='network'&&category==='network'&&['optic','manager'].includes(part))return graph.nodes.find(n=>n.id==='patch');
  if(graph.mode==='air'&&category==='rack')return graph.nodes.find(n=>n.id=== (part==='fan'?'rackfan':'load'));
  if(graph.mode==='air'&&category==='air'&&part==='rack')return graph.nodes.find(n=>n.id==='load');
  if(graph.mode==='liquid'&&category==='rack')return graph.nodes.find(n=>n.id==='plates');
  if(graph.mode==='liquid'&&category==='liquid'&&(!part||part==='frame'||part==='cdu'))return graph.nodes.find(n=>n.id==='secondary');
  if(graph.mode==='liquid'&&category==='liquid'&&part==='primary')return graph.nodes.find(n=>n.id==='primary');
  const cat=n=>n.category===category || (n.category==='800v'&&category==='sst');
  return graph.nodes.find(n=>cat(n)&&n.part===part)||graph.nodes.find(n=>cat(n))||graph.nodes[0];
}
const NS='http://www.w3.org/2000/svg',make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
const svgEl=(tag,attrs)=>{const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
let sequence=0;
function geometry(graph,width,small){
  const footprint=new Map(),W=Math.max(180,width),H=52;
  const put=(n,x,y,w)=>footprint.set(n.id,{x:x*W,y,w,h:H});
  if(graph.mode==='liquid'){
    const mobile=[[.24,64],[.76,64],[.76,187],[.24,187],[.24,281],[.76,281]];
    const desktop=[[.105,122],[.34,122],[.57,122],[.76,44],[.89,122],[.76,200]];
    const positions=small?mobile:desktop;
    const w=small?Math.min(W*.397,164):Math.min(W*.158,148);
    graph.nodes.forEach((n,i)=>put(n,...positions[i],w));
    return {points:footprint,width:W,height:small?331:246,small};
  }
  const cols=small?2:graph.mode==='air'?3:4;
  const w=small?Math.min(.4*W,168):Math.min(W/cols*.76,170);
  const rows=Math.ceil(graph.nodes.length/cols),gap=small?83:91;
  graph.nodes.forEach((n,i)=>{const r=Math.floor(i/cols),c=i%cols,x=r%2?cols-1-c:c;put(n,(x+.5)/cols,43+r*gap,w);});
  return {points:footprint,width:W,height:(rows-1)*gap+88,small};
}
function routePoints(link,geo){
  const a=geo.points.get(link.from),b=geo.points.get(link.to);
  const anchor=(n,d)=>d==='top'?[n.x,n.y-n.h/2-2]:d==='bottom'?[n.x,n.y+n.h/2+2]:d==='left'?[n.x-n.w/2-2,n.y]:[n.x+n.w/2+2,n.y];
  if(link.route==='facilitySupply'||link.route==='facilityReturn'){
    const cold=link.route==='facilitySupply',side=cold?'top':'bottom',p=anchor(a,side),q=anchor(b,side),y=p[1]+(cold?-19:19);
    if(geo.small){p[0]+=cold?11:-11;q[0]+=cold?-11:11;}
    return [p,[p[0],y],[q[0],y],q];
  }
  if(link.route==='loop' && Math.abs(a.x-b.x)>1){
    const p=anchor(a,'bottom'),q=anchor(b,'left'),x=Math.max(6,q[0]-13),y=geo.height-7;return [p,[p[0],y],[x,y],[x,q[1]],q];
  }
  if(!geo.small && ['secSupply','secReturn','toPlate','fromPlate'].includes(link.route)){
    const types={secSupply:['top','left',true],toPlate:['right','top',false],fromPlate:['bottom','right',true],secReturn:['left','bottom',false]};
    const [sa,sb,vertical]=types[link.route],p=anchor(a,sa),q=anchor(b,sb);return [p,vertical?[p[0],q[1]]:[q[0],p[1]],q];
  }
  if(Math.abs(a.y-b.y)<1){const right=b.x>a.x;return [anchor(a,right?'right':'left'),anchor(b,right?'left':'right')];}
  if(Math.abs(a.x-b.x)<1){
    // In mobile air layout hot return occupies an outer lane beside the intermediate row.
    if(link.route==='loop' && Math.abs(a.y-b.y)>110){const p=anchor(a,'left'),q=anchor(b,'left'),x=Math.max(6,p[0]-13);return [p,[x,p[1]],[x,q[1]],q];}
    const down=b.y>a.y;return [anchor(a,down?'bottom':'top'),anchor(b,down?'top':'bottom')];
  }
  const p=anchor(a,'bottom'),q=anchor(b,'top'),half=(p[1]+q[1])/2;return [p,[p[0],half],[q[0],half],q];
}
function rounded(points){
  let d='M'+points[0].join(' ');
  for(let i=1;i<points.length-1;i++){
    const a=points[i-1],b=points[i],c=points[i+1],ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]);
    if(!ab||!bc)continue;
    const r=Math.min(7,ab/2,bc/2),u=[b[0]+(a[0]-b[0])*r/ab,b[1]+(a[1]-b[1])*r/ab],v=[b[0]+(c[0]-b[0])*r/bc,b[1]+(c[1]-b[1])*r/bc];
    d+=' L'+u.join(' ')+' Q'+b.join(' ')+' '+v.join(' ');
  }
  return d+' L'+points.at(-1).join(' ');
}
export function mountRelations(host,{onInspect,peerHost}={}){
  const uid='ga-rel-'+(++sequence),panel=make('section','grl-panel'),header=make('div','grl-head'),heading=make('h2','','设备连接'),controls=make('div','grl-controls');
  const tabs=make('div','grl-tabs'),play=make('button','grl-play');play.type='button';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','选择回路');
  const tabsByKey=new Map();for(const [key,name] of Object.entries(circuits)){const btn=make('button','',name);btn.type='button';btn.dataset.circuit=key;tabsByKey.set(key,btn);tabs.append(btn);}
  controls.append(tabs,play);header.append(heading,controls);
  const subtitle=make('div','grl-sub'),board=make('div','grl-board'),ink=svgEl('svg',{'aria-hidden':'true',focusable:'false'}),nodes=make('div','grl-nodes');
  nodes.setAttribute('role','group');nodes.setAttribute('aria-label','沿设备关系图查看');board.append(ink,nodes);
  const legend=make('div','grl-legend'),detail=make('div','grl-detail'),title=make('h3'),note=make('p'),neighbors=make('div','grl-neighbors');
  detail.append(title,note);(peerHost||detail).append(neighbors);
  const foot=make('div','grl-foot'),scope=make('span'),source=make('a');source.target='_blank';source.rel='noopener noreferrer';foot.append(scope,source);
  panel.append(header,subtitle,board,legend,detail,foot);host.replaceChildren(panel);
  const motion=matchMedia('(prefers-reduced-motion: reduce)');let playing=!motion.matches,active=false,mode='power',variant='ac',selected='',pending=null,state={},graph,width=0,disposed=false;
  const mediaKinds={power:'#e6b975',inactive:'#91a1ab',cold:'#79cce5',warm:'#efa875',heat:'#e7c09e',fresh:'#81d8dc',hot:'#edaa77',data:'#aba7f0'};
  function playback(){const run=active&&playing&&!motion.matches&&!document.hidden;panel.dataset.moving=String(run);play.disabled=motion.matches;play.textContent=motion.matches?'静态显示':playing?'暂停流向':'播放流向';play.setAttribute('aria-pressed',String(run));}
  function pick(n){
    if(!n)return;
    selected=n.id;pending={category:n.category,part:n.part};draw();
    onInspect?.(n.category,n.part,{circuit:mode,nodeId:n.id,architecture:graph.variant&&archNames[graph.variant]});
  }
  function setCircuit(key){
    if(key===mode)return;
    mode=key;if(mode==='power')variant=currentArch(state);
    graph=relationGraph(mode,state,variant);
    const matching=graph.nodes.find(n=>n.category===state.category&&n.part===state.part)||graph.nodes.find(n=>n.category===state.category);
    pick(matching||graph.nodes[0]);
  }
  for(const [key,btn] of tabsByKey)btn.onclick=()=>setCircuit(key);
  play.onclick=()=>{playing=!playing;playback();};
  const changeMotion=()=>{if(motion.matches)playing=false;playback();};motion.addEventListener?.('change',changeMotion);document.addEventListener('visibilitychange',playback);
  function draw(){
    if(!active||!graph)return;
    const before=document.activeElement?.closest('[data-rel-node]'),restore=before&&host.contains(before)?before.dataset.relNode:null;
    const actual=Math.round(board.getBoundingClientRect().width)||width||700;width=actual;
    const geo=geometry(graph,actual,actual<575),sel=graph.nodes.find(n=>n.id===selected)||graph.nodes[0];selected=sel.id;
    board.style.height=geo.height+'px';ink.setAttribute('viewBox',`0 0 ${actual} ${geo.height}`);ink.replaceChildren();nodes.replaceChildren();
    const defs=svgEl('defs',{});for(const [kind,color] of Object.entries(mediaKinds)){
      const mark=svgEl('marker',{id:uid+'-'+kind,viewBox:'0 0 8 8',refX:7,refY:4,markerWidth:6,markerHeight:6,orient:'auto-start-reverse',markerUnits:'userSpaceOnUse'});
      mark.append(svgEl('path',{d:'M0 0 L8 4 L0 8 Z',fill:color}));defs.append(mark);
    }ink.append(defs);
    for(const e of graph.edges){
      const path=rounded(routePoints(e,geo)),color=mediaKinds[e.inactive?'inactive':e.kind],s=e.from===selected||e.to===selected;
      const attrs={d:path,fill:'none',stroke:color,'stroke-width':s?2.1:1.45,opacity:s?1:.74,'marker-end':`url(#${uid}-${e.kind})`};
      if(e.kind==='data')attrs['marker-start']=attrs['marker-end'];if(e.kind==='heat'||e.inactive)attrs['stroke-dasharray']='3 4';
      if(e.inactive)delete attrs['marker-end'];
      ink.append(svgEl('path',attrs));
      if(s&&!e.inactive&&e.kind!=='heat'&&e.kind!=='data')ink.append(svgEl('path',{d:path,fill:'none',stroke:'#f6fffa','stroke-width':1.65,class:'grl-flow'}));
      if(s&&e.kind==='data')ink.append(svgEl('path',{d:path,fill:'none',stroke:'#e8e5ff','stroke-width':1.8,class:'grl-signal'}));
    }
    for(const n of graph.nodes){
      const p=geo.points.get(n.id),b=make('button','grl-node',n.title);b.type='button';b.dataset.relNode=n.id;b.setAttribute('aria-pressed',String(n.id===selected));b.title=n.note;
      b.style.cssText=`left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px`;
      b.onclick=()=>pick(n);nodes.append(b);
      if(n.id===restore)b.focus({preventScroll:true});
    }
    for(const [key,b] of tabsByKey)b.setAttribute('aria-pressed',String(key===mode));
    subtitle.textContent=graph.title+(mode==='power'&&state.architecture&&graph.variant!==defaultArch(state.architecture)?' · 单设备参考，园区方案为'+state.architecture:' · 参考连接');legend.replaceChildren();
    for(const [kind,name] of graph.legend){const l=make('span','',name),i=make('i');i.style.setProperty('--rel-color',mediaKinds[kind]);if(kind==='heat'||kind==='inactive')i.className='grl-dash';l.prepend(i);legend.append(l);}
    title.textContent=sel.title;note.textContent=sel.note;neighbors.replaceChildren();
    const inbound=graph.edges.filter(e=>e.to===selected),outbound=graph.edges.filter(e=>e.from===selected);
    function neighbor(e,incoming){
      const other=graph.nodes.find(n=>n.id===(incoming?e.from:e.to));const button=make('button','grl-peer');button.type='button';button.dataset.relPeer=other.id;
      const label=e.kind==='heat'?(incoming?'热量来自':'热量传往'):e.kind==='data'?'双向连接':incoming?'上游':'下游';
      button.append(make('span','grl-direction',label),make('b','',other.title),make('small','',e.medium+(e.inactive?' · 无负载电流':'')));button.style.setProperty('--rel-color',mediaKinds[e.inactive?'inactive':e.kind]);button.onclick=()=>{pick(other);nodes.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});};neighbors.append(button);
    }
    function boundary(label,name,medium){const item=make('div','grl-peer grl-boundary');item.append(make('span','grl-direction',label),make('b','',name),make('small','',medium));neighbors.append(item);}
    if(mode==='power'&&!inbound.length){
      if(sel.id==='storage')boundary('能量来源','电池储能','设备内部 · 直流');
      else if(sel.id==='bypassSource')boundary('上游','旁路供电系统','外部边界 · 交流');
      else boundary('上游','园区进线','外部边界 · 中压交流馈线');
    }
    if(mode==='network'&&!inbound.length)boundary('双向连接','上层交换网络','外部边界 · 交换机上联');
    inbound.forEach(e=>neighbor(e,true));outbound.forEach(e=>neighbor(e,false));
    if(mode==='power'&&!outbound.length)boundary('下游','CPU、GPU 等器件','板内电源轨 · 直流');
    if(mode==='network'&&!outbound.length)boundary('双向连接','主机或管理程序','设备内部 · 数据收发');
    scope.textContent=graph.note;source.textContent=graph.source[0]+' ↗';source.href=graph.source[1];playback();
  }
  nodes.addEventListener('keydown',e=>{
    if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
    const ops=[...nodes.children],i=ops.indexOf(document.activeElement);if(i<0)return;e.preventDefault();
    const j=e.key==='Home'?0:e.key==='End'?ops.length-1:(i+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)+ops.length)%ops.length;ops[j].focus();
  });
  function update(s={}){
    if(disposed)return;
    const samePending=pending && (s.category===pending.category || (pending.category==='800v'&&s.category==='sst')) && (!s.part||s.part==='frame'||s.part===pending.part);
    const useProjectArchitecture=samePending && mode==='power' && (graph.condition!==powerCondition(s)||graph.variant!==currentArch(s)&&['rowdist','pdu','psu','switchgear','rack'].includes(s.category));
    const prev=JSON.stringify([state.category,state.part,state.architecture,state.profile,state.cooling,state.level,state.operating,state.condition]);
    const signature=JSON.stringify([s.category,s.part,s.architecture,s.profile,s.cooling,s.level,s.operating,s.condition]);
    state={...s};const was=active;active=true;
    if(samePending && pending.part===s.part)pending=null;
    if(was && signature===prev && nodes.childElementCount&&!useProjectArchitecture){playback();return;}
    if(!samePending||useProjectArchitecture){pending=null;mode=categoryMode(s,mode);variant=currentArch(s);graph=relationGraph(mode,s,variant);selected=nodeFor(graph,s)?.id||graph.nodes[0].id;}
    draw();
  }
  const resize=new ResizeObserver(()=>{const w=Math.round(board.getBoundingClientRect().width);if(w&&w!==width)draw();});resize.observe(board);
  return {update,pause(){active=false;pending=null;playback();},destroy(){disposed=true;active=false;resize.disconnect();motion.removeEventListener?.('change',changeMotion);document.removeEventListener('visibilitychange',playback);neighbors.remove();panel.remove();}};
}
