/* Assemble a tour from the same tees and pipe centerlines used to build the facility and hall. */
(() => {
  'use strict';

  const reversed = values => values.slice().reverse();
  const pipe = (run, points) => ({kind:'pipe',run,points});
  const transfer = (from,to) => ({kind:'transfer',points:[from,to]});

  function stop(key,title,text,scope,medium,segments) {
    const points=[];
    for(const section of segments){
      for(const p of section.points){
        const last=points.at(-1);
        if(!last||last.some((v,i)=>v!==p[i]))points.push(p);
      }
    }
    return {key,title,text,scope,medium,segments,points,point:points.at(-1)};
  }

  function plan(model,options={},hallIndex=0) {
    const halls=model.plan.dims,units=Object.keys(model.coolingBounds).length;
    if(!halls.length||!units)return null;
    let index=Number.isInteger(hallIndex)&&halls[hallIndex]?hallIndex:0;
    if(options.rackIndex==null&&!halls[index].coolingPaths){
      const other=halls.findIndex(hall=>hall.coolingPaths);
      if(other>=0)index=other;
    }
    const hall=halls[index],paths=options.rackIndex==null?hall.coolingPaths:hall.coolingByRack?.[options.rackIndex],liquid=Boolean(paths);
    if(options.rackIndex!=null&&!paths)return null;
    const unit=Math.max(1,Math.min(units,Math.trunc(Number(options.coolingUnit))||1));
    const plantKey='cooling-unit-'+unit,plant=String(unit).padStart(2,'0')+' 号冷却机组';
    const columns=units/2,row=Math.floor((unit-1)/columns),column=(unit-1)%columns;
    const room='第 '+(hall.index+1)+' 间机房',device=liquid?'liquid':'air';
    const exchanger=liquid?'CDU':'CRAH 盘管';
    const runs=new Map(model.layout.utilities.map(u=>[u.id,u]));
    function section(id,start,end) {
      const all=runs.get(id).points;
      const a=start?all.indexOf(start):0,b=end?all.indexOf(end):all.length-1;
      if(a<0||b<0)throw new Error('管段未连接到建模三通 '+id);
      return pipe(id,a<=b?all.slice(a,b+1):reversed(all.slice(b,a+1)));
    }
    function runToHall(kind) {
      const stub='chiller-port-'+kind+'-'+row+'-'+column,header='header-'+kind+'-'+row;
      const branch='hall-water-'+kind+'-'+index;
      const [tee,port]=runs.get(stub).points,plantTee=runs.get(header).points[0],hallTee=runs.get(branch).points[0];
      return {
        yard:[section(stub,port,tee),section(header,tee,plantTee),section('plant-'+kind,plantTee)],
        hall:[section('facility-'+kind,null,hallTee),section(branch),section('hall-water-port-'+kind+'-'+index)]
      };
    }
    const supply=runToHall('supply'),back=runToHall('return');
    const upstream=segments=>reversed(segments).map(s=>pipe(s.run,reversed(s.points)));
    const outbound=[
      stop(plantKey,plant+' · 供水','从这台机组的供水口出发。跟着本机短支管到三通，再沿这一排的汇管进入园区设施供水总管。','yard','supply',supply.yard),
      stop(device,room+' · '+exchanger+'进水','设施水沿总管穿过道路下方的套管，在本机房的三通分流。镜头沿穿墙管进入设备的一次侧进水口。','hall','supply',supply.hall)
    ];
    const inbound=[];
    if(liquid){
      outbound.push(
        stop('liquid','CDU 板式换热器','冷的设施水进入板式换热器。虚线表示视角跨过金属板片，转到被冷却的二次侧。两侧各自循环，水在这里不会混合。','hall','exchange',[
          pipe('cdu-primary-supply',paths.primarySupply),transfer(paths.primarySupply.at(-1),paths.supply[0])
        ]),
        stop('rack','二次侧供液 · 机柜分水器','循二次侧供液管经过高处横管，再沿柜旁的支管下降，到达这台 '+paths.profile.toUpperCase()+' 机柜的供液接口。','hall','supply',[pipe('secondary-supply',paths.supply)])
      );
      inbound.push(
        stop('liquid','二次侧回液 · 回到 CDU','从同一台机柜的回液接口出发。被芯片加热的冷却液沿独立回液管返回 CDU 的板式换热器。','hall','return',[pipe('secondary-return',paths.return)]),
        stop('liquid','CDU · 将热量交给设施水','热量穿过板片传到一次侧。虚线表示换热位置，接下来跟随已经升温的设施水，从一次侧回水口离开。','hall','exchange',[
          transfer(paths.return.at(-1),paths.primaryReturn[0]),pipe('cdu-primary-return',paths.primaryReturn)
        ])
      );
    }else{
      outbound.push(stop('air','CRAH · 盘管吸热','这一方案没有建模可用的 GPU 冷板支路。设施水在机房盘管里流动，回风掠过盘管时把热量交给水。沿盘管弯头来到回水口。','hall','exchange',[pipe('crah-coil',hall.coilWater)]));
    }
    inbound.push(
      stop(device,room+' · 设施回水总管','温度升高的设施水沿机房回水支管流出，在三通汇入回水总管，再沿地下穿越段返回室外机组区。','hall','return',upstream(back.hall)),
      stop(plantKey,plant+' · 回水','沿这台机组所在排的回水汇管，转入它自己的回水支管。设施水回到出发机组的回水口，热量由机组排向室外。','yard','return',upstream(back.yard))
    );
    return {hallIndex:index,hallNumber:hall.index+1,rackIndex:paths?.rackIndex??null,profile:paths?.profile??null,plantKey,liquid,outbound,inbound};
  }
  window.GridCoolingRoute=Object.freeze({plan});
})();
