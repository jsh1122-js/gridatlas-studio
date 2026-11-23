(() => {
  'use strict';
  const $ = id => document.getElementById('tp-'+id);
  const numeric = (n,d=1) => n.toLocaleString('zh-CN',{maximumFractionDigits:d});
  const systems = ['交流 UPS','800V 直流','SST 800V 直流','集中式 HVDC'];
  const cooling = ['混合冷却','风冷','冷板液冷'];
  const names = {rack:'机柜',ups:'UPS',switchgear:'中压 GIS 开关柜',transformer:'配电变压器',sst:'SST 隔离变换','800v':'集中整流 / 800V 母线',hvdc:'HVDC 集中整流',liquid:'CDU 与冷板',air:'空调与风道'};
  const circuits = {all:'综合',power:'供电',liquid:'液冷',air:'风冷',data:'数据'};
  const lines = {
    '交流 UPS':['switchgear','transformer','ups','rack'],
    '800V 直流':['switchgear','transformer','800v','rack'],
    'SST 800V 直流':['switchgear','sst','rack'],
    '集中式 HVDC':['switchgear','transformer','hvdc','rack']
  };
  const profiles={gb200:'GB200 NVL72',gb300:'GB300 NVL72',pcie:'PCIe 参考柜'};
  function mount({onApply,onInspect,onCircuit,onMix}){
    const form=$('form'), controls=form.elements;
    let project,dirty=false,lastSignature='',chosen='all',catalog,loading;
    const mix=window.GridRackMix?.mount($('mix'),{onApply:onMix});
    for(const v of systems)controls.architecture.add(new Option(v,v));
    for(const v of cooling)controls.cooling.add(new Option(v,v));
    const toggle = open => {
      form.hidden=!open;
      $('toggle').setAttribute('aria-expanded',String(open));
      $('toggle').textContent=open?'收起参数':'调整参数';
      if(open) referenceButton();
    };
    $('toggle').onclick=()=>toggle(form.hidden);
    $('jump').onclick=()=>{toggle(true);$('planner').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});form.elements.it.focus({preventScroll:true});};
    function referenceButton(){
      const id=controls.profile.value;
      if(id==='pcie'){ $('reference').hidden=true;return; }
      if(!catalog){
        $('reference').hidden=true;
        if(!loading)loading=fetch('aidc/records.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(json=>{
          catalog=new Map(json.devices.flatMap(g=>g.devices).map(d=>[d.id,d]));referenceButton();
        }).catch(()=>{loading=null;$('feedback').textContent='当前未取得型号目录，可手填规划单柜功率。';});
        return;
      }
      const device=catalog.get('it-'+id+'-nvl72');
      $('reference').hidden=!device?.cap_kw;
      if(device?.cap_kw)$('reference').textContent='采用 '+profiles[id]+' 目录值 '+numeric(device.cap_kw)+' kW/柜及混合冷却';
    }
    $('reference').onclick=()=>{
      const device=catalog?.get('it-'+controls.profile.value+'-nvl72');
      if(!device)return;
      controls.density.value=device.cap_kw;controls.cooling.value='混合冷却';dirty=true;
      $('feedback').textContent='目录值已填入草稿，应用后按新功率重新计算规模。';
    };
    form.addEventListener('input',()=>{dirty=true;$('feedback').textContent='参数待应用';});
    controls.profile.addEventListener('change',referenceButton);
    form.addEventListener('submit',e=>{
      e.preventDefault();if(!form.reportValidity())return;
      try {
        const config={...project.config,it:controls.it.valueAsNumber,density:controls.density.valueAsNumber,architecture:controls.architecture.value,cooling:controls.cooling.value};
        if(!GridDesign.validateConfig(config))throw Error('请核对 IT 功率和单柜设计功率。');
        const spacePlan=GridSpacePlan.clean(Object.fromEntries(GridSpacePlan.fields.map(f=>[f.key,controls[f.key].valueAsNumber])));
        GridSpacePlan.calculate(config,null,spacePlan);
        const rackStudy=GridRackStudy.clean({...GridRackStudy.clean(project.rackStudy),profile:controls.profile.value});
        const clearMix=project.rackMix?.length && (config.it!==project.config.it || config.density!==project.config.density);
        dirty=false;
        onApply({config,rackStudy,spacePlan});
        $('feedback').textContent=clearMix?'已按新的功率重算空间，先前柜型组合已解除。':'机房布局、回路和方案已更新。';
      } catch(err){$('feedback').textContent=err.message;}
    });
    function spatial(p,layout){
      for(const [id,val] of Object.entries(layout?{halls:numeric(layout.halls,0)+' 间',net:numeric(layout.whiteSpaceM2)+' m²',gross:numeric(layout.grossM2)+' m²',dim:numeric(layout.hallLengthM)+' × '+numeric(layout.hallWidthM)+' m'}:{halls:'—',net:'—',gross:'—',dim:'—'}))$(id).textContent=val;
      const text=layout?numeric(layout.racks,0)+' 柜 · '+(layout.halls===1?'单间 '+numeric(layout.racksPerHall)+' 柜':'每间最多 '+numeric(layout.racksPerHall)+' 柜，末间 '+numeric(layout.lastHallRacks)+' 柜')+' · '+p.config.architecture+' · '+p.config.cooling:'当前规模超出空间测算范围，请调整参数。';
      const mixed=p.rackMix?.length && p.rackMix.some(row=>row.profile==='pcie') && p.rackMix.some(row=>row.profile!=='pcie');
      const mismatch=(p.rackMix?.some(row=>row.profile!=='pcie')&&p.config.cooling==='风冷') || (p.rackMix?.some(row=>row.profile==='pcie')&&p.config.cooling==='冷板液冷');
      $('summary').textContent=text+(mismatch?'。搭配中的机柜需要另一种散热回路，请核对制冷方案。':mixed?' · 含液冷及风冷柜型':'')+(p.config.architecture.includes('800V')?'。800 V 为设施侧架构，机架电源接口需按实际型号适配。':'');
    }
    function pathNodes(items){
      const host=document.createElement('div');host.className='tp-path';
      items.forEach(([label,target],i)=>{
        if(i){const arrow=document.createElement('span');arrow.textContent='→';arrow.setAttribute('aria-hidden','true');host.append(arrow);}
        const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>onInspect(target);host.append(b);
      });
      return host;
    }
    function renderRoutes(mode) {
      const cut=mode==='cutaway';
      $('routes').hidden=!cut;
      if(!cut)return;
      const config=project.config;
      const available=['all','power','data',...(config.cooling==='风冷'?[]:['liquid']),...(config.cooling==='冷板液冷'?[]:['air'])];
      if(!available.includes(chosen)){chosen='all';onCircuit(chosen);}
      const switches=$('routes').querySelector('.tp-switches');
      switches.replaceChildren(...available.map(key=>{
        const b=document.createElement('button');b.type='button';b.dataset.circuit=key;b.textContent=circuits[key];b.setAttribute('aria-pressed',String(chosen===key));
        b.onclick=()=>{chosen=key;onCircuit(chosen);renderRoutes(mode);};return b;
      }));
      const host=$('chain');host.replaceChildren();
      if(chosen==='power'||chosen==='all'){
        const ac=config.architecture==='交流 UPS';
        const seq=(lines[config.architecture]||lines['交流 UPS']).slice(0,-1).map(k=>[names[k],k]);
        seq.push([ac?'列头柜':'列级直流配电','rowdist'],[ac?'机柜 PDU':'柜内直流分配','pdu'],[ac?'PSU 电源模块':'机架 DC/DC','psu'],['IT 负载','rack']);
        host.append(pathNodes(seq));
      }
      if(chosen==='liquid')host.append(pathNodes([['一次侧换热','liquid/primary'],['CDU 供液','liquid/supply'],['芯片冷板','liquid/plates'],['回液至 CDU','liquid/return']]));
      if(chosen==='air')host.append(pathNodes([['机房空调','air'],['冷通道','air/cold'],['服务器风扇','fan'],['热通道与回风','air/hot']]));
      if(chosen==='data')host.append(pathNodes([['服务器网口','network/nic'],['线缆与配线','network'],['机架交换机','network/tor']]));
    }
    function update(p,layout,mode){
      const changedProject=project?.id!==p.id;project=p;
      if(changedProject){dirty=false;chosen='all';$('feedback').textContent='';}
      const signature=JSON.stringify([p.id,p.config.it,p.config.density,p.config.architecture,p.config.cooling,p.rackStudy,p.spacePlan]);
      if(!dirty&&signature!==lastSignature){
        const vals={...p.config,...GridSpacePlan.clean(p.spacePlan),profile:GridRackStudy.clean(p.rackStudy).profile};
        for(const k of ['it','density','architecture','cooling','profile',...GridSpacePlan.fields.map(f=>f.key)])controls[k].value=vals[k];
        lastSignature=signature;if(!form.hidden)referenceButton();
      }
      spatial(p,layout);mix?.update(p);renderRoutes(mode);
    }
    return {update,renderRoutes,getCircuit:()=>chosen};
  }
  window.GridTwinPlan={mount};
})();
