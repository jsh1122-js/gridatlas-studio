/* Assign unique modeled outlets and logical switch ports to the devices in a cabinet plan. */
(() => {
  'use strict';

  const fabricName={ib:'InfiniBand',ethernet:'以太网'};
  const pad=n=>String(n).padStart(2,'0');
  const textOf=d=>[d.model,d.source?.name,...Object.values(d.source?.spec||{})].filter(Boolean).join(' ');
  const storageNote='设备表未列主机接口。规划为两个控制器各配置一块与交换机协议和速率相配的适配器，实际支持需查设备兼容清单。';
  const hostNote='按每个计算柜的一条外部集群网口试接，柜侧适配器、线缆和模块须配套选型。柜内 GPU 互联另行组网。';

  function switchSpec(d){
    const spec=d.source?.spec||{},label=[d.model,d.source?.name,spec['端口']].filter(Boolean).join(' ');
    // This generic record calls the model InfiniBand but uses both IB and RoCE in its display name.
    const fabric=/InfiniBand|Quantum|\bIB\b/i.test(d.model||'')?'ib':
      /以太|Ethernet|RoCE|GbE|\d\s*GE\b/i.test(label+' '+textOf(d))?'ethernet':
      /InfiniBand|\bIB\b|Quantum/i.test(label)?'ib':null;
    const port=String(spec['端口']||'');
    const ports=port.match(/(\d+)\s*(?:[×x]|个非阻塞\s*NDR)\s*(\d+)(?:\s*\/\s*(\d+))?\s*G/i);
    if(!fabric||!ports)return null;
    const supported=[Number(ports[2])];
    if(ports[3])supported.push(Number(ports[3]));
    const generation=fabric==='ib'?(label.match(/\b(XDR|NDR|HDR|EDR)\b/i)?.[1]||'').toUpperCase():'';
    return {fabric,generation,count:Number(ports[1]),rates:supported,rate:Math.max(...supported)};
  }

  function inputProfile(d){
    const spec=d.source?.spec||{},description=[spec['电源'],spec['供电'],spec['可靠性'],spec['功耗']].filter(Boolean).join(' ');
    const n=description.match(/(\d+)\s*×\s*(?:热插拔|冗余|模块化)?电源|([248])\s*个模块化电源|电源\s*(2)\+(2)\s*备份/);
    if(n)return {count:n[3]?Number(n[3])+Number(n[4]):Number(n[1]||n[2]),basis:'电源数量按设备表。两侧模块与柜内 A/B 供电口的对应关系为规划分配。'};
    if(/双\s*1\+1\s*冗余|2\s*×\s*冗余电源/.test(description))
      return {count:2,basis:'设备表标注双电源，两个输入分别规划接入柜内 A、B 电源。'};
    if(/电源预算.*槽位/.test(description))
      return {count:2,groups:true,basis:'模块化机箱按 A/B 两个输入组预留配电分支，电源模块实装数、每组线缆及连接器须按选型分解。'};
    return {count:2,basis:'设备表未列实装电源模块。方案预留 A/B 两个电源输入，模块数、连接器和额定电流待选型确认。'};
  }

  function build(plan,scene={}){
    const racks=plan.racks||[],devices=plan.devices||[];
    const rackById=new Map(racks.map(r=>[r.id,r]));
    const byDevice=Object.create(null),issues=Object.create(null),links=[];
    for(const d of devices){byDevice[d.id]=[];issues[d.id]=[];}
    const describe=r=>r?.label||r?.id||'机柜';
    function issue(id,message){
      const list=issues[id]||(issues[id]=[]);
      if(!list.includes(message))list.push(message);
    }
    function join(kind,fabric,from,to,note){
      const id=(kind==='power'?'P':'N')+'-'+String(links.length+1).padStart(4,'0');
      const link={id,kind,fabric,from,to,note};
      links.push(link);
      for(const end of [from,to])(byDevice[end.deviceId]||(byDevice[end.deviceId]=[])).push(link);
      return link;
    }
    function endpoint(d,port,kind='device'){
      const u=d.uStart?(d.uEnd>d.uStart?'U'+d.uStart+'–'+d.uEnd:'U'+d.uStart):'';
      return {rackId:d.rackId,deviceId:d.id,kind,port,uStart:d.uStart??null,uEnd:d.uEnd??null,
        label:[describe(rackById.get(d.rackId)),u,d.model||d.id,port].filter(Boolean).join(' · ')};
    }

    const powerCounts=new Map(),reservedOutlets=Object.create(null),arch=scene?.arch||plan.arch||'';
    for(const r of racks){
      const bundled=r.modelId==='it-gen-2u'?20:0;
      let a=bundled,b=bundled;
      for(const item of r.computeItems||[]){
        const n=inputProfile(item).count;
        a+=Math.ceil(n/2);b+=Math.floor(n/2);
      }
      if(a||b){
        reservedOutlets[r.id]={A:a,B:b};
        powerCounts.set(r.id+'-PDU-A',a);powerCounts.set(r.id+'-PDU-B',b);
      }
    }
    for(const d of devices){
      if(!rackById.has(d.rackId))continue;
      const profile=inputProfile(d);
      const reserved=reservedOutlets[d.rackId];
      const reservation=reserved?' 本柜先为计算设备预留 A 侧 '+reserved.A+' 个、B 侧 '+reserved.B+' 个输出，既有设备电源不详时按每台双输入试排。':'';
      const powerNote=profile.basis+reservation+(/hvdc|sst|800/i.test(arch)?
        ' 本方案为普通网络和存储设备预留兼容的低压辅助电源，须确认上游变换环节及设备输入制式。':' A/B 在本柜分别编号，外部两路电源的独立性需由单线图确认。');
      for(let i=0;i<profile.count;i++){
        const side=i%2===0?'A':'B',bus=d.rackId+'-PDU-'+side;
        const n=(powerCounts.get(bus)||0)+1;powerCounts.set(bus,n);
        // Number each additional mounted PDU separately once all 24 modeled outlet positions are in use.
        const bank=1+Math.floor((n-1)/24),outlet=1+(n-1)%24,strip=bus+'-'+pad(bank);
        const pdu={kind:'pdu',rackId:d.rackId,deviceId:strip,port:(profile.groups?'分支 ':'输出 ')+pad(outlet),
          side,outlet,bank,uStart:null,uEnd:null,label:describe(rackById.get(d.rackId))+' · PDU-'+side+(bank>1?' 第'+bank+'段':'')+' · '+(profile.groups?'分支 ':'输出 ')+pad(outlet)};
        join('power','power',endpoint(d,profile.groups?'输入组 '+side:'PSU '+(i+1)),pdu,powerNote);
      }
    }

    const groups=new Map();
    for(const d of devices.filter(d=>d.role==='network')){
      const spec=switchSpec(d);
      if(!spec){issue(d.id,'交换协议、端口数或速率资料不足，未分配数据线。');continue;}
      const key=[spec.fabric,spec.rate,spec.generation].join('-');
      if(!groups.has(key))groups.set(key,{fabric:spec.fabric,rate:spec.rate,switches:[],leaves:[],cursor:0});
      groups.get(key).switches.push({d,spec,next:1});
    }
    function swPort(sw){
      if(sw.next>sw.spec.count)return null;
      return endpoint(sw.d,(sw.spec.fabric==='ib'?'IB ':'ETH ')+pad(sw.next++));
    }
    for(const g of groups.values()){
      const n=g.switches.length;
      const minPorts=g.switches.reduce((m,sw)=>Math.min(m,sw.spec.count),Infinity);
      const nsp=n>=6?Math.max(2,Math.ceil(2*n/(minPorts+2))):n>=2?1:0;
      const spines=g.switches.slice(0,nsp);
      g.leaves=g.switches.slice(nsp);
      for(const [index,leaf] of g.leaves.entries()){
        const uplinks=nsp>=2?[spines[index%nsp],spines[(index+1)%nsp]]:spines;
        for(const spine of uplinks){
          if(leaf.next>leaf.spec.count||spine.next>spine.spec.count){
            issue(leaf.d.id,'本分组的汇聚交换端口不足，需扩展汇聚容量。');continue;
          }
          const note=fabricName[g.fabric]+' 同协议同标称速率分组。此链路连接接入层与汇聚层，端口号为规划的逻辑端口，模块及物理笼位待选型。';
          join('network',g.fabric,swPort(leaf),swPort(spine),note);
        }
      }
      g.remaining=g.leaves.reduce((n,sw)=>n+Math.max(0,sw.spec.count-sw.next+1),0);
    }
    function takeLeaf(g,exclude,allows){
      if(!g.remaining)return null;
      for(let n=0;n<g.leaves.length;n++){
        const sw=g.leaves[g.cursor++%g.leaves.length];
        if(sw!==exclude&&sw.next<=sw.spec.count&&(!allows||allows(sw))){g.remaining--;return sw;}
      }
      return null;
    }
    const available=[...groups.values()].sort((a,b)=>b.leaves.length-a.leaves.length||b.rate-a.rate);
    const storageGroups=d=>{
      const network=String(d.source?.spec?.['网络']||'');
      if(!network)return {groups:available.slice().sort((a,b)=>(b.fabric==='ethernet')-(a.fabric==='ethernet')),inferred:true};
      // The catalog's A800 specifies individual speeds for each supported fabric.
      const raw=Array.from(network.matchAll(/(\d+(?:\s*\/\s*\d+)*)\s*G(?:bE\b|\s*(ETH|RoCE|IB)\b)/ig));
      const supported=raw.map(m=>({fabric:m[2]?.toUpperCase()==='IB'?'ib':'ethernet',rates:m[1].split('/').map(Number)}));
      const allows=sw=>supported.some(x=>x.fabric===sw.spec.fabric&&sw.spec.rates.some(r=>x.rates.includes(r)));
      return {groups:available.filter(g=>g.leaves.some(allows)),allows,inferred:false};
    };
    for(const d of devices.filter(d=>d.role==='storage')){
      const choices=storageGroups(d);
      if(choices.inferred)issue(d.id,storageNote);
      if(!choices.groups.length){
        issue(d.id,choices.inferred?'未配置可分配端口的交换设备，两个控制器的数据口待接。':'没有与设备表所列协议及速率匹配的交换接口，须配置兼容交换机或核实具体降速与分拆方案。');continue;
      }
      let last=null;
      // Keep both controller paths on a compatible fabric and identify shared-switch paths explicitly.
      const g=choices.groups.find(g=>g.remaining>0&&(!choices.allows||g.leaves.some(sw=>sw.next<=sw.spec.count&&choices.allows(sw))));
      for(const letter of ['A','B']){
        const sw=g&&(takeLeaf(g,last,choices.allows)||takeLeaf(g,null,choices.allows));
        if(!sw){issue(d.id,'控制器 '+letter+' 缺少可用的数据端口，须补充交换容量。');continue;}
        const note=(choices.inferred?storageNote:'主机接口协议及速率来自设备表，控制器和交换端口配对为规划分配。');
        join('network',g.fabric,endpoint(d,'控制器 '+letter+' · 主机口 1'),swPort(sw),note);
        if(last===sw)issue(d.id,'两个控制器接到同一台交换机的不同端口，交换机仍为共同故障点。');
        last=sw;
      }
    }
    for(const rack of racks.filter(r=>r.computeItems?.length||r.role==='it_rack'&&(r.kind==='dedicated'||r.modelId==='it-gen-2u'))){
      const h={id:rack.id+'-HOST',rackId:rack.id,model:'计算系统',uStart:null,uEnd:null};
      let attached=false;
      for(const g of available){
        const sw=takeLeaf(g,null);
        if(!sw)continue;
        join('network',g.fabric,endpoint(h,'集群 NIC 1','compute'),swPort(sw),hostNote);
        attached=true;break;
      }
      if(!attached)issue(h.id,'计算柜缺少可分配的交换端口，集群网口待接。');
    }
    for(const d of devices.filter(d=>d.role==='network')){
      if(!byDevice[d.id].some(l=>l.kind==='network')&&!issues[d.id].length)issue(d.id,'尚无可接入的设备或同协议交换对端。');
    }
    return {links,byDevice,issues,reservedOutlets};
  }
  window.GridCabinetWiring=Object.freeze({build});
})();
