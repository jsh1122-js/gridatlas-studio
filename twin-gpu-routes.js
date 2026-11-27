/* A GPU has two different ports: its board power contact and its cold plate's return channel. */
(() => {
  'use strict';

  const endpoint = step => step.points.at(-1);
  const validPoint = p => Array.isArray(p) && p.length===3 && p.every(Number.isFinite);
  const close = (p,q) => validPoint(p) && validPoint(q) && Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]) < 1e-5;
  const sameRack = (hall,rack) => hall && rack && hall.hallIndex===rack.hallIndex &&
    hall.rackIndex===rack.rackIndex && hall.profile===rack.profile;

  function makeStep(details,segments) {
    const points=[];
    for(const segment of segments){
      if(!segment.points?.length || !segment.points.every(validPoint))return null;
      if(points.length && !close(points.at(-1),segment.points[0]))return null;
      for(const p of segment.points){
        if(!points.length || !close(points.at(-1),p))points.push(p);
      }
    }
    return points.length ? {...details,segments,points,point:points.at(-1)} : null;
  }

  function connected(steps) {
    return steps.length && steps.every((s,i)=>s && (i===0 || close(s.points[0],endpoint(steps[i-1]))));
  }

  function describePower(key,hall,rack) {
    const feed=rack.feed+' 路';
    const descriptions={
      bus:rack.profile==='pcie'?'沿服务器电源输入回到这台服务器的冗余电源背板。':'沿计算托盘的输入支路回到共用直流母排。多组电源并联在这里，本次沿 '+feed+' 的一个模块反查。',
      psu:'沿模块输出支路回到 '+feed+' 的 '+(hall.architecture==='交流 UPS'?'PSU':'DC/DC 模块')+'，核对这一支路的输入端。',
      pdu:'沿所选电源模块的输入线回到 '+feed+' 分配装置。另一条冗余支路保留在模型中。',
      rowdist:'沿本柜的 '+feed+' 馈线经过桥架，回到这台机柜所在列的配电柜出线端子。',
      ups:'从列级进线反向追踪到 UPS 的交流输出端。',
      sst:'从直流列端配电反向追踪到 SST 的 800 V 直流输出端。',
      '800v':'从直流列端配电沿馈线回到集中整流柜的 800 V 直流输出端。',
      hvdc:'沿本列进线追到集中式 HVDC 的直流输出端。',
      transformer:'经过变换设备内部的能量变换，再沿柜前接线回到机房配电变压器的低压侧。',
      switchgear:'沿本机房供电支路反向追到中压开关柜的出线端。',
      'hall-entry':'沿机房内电缆桥架回到进线穿墙套管，下一段通往园区变电站。',
      'sub-feeder':'沿设施电缆穿过地下套管，回到这间机房对应的站内馈线间隔。',
      'sub-switchgear':'从馈线间隔沿站内母线返回所选主变的中压进线间隔。',
      'sub-incoming':'沿主变高压侧引线回到站内进线导体。'
    };
    if(key.startsWith('sub-transformer'))return '从开关设备沿主变二次侧引线，回到本次追踪的 '+hall.yardUnit+' 号主变压器。';
    return descriptions[key];
  }

  function powerRoute(hall,rack) {
    if(!sameRack(hall,rack) || hall.slot!==rack.slot || hall.feed!==rack.feed)return null;
    const cabinet=rack.stops;
    if(cabinet[0]?.key!=='rowdist' || cabinet.at(-1)?.key!=='gpu' || !hall.stops.length)return null;
    // The cabinet plan's first (single-point) row terminal is the same contact as the hall output.
    if(!close(endpoint(hall.stops.at(-1)),cabinet[0].points[0]))return null;
    const forward=[...hall.stops,...cabinet.slice(1).map(s=>({...s,scope:'rack'}))];
    const steps=[];
    for(let i=forward.length-1;i>=0;i--){
      const edge=forward[i],first=i===forward.length-1;
      let target=first || i===0 ? edge : forward[i-1];
      if(edge.scope==='rack' && target.key==='rowdist')target=cabinet[0];
      const key=target.key;
      const title=first ? target.label+' · 板级供电线' : i===0 ? '变电站 · 站内进线端子' : target.label||target.title;
      const text=first ? '从 '+target.nodeId+' 的板级电源接点出发，沿稳压器与板上供电线回到计算板的电源输入端。' :
        i===0 ? '镜头沿进线导体到达园区变电站的进线端子。这是当前模型所示供电支路的上游端点。' :
        describePower(key,hall,rack);
      const segments=edge.segments.slice().reverse().map(s=>({...s,points:s.points.slice().reverse()}));
      steps.push(makeStep({key,title,text,scope:edge.scope,nodeId:target.nodeId,rigKey:key},segments));
    }
    if(!connected(steps))return null;
    return {...hall,kind:'power',direction:'upstream',cabinet:rack,stops:steps};
  }

  function coolingRoute(hall,rack,gpuId) {
    if(!sameRack(hall,rack) || !hall.liquid || rack.gpuId!==gpuId)return null;
    const plate=rack.stops.find(s=>s.key==='gpu' && s.gpuId===gpuId);
    const tray=rack.stops.find(s=>s.key==='server' && s.medium==='return');
    const manifold=rack.stops.find(s=>s.key==='rack' && s.medium==='return');
    const chipReturn=tray?.segments.find(s=>s.run==='coldplate-return');
    const trayReturn=tray?.segments.find(s=>s.run==='tray-return');
    if(!plate || !manifold || !chipReturn || !trayReturn || !close(endpoint(plate),chipReturn.points[0]))return null;
    const steps=[
      makeStep({...plate,rigKey:'gpu',medium:'return',text:'从 '+gpuId+' 的冷板内部出发。镜头沿回液流道和这块冷板的回液支管到达托盘回液管。'},[chipReturn]),
      makeStep({...tray,rigKey:'server'},[trayReturn]),
      makeStep({...manifold,rigKey:'rack'},manifold.segments),
      ...hall.inbound.map(s=>makeStep(s,s.segments))
    ];
    if(!connected(steps))return null;
    return {...hall,kind:'cooling',direction:'return',cabinet:rack,stops:steps};
  }

  function build({powerHall,powerRack,coolingHall,coolingRack}) {
    const chip=powerRack?.stops.at(-1);
    const gpuId=chip?.key==='gpu'?chip.nodeId:coolingRack?.gpuId;
    if(!gpuId)return {gpuId:null,power:null,cooling:null};
    return {gpuId,power:powerRoute(powerHall,powerRack),cooling:coolingRoute(coolingHall,coolingRack,gpuId)};
  }
  window.GridGpuRoutes=Object.freeze({build});
})();
