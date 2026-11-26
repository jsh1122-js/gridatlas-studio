/* Physical interfaces among the displayed station, facility and rack examples. */
((root) => {
  'use strict';
  const defaults = {architecture:'交流 UPS',cooling:'混合冷却',profile:'gb200'};
  const sources = {
    '交流 UPS':'ups','800V 直流':'800v','SST 800V 直流':'sst','集中式 HVDC':'hvdc'
  };
  const profiles = {gb200:'GB200 NVL72',gb300:'GB300 NVL72',pcie:'PCIe'};
  const circuitNames = {power:'供电',liquid:'液冷',air:'风冷',data:'数据'};
  const devices = {
    'sub-incoming':['变电站进线终端','进线导体在这里接入园区站，经过站内高压侧开关和保护接向主变。','switchgear/cable'],
    'sub-transformer':['变电站主变压器','主变将站外来电降为园区配电所需的中压交流，向站内中压母线送电。','transformer/core'],
    'sub-switchgear':['变电站中压开关设备','主变二次侧接入母线，各出线间隔的开关和保护负责接通、分断所属馈线。','switchgear/breaker'],
    'sub-feeder':['变电站出线回路','这条受保护的出线从站内开关间隔引出，通过电缆把中压交流送到机房配电区。','switchgear/cable'],
    switchgear:['机房中压开关柜','接收园区中压馈线，并对通往本机房的下一段供电回路实施开关和保护。','switchgear/breaker'],
    transformer:['机房配电变压器','接收机房侧中压交流，将电压降到 UPS 或整流设备的交流输入等级。','transformer/lowSide'],
    ups:['交流 UPS','常规双变换工况下，UPS 将交流整流后再逆变，向机房负载输出交流。电池可在输入中断时支撑逆变器。','ups/frame'],
    '800v':['800 V 集中整流设备','工频配电变压器先降压，集中整流设备再将低压交流变为 800 V 直流。','800v/isolation'],
    sst:['800 V 固态变压器','本例的 SST 在设施侧完成电能变换与电气隔离，由中压交流输入建立 800 V 直流母线。','sst/isolation'],
    hvdc:['集中式 HVDC','集中整流模块接收低压交流并建立直流母线，电能从受保护的馈线送往兼容负载。','hvdc/frontEnd'],
    rowdist:['列头柜','列头柜接受上游供电，按机柜分出多个支路，并提供相应的支路保护。','rowdist/branches'],
    pdu:['机柜 PDU','接收本列分支馈电，向机柜中多个电源模块分配电能。','pdu/outlets'],
    psu:['机柜电源模块','电源模块把上游输入变换为服务器或机柜内部可用的低压直流。','psu/converter'],
    rack:['算力机柜','服务器从柜内供电系统取电，经网卡交换数据。机柜产生的热量随所选冷却回路排出。','rack/frame'],
    outdoor:['室外冷却机组','室外机组通过风机和换热面向室外空气排热。各台设备接在设施侧供、回水总管，冷量由设施水系统送往机房换热设备。','liquid/primary'],
    liquid:['液冷 CDU','CDU 在换热器中把设备侧冷却液的热量传给设施水。一次侧和二次侧各自闭合循环。','liquid/cdu'],
    air:['机房空气处理机组','回风经过 CRAH 冷却盘管降温，送风机再将空气送往机柜进风面。','air/coil'],
    fan:['机房送风机','这台风机安装在空气处理机组内，建立压差，让机房空气流经冷通道、机柜和回风通道。','air/fan'],
    network:['机架接入交换机','交换端口经配线和跳线连接服务器网卡，双向传输网络数据，并通过上联与机架外网络通信。','network/tor']
  };
  const aliases = {gis:'switchgear',cdu:'liquid',it:'rack',tor:'network'};
  const canonical = key => {
    const raw=String(key||'').split('/')[0];
    return raw.startsWith('rack:')?'rack':aliases[raw]||raw;
  };
  const transformerKey=n=>n===1?'sub-transformer':'sub-transformer-'+n;
  const transformerNumber=k=>k==='sub-transformer'?1:/^sub-transformer-[2-4]$/.test(k)?Number(k.slice(-1)):0;
  const installedUnits=options=>Math.min(4,Math.max(2,Math.trunc(Number(options?.yardUnits))||2));
  const installedCooling=options=>Math.min(14,Math.max(2,Math.trunc(Number(options?.coolingUnits))||10));
  const coolingKey=n=>'cooling-unit-'+n;
  const coolingNumber=k=>/^cooling-unit-[1-9]\d*$/.test(k)?Number(k.slice(13)):0;
  const chosenCooling=options=>Math.min(installedCooling(options),Math.max(1,Math.trunc(Number(options?.coolingUnit))||1));
  function resolveSceneKey(target,options={}) {
    const key=canonical(target);
    const station=/^sub-transformer(?:-(\d+))?$/.exec(key);
    if(station)return transformerKey(Math.min(installedUnits(options),Math.max(1,Number(station[1]||1))));
    if(key==='cooling')return coolingKey(chosenCooling(options));
    if(/^cooling-unit-\d+$/.test(key))return coolingKey(Math.min(installedCooling(options),Math.max(1,Number(key.slice(13)))));
    if(Object.values(sources).includes(key)){
      const architecture=Object.hasOwn(sources,options?.architecture)?options.architecture:defaults.architecture;
      return sources[architecture];
    }
    if(key==='liquid'&&options?.cooling==='风冷')return 'air';
    return key;
  }

  function describe(target,options={}) {
    const raw=canonical(target),key=raw==='cooling'?coolingKey(chosenCooling(options)):raw;
    const unit=transformerNumber(key),outdoorNumber=coolingNumber(key);
    const baseKey=unit?'sub-transformer':outdoorNumber?'outdoor':key;
    if(raw==='outdoor')return null;
    if (!Object.hasOwn(devices,baseKey)) return null;
    const yardUnits=installedUnits(options);
    if(unit>yardUnits)return null;
    const yardUnit=unit||Math.min(yardUnits,Math.max(1,Math.trunc(Number(options.yardUnit))||1));
    const main=transformerKey(yardUnit);
    const coolingUnits=installedCooling(options),coolingUnit=outdoorNumber||chosenCooling(options),plant=coolingKey(coolingUnit);
    if(outdoorNumber>coolingUnits)return null;
    const requested=Object.hasOwn(sources,options.architecture)?options.architecture:defaults.architecture;
    const profile=String(target).startsWith('rack:')?String(target).slice(5):options.profile||defaults.profile;
    const cooling=options.cooling||defaults.cooling;
    const standalone=Object.keys(sources).find(name=>sources[name]===key);
    const architecture=standalone||requested,converter=sources[architecture],dc=converter!=='ups';
    const reference=standalone&&standalone!==requested;
    const titleOf=k=>{
      if(transformerNumber(k))return '变电站 '+transformerNumber(k)+' 号主变';
      if(coolingNumber(k))return '室外冷却机组 '+String(coolingNumber(k)).padStart(2,'0');
      if(k==='rowdist')return dc?'直流列头柜':'交流列头柜';
      if(k==='pdu')return dc?'机架直流分配':'机柜 PDU';
      if(k==='psu')return dc?'机架侧 DC/DC':'机柜 PSU';
      if(k==='rack'&&Object.hasOwn(profiles,profile))return profiles[profile]+' 机柜';
      return devices[k][0];
    };
    function detailOf(k){
      if(coolingNumber(k))return cooling==='风冷'?'air/coil':'liquid/primary';
      if(k==='pdu'&&dc)return 'pdu/rail';
      if(k==='rack'&&Object.hasOwn(profiles,profile))return 'rack:'+profile;
      return devices[transformerNumber(k)?'sub-transformer':k][2];
    }
    const links=[],boundaries=[];
    const available = options.availableKeys==null?null:new Set(Array.from(options.availableKeys,k=>canonical(k)==='cooling'?plant:canonical(k)));
    const boundary=(label,relation,medium,role,direction,circuit,kind)=>boundaries.push({label,relation,medium,role,direction,circuit,kind});
    function connect(from,to,circuit,kind,medium,fromRole,toRole,bidirectional=false,loop='') {
      if(key!==from&&key!==to)return;
      const outgoing=key===from,neighbor=outgoing?to:from;
      const direction=bidirectional?'both':outgoing?'out':'in';
      const fluid=circuit==='liquid';
      const water=loop==='facility';
      const relation=water?(kind==='supply'?(outgoing?'供水至':'供水来自'):(outgoing?'回水至':'回水来自')):
        bidirectional?'双向通信':kind==='power'?(outgoing?'下游供电':'上游来电'):
        kind==='return'?(outgoing?(fluid?'回液至':'回风至'):(fluid?'回液来自':'回风来自')):
        (outgoing?(fluid?'供液至':'送风至'):(fluid?'供液来自':'冷风来自'));
      const role=outgoing?toRole:fromRole;
      const link={id:[circuit,kind,from,to].join('.'),from,to,key:neighbor,label:titleOf(neighbor),relation,medium,role,direction,circuit,kind,loop,detailTarget:detailOf(neighbor)};
      if(available&&!available.has(neighbor))boundary(link.label,relation,medium,role,direction,circuit,kind);
      else links.push(link);
    }
    const power=(from,to,medium,fromRole,toRole)=>connect(from,to,'power','power',medium,fromRole,toRole);
    power('sub-incoming',main,'站内高压交流连接','进线终端把外部来电引入站内高压侧。','主变一次绕组接收高压交流并通过磁场传递能量。');
    power(main,'sub-switchgear','主变二次侧 · 中压交流','主变把电能送至园区中压母线。','中压开关设备将母线电源分配到各出线间隔。');
    power('sub-switchgear','sub-feeder','中压母线与出线间隔','出线断路器控制并保护对应的馈电支路。','出线电缆承接这个间隔送出的中压交流。');
    power('sub-feeder','switchgear','园区中压馈线','站内出线将中压交流送往本机房。','机房进线柜接收电缆馈电，并向本机房配电。');
    if(converter==='sst'){
      power('switchgear','sst','中压交流电缆','中压开关柜向 SST 提供受保护的馈电。','SST 由中压交流输入，经隔离变换输出直流。');
    }else{
      power('switchgear','transformer','中压交流电缆','中压开关柜控制配变的进线。','机房配变对交流降压，向下一级设备送电。');
      power('transformer',converter,'配变低压侧 · 交流','配电变压器提供适配输入等级的交流电。',dc?'集中设备将低压交流整流为直流。':'UPS 接受低压交流，经整流和逆变向列端送电。');
    }
    const distribution=dc?(converter==='hvdc'?'受保护的直流馈线':'800 V 直流馈线'):'UPS 输出 · 低压交流';
    power(converter,'rowdist',distribution,dc?'设施变换设备从直流母线向列端送电。':'UPS 输出经过保护后送往列端。','列头柜接收上游电源，并分别保护各机柜支路。');
    power('rowdist','pdu',dc?'列端直流支路':'列端交流支路','列头柜的分支回路接至本柜电源入口。',dc?'兼容的机架直流分配装置把馈电引到各模块。':'机柜 PDU 将支路交流分配给柜内电源。');
    power('pdu','psu',dc?'机架直流输入':'PDU 输出电源线 · 交流','机架配电装置为电源模块提供匹配的输入。',dc?'DC/DC 模块将设施侧直流变为机架内低压直流。':'PSU 将交流输入变换为低压直流。');
    power('psu','rack',profile==='pcie'?'服务器电源背板 · 直流':'机柜共用母排 · 直流','电源模块向低压直流母排或服务器背板供电。','服务器接收低压直流，再由板级调压电路供给芯片。');
    if(cooling!=='风冷'){
      connect(plant,'liquid','liquid','supply','设施供水总管 → CDU 一次侧','室外排热支路通过设施水系统向机房侧提供冷量。','设施水在 CDU 一次侧流经换热器，吸收设备侧的热量。',false,'facility');
      connect('liquid',plant,'liquid','return','CDU 一次侧 → 设施回水总管','CDU 一次侧的设施水吸热后汇入回水管。','室外机组所在支路将设施系统汇集的热量排到室外空气。',false,'facility');
    }
    if(cooling!=='冷板液冷'){
      connect(plant,'air','liquid','supply','设施供水总管 → CRAH 冷冻水盘管','室外排热支路与机房冷冻水系统换热，经供水总管提供冷量。','冷冻水进入 CRAH 盘管，在盘管内吸收机房回风传来的热量。',false,'facility');
      connect('air',plant,'liquid','return','CRAH 盘管 → 设施回水总管','从盘管流出的冷冻水通过回水管将热量带回设施侧。','室外机组所在的排热支路将这部分热量释放到室外空气。',false,'facility');
    }
    if(cooling!=='风冷'||key==='liquid'){
      connect('liquid','rack','liquid','supply','二次侧供液管 · 冷却液','CDU 将降温后的技术冷却液送出。','机柜供液歧管把冷却液分配至芯片冷板。',false,'secondary');
      connect('rack','liquid','liquid','return','二次侧回液管 · 冷却液','冷板吸热后，回液歧管汇集升温的冷却液。','CDU 由换热壁将热量传给设施水，二次侧冷却液继续循环。',false,'secondary');
    }
    const airUse=cooling==='冷板液冷'?'余热':'机柜热量';
    connect('air','fan','air','supply','盘管下游 · 低温空气','机组内冷却盘管使回风降温。','送风机为低温空气提供流经冷通道的压差。');
    connect('fan','rack','air','supply','冷通道 · 供风','送风机推动冷空气流向机柜进风面。','冷空气流过风冷部件并带走'+airUse+'。');
    connect('rack','air','air','return','热通道 · 回风','机柜排出的暖空气带走'+airUse+'。','机组盘管接收较暖回风，并将热量传入设施冷冻水。');
    connect('network','rack','data','signal','网络跳线、收发接口','接入交换机在服务器端口与上联端口之间转发数据。','网卡接收或发出数据，与服务器主机 I/O 交换信息。',true);

    if(key==='sub-incoming')boundary('站外电源','上游来电','高压交流线路','外部供电边界，进线电压和接入点由项目接入方案确定。','in','power','power');
    if(key==='liquid'&&cooling==='风冷'){
      boundary('设施冷源','一次侧供水','设施供水管','低温设施水流入 CDU 的一次侧。','in','liquid','supply');
      boundary('设施冷源','一次侧回水','设施回水管','设施水吸收二次侧热量，升温后返回冷源。','out','liquid','return');
    }
    if(key==='air'&&cooling==='冷板液冷')boundary('辅助设施冷冻水系统','盘管换热','冷冻水供、回水管','如另设空气冷却支路，盘管水路将机房余热带回设施侧。','both','air','return');
    if(outdoorNumber)boundary('室外空气','向环境排热','室外换热面与气流','风机使空气掠过换热面，热量排出园区设施水系统。实际冷机、泵与中间换热环节按设计配置。','out','air','return');
    if(key==='network')boundary('上层交换网络','双向通信','交换机上联 · 网络链路','接入交换机通过上联与机架外网络交换数据。','both','data','signal');
    let summary=devices[baseKey][1],context=reference?'单设备参考 · 园区方案为'+requested:'';
    if(key==='transformer'&&converter==='sst'){
      summary='本方案的 IT 主路由中压开关柜直接接入 SST。常规配电变压器可用于另设的辅助交流负荷，具体支路需项目图纸确认。';
      boundary('辅助交流负荷','可能的低压侧','低压交流支路','辅助负荷的设备类型和馈线归属待项目确定。','out','power','power');
      const site={id:'reference.transformer.switchgear',key:'switchgear',label:titleOf('switchgear'),relation:'查看主路入口',medium:'SST 方案的中压进线',role:'可沿机房中压开关柜查看 IT 主路。',direction:'both',circuit:'power',kind:'reference',detailTarget:detailOf('switchgear')};
      if(!available||available.has(site.key))links.push(site);
    }
    if(key==='pdu'&&dc)summary='机架直流配电装置接收列端直流馈线，并把电能送到输入电压相匹配的 DC/DC 模块。';
    if(key==='psu'&&dc)summary='机架侧 DC/DC 模块将设施侧直流输入降为柜内低压直流。模块与服务器须满足所选输入电压和接口要求。';
    if(key.startsWith('sub-'))context='园区变电站示意';
    if(outdoorNumber)context='室外冷却区 · '+coolingUnits+' 台设备';
    if(['sub-incoming','sub-switchgear'].includes(key))summary+='本次追踪 '+yardUnit+' 号主变的示意支路。';
    if(key==='rack'&&cooling==='风冷'&&profile!=='pcie')context='风冷机房方案 · NVL72 样机的冷板另需液冷接口';
    const circuit=outdoorNumber||key==='liquid'?'liquid':['air','fan'].includes(key)?'air':key==='network'?'data':'power';
    const directory=[
      ['园区变电站',['sub-incoming',...Array.from({length:yardUnits},(_,i)=>transformerKey(i+1)),'sub-switchgear','sub-feeder']],
      ['室外冷却机组',Array.from({length:coolingUnits},(_,i)=>coolingKey(i+1))],
      ['机房供配电',['switchgear','transformer',sources[requested],'rowdist','pdu','psu']],
      ['制冷与送风',cooling==='风冷'?['air','fan']:['liquid','air','fan']],
      ['机柜与网络',['rack','network']]
    ].map(([label,keys])=>({label,items:keys.filter(k=>!available||available.has(k)).map(k=>({key:k,label:titleOf(k)}))})).filter(group=>group.items.length);
    if(!directory.some(g=>g.items.some(i=>i.key===key)))directory.push({label:'当前参考设备',items:[{key,label:titleOf(key)}]});
    const detailLabel={outdoor:cooling==='风冷'?'查看 CRAH 盘管':'查看 CDU 一次侧',rack:'打开机柜',psu:'查看 PSU 槽位','sub-incoming':'查看端子示例','sub-transformer':'查看变压原理','sub-switchgear':'查看开断原理','sub-feeder':'查看出线示例'}[baseKey]||'部件剖解';
    return {key,title:titleOf(key),summary,circuit,architecture,context,links,boundaries,directory,detailTarget:detailOf(key),detailLabel,yardUnit,yardUnits,coolingUnit,coolingUnits};
  }

  const element=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  function mount(host,{onSelect,onDetail,onBack,onPreview,onView,onParts,onCoolingTour}={}){
    const box=element('section','tdl-panel'),head=element('div','tdl-head'),left=element('div','tdl-heading');
    const category=element('span','tdl-category'),title=element('h3'),summary=element('p','tdl-summary');
    title.tabIndex=-1;left.append(category,title);head.append(left);
    function action(name,fn){const b=element('button','tdl-action',name);b.type='button';b.addEventListener('click',fn);return b;}
    let data=null,followed=false,disposed=false,previewId='',closeView=false;
    const actions=element('div','tdl-actions'),label=element('label','tdl-picker'),picker=element('select');
    label.append(element('span','','切换设备'),picker);actions.append(label);
    picker.addEventListener('change',()=>{followed=true;onSelect?.(picker.value,null);});
    const previewLabel=element('label','tdl-picker'),preview=element('select');previewLabel.append(element('span','','演示连接'),preview);
    if(onPreview)actions.append(previewLabel);
    function markPreview(){
      for(const button of list.children)button.classList.toggle('tdl-featured',Boolean(previewId)&&button.dataset.linkId===previewId);
    }
    function resetPreview(){
      if(!previewId)return;
      previewId='';preview.value='';markPreview();onPreview?.(null);
    }
    preview.addEventListener('change',()=>{
      previewId=preview.value;markPreview();
      onPreview?.(data?.links.find(l=>l.id===previewId)||null);
    });
    const detailButton=action('部件剖解',()=>data&&onDetail?.(data.detailTarget,data));
    const partsHost=element('div');partsHost.id='tw-cooling-parts';partsHost.hidden=true;
    const partsButton=action('查看机组部件',()=>onParts?.());
    const coolingTourButton=action('从本机开始冷却讲解',()=>data&&onCoolingTour?.(data.coolingUnit));
    coolingTourButton.id='tw-device-cooling-tour';coolingTourButton.hidden=true;
    partsButton.hidden=true;partsButton.setAttribute('aria-controls',partsHost.id);
    function setPartsOpen(value){
      partsButton.setAttribute('aria-expanded',String(value));
      partsButton.textContent=value?'收起机组部件':'查看机组部件';
    }
    setPartsOpen(false);
    const viewButton=action('设备近景',()=>data&&onView?.(!closeView,data));
    function setCloseView(value){closeView=Boolean(value);viewButton.setAttribute('aria-pressed',String(closeView));viewButton.textContent=closeView?'查看联动':'设备近景';}
    setCloseView(false);if(onView)actions.append(viewButton);
    if(onCoolingTour)actions.append(coolingTourButton);
    if(onParts)actions.append(partsButton);
    if(onDetail)actions.append(detailButton);
    const backButton=action('返回机房',()=>onBack?.());
    if(onBack)actions.append(backButton);
    head.append(actions);
    const list=element('div','tdl-links'),extra=element('details','tdl-boundaries'),extraTitle=element('summary','','系统边界'),bound=element('ul');extra.append(extraTitle,bound);
    box.append(head,summary,partsHost,list,extra);host.replaceChildren(box);host.hidden=true;
    function update(key,options){
      if(disposed)return null;
      if(key&&typeof key==='object'){options=key;key=options.key;}
      const next=describe(key,options||{});
      if(!next){clear();return null;}
      const changed=next.key!==data?.key;data=next;
      partsButton.hidden=!coolingNumber(data.key);
      coolingTourButton.hidden=partsButton.hidden;
      detailButton.textContent=data.detailLabel;
      backButton.textContent=data.key.startsWith('sub-')||coolingNumber(data.key)?'返回园区':'返回机房';
      const physical=data.links.filter(l=>l.kind!=='reference');
      if(changed||!physical.some(l=>l.id===previewId))resetPreview();
      preview.replaceChildren(new Option('全部连接',''),...physical.map(l=>new Option(l.relation+' · '+l.label,l.id)));
      preview.value=previewId;previewLabel.hidden=!physical.length;
      picker.replaceChildren(...data.directory.map(group=>{
        const options=document.createElement('optgroup');options.label=group.label;
        for(const entry of group.items)options.append(new Option(entry.label,entry.key));
        return options;
      }));picker.value=data.key;
      host.hidden=false;title.textContent=data.title;category.textContent=(coolingNumber(data.key)?'设施冷却':circuitNames[data.circuit]||'设备')+' · '+(data.context||'设备连接');summary.textContent=data.summary;
      list.replaceChildren(...data.links.map(link=>{
        const b=element('button','tdl-link');b.type='button';b.dataset.deviceKey=link.key;b.dataset.linkKind=link.kind;b.dataset.linkId=link.id;
        const line=element('span','tdl-link-head'),direction=element('small','tdl-rel',link.relation),label=element('strong','',link.label);
        line.append(direction,label,element('span','tdl-chevron','›'));b.append(line,element('span','tdl-medium',link.medium),element('span','tdl-role',link.role));
        b.addEventListener('click',()=>{followed=true;onSelect?.(link.key,link);});return b;
      }));
      markPreview();
      extra.hidden=!data.boundaries.length;if(changed)extra.open=false;
      bound.replaceChildren(...data.boundaries.map(v=>{
        const item=element('li');item.append(element('b','',v.label+' · '+v.relation),element('span','',v.medium+'。'+v.role));return item;
      }));
      if(followed&&changed){followed=false;title.focus({preventScroll:true});}
      return data;
    }
    function clear(){data=null;followed=false;host.hidden=true;resetPreview();}
    return {update,clear,setCloseView,partsHost,setPartsOpen,destroy(){disposed=true;clear();box.remove();}};
  }
  root.GridDeviceLinks=Object.freeze({describe,resolveSceneKey,mount});
})(typeof window==='undefined'?globalThis:window);
