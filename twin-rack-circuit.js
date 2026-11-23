/* A wiring example for the selected rack symbol. Positions come from the actual scene layout. */
((root) => {
  'use strict';

  const profiles = {gb200:'GB200 NVL72', gb300:'GB300 NVL72', pcie:'PCIe'};
  const architectures = ['交流 UPS','800V 直流','SST 800V 直流','集中式 HVDC'];
  const sources = {
    gb200: 'https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html',
    gb300: 'https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html',
    pcie: 'https://www.dell.com/support/manuals/en-us/poweredge-r7415/per7415_ism/power-supply-units?guid=guid-77033845-b4d0-4be7-ab2d-71e45cbcd0dc&lang=en-us',
    dc: 'https://www.nvidia.com/en-us/data-center/technologies/800-vdc-architecture/',
    hvdc: 'https://www.vertiv.com/en-emea/products-catalog/critical-power/dc-power-systems/netsure-400v-dc-distributed-system/'
  };
  const serial = n => String(n).padStart(2,'0');
  const node = (id,label,kind,index,fields={}) => ({id,label,kind,index,...fields});
  function checkInteger(n,min,max,key) {
    if (!Number.isSafeInteger(n) || n < min || n > max) throw new RangeError(key+' 超出机柜示意数据范围。');
    return n;
  }

  // rowIndex identifies the physical rack row (q in the hall mesh). columnIndex is a position along it.
  // All spatial indices are zero-based. module.slot is a one-based number printed on the enclosure.
  function build({hallIndex=0,rackIndex=0,rowIndex=0,columnIndex=0,profile='gb200',architecture='交流 UPS',pcieServers=6}={}) {
    for (const [key,n] of Object.entries({hallIndex,rackIndex,rowIndex,columnIndex})) {
      checkInteger(n,0,Number.MAX_SAFE_INTEGER-1,key);
    }
    if (!Object.hasOwn(profiles,profile)) throw new RangeError('未知机柜型号。');
    if (!architectures.includes(architecture)) throw new RangeError('未知供电架构。');
    const pcie = profile === 'pcie', isDC = architecture !== '交流 UPS';
    const serverCount = pcie ? checkInteger(pcieServers,1,10,'PCIe 服务器数') : 18;
    const displayedServers = pcie ? Math.min(4,serverCount) : serverCount;
    const hallCode = 'H'+serial(hallIndex+1), rowCode = 'L'+serial(rowIndex+1);
    const id = hallCode+'-R'+serial(rackIndex+1);
    const label = '机房 '+serial(hallIndex+1)+' · 第 '+serial(rowIndex+1)+' 列 · 柜位 '+serial(columnIndex+1);
    const rowdist = node(hallCode+'-'+rowCode+'-RD','第 '+serial(rowIndex+1)+' 列'+(isDC?'直流列头柜':'交流列头柜'),'rowdist',rowIndex,{hallIndex,rowIndex});
    const pdus = ['A','B'].map((feed,index) => node(id+'-PDU-'+feed,
      isDC?'机架直流分配 '+feed:'机柜 PDU '+feed,'pdu',index,{feed,rowdistId:rowdist.id}));
    const servers = Array.from({length:displayedServers},(_,i) => node(id+(pcie?'-S':'-T')+serial(i+1),
      (pcie?'服务器 ':'计算托盘 ')+serial(i+1),'server',i,{number:i+1}));
    const buses = pcie ? servers.map(s => node(id+'-BOARD'+serial(s.number),
      '服务器 '+serial(s.number)+' 电源背板','bus',s.index,{serverIds:[s.id]})) :
      [node(id+'-BUS','机柜共用直流母排','bus',0,{serverIds:servers.map(s=>s.id)})];
    const moduleCount = pcie ? displayedServers*2 : 4;
    const modules = Array.from({length:moduleCount},(_,i) => {
      const pdu = pdus[i%2], bus = buses[pcie?Math.floor(i/2):0], slot = i+1;
      const type = isDC?'DC/DC':'PSU';
      return node(id+'-M'+serial(slot),type+' '+serial(slot),'psu',i,{
        slot,feed:pdu.feed,pduId:pdu.id,busId:bus.id,serverIds:[...bus.serverIds],type
      });
    });

    const edges = [];
    const connect = (from,to,medium) => edges.push({id:from.id+'>'+to.id,from:from.id,to:to.id,medium});
    const inputMedium = !isDC?'交流馈线':architecture==='集中式 HVDC'?'直流馈线':'800 V 直流馈线';
    for (const pdu of pdus) connect(rowdist,pdu,inputMedium+' · '+pdu.feed+' 路');
    for (const part of modules) {
      connect(pdus[part.index%2],part,(isDC?'兼容直流输入':'交流输入')+' · '+part.feed+' 路');
      connect(part,buses[pcie?Math.floor(part.index/2):0],pcie?'服务器内部直流输出':'电源架并联直流输出');
    }
    const byId = new Map(servers.map(s=>[s.id,s]));
    for (const bus of buses) for (const dest of bus.serverIds) connect(bus,byId.get(dest),'低压直流');

    const redundancy = pcie?'每台服务器各有 A、B 两路电源模块，经本机背板供电。是否能由单路带满负荷取决于电源额定值与配置。':
      '来自 A、B 支路的电源模块并联，在共用母排上分担负载。单个模块没有固定专属托盘，备用容量需按整架负荷核算。';
    const scope = (pcie?'本柜配置 '+serverCount+' 台服务器，逐槽展示前 '+displayedServers+' 台的双电源接线。':
      '本柜以 4 个电源模块演示电源架并联，经共用母排向 18 个计算托盘供电。画面只追踪计算托盘负荷。')+
      ' A、B 表示两条示意分支，上游独立性按项目单线图核实。'+
      (isDC?'直流 A、B 各自有完整供电回路。本例假定机架采用匹配电压的 DC/DC 模块，整柜输入兼容性需按型号确认。':'');
    return {id,label,hallIndex,rackIndex,rowIndex,columnIndex,profile,profileLabel:profiles[profile],architecture,isDC,
      rowdist,pdus,modules,servers,buses,edges,serverCount,scope,redundancy,
      source:sources[profile],architectureSource:isDC?(architecture==='集中式 HVDC'?sources.hvdc:sources.dc):null};
  }

  function trace(model,slot) {
    if (!model || !Number.isInteger(slot) || slot<1 || slot>model.modules.length) return null;
    const part = model.modules[slot-1];
    const pdu = model.pdus.find(p=>p.id===part.pduId), bus = model.buses.find(b=>b.id===part.busId);
    const servers = model.servers.filter(s=>part.serverIds.includes(s.id));
    const alternateModules = model.modules.filter(m=>m.id!==part.id&&m.busId===part.busId);
    const pathIds = [model.rowdist.id,pdu.id,part.id,bus.id,...servers.map(s=>s.id)];
    const ids = new Set(pathIds), edgeIds = model.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).map(e=>e.id);
    return {module:part,rowdist:model.rowdist,pdu,bus,servers,alternateModules,pathIds,edgeIds,redundancy:model.redundancy};
  }

  root.GridRackCircuit = Object.freeze({build,trace});
})(typeof window==='undefined'?globalThis:window);
