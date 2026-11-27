/* Shared entry point for the project twin and the catalogue's edited equipment list. */
(() => {
  'use strict';
  const here=new URL('.',document.currentScript.src);
  const number=n=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const title=scene=>scene.name.replace(/^[①②③④⑤]\s*/,'');
  const el=(tag,text='',cls='')=>{
    const node=document.createElement(tag);node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  let pendingCatalog;
  function catalog(){
    if(!pendingCatalog)pendingCatalog=fetch(new URL('records.json',here)).then(response=>{
      if(!response.ok)throw new Error('无法读取 AIDC 设备清单');
      return response.json();
    }).then(data=>({data,byId:new Map(data.devices.flatMap(group=>group.devices.map(device=>[device.id,device])))}))
      .catch(error=>{pendingCatalog=null;throw error;});
    return pendingCatalog;
  }
  function records(items,byId,layout){
    const rows=[];
    for(const line of items){
      const device=byId.get(line.dev),count=line.count??1;
      if(device&&Number.isSafeInteger(count)&&count>0)rows.push({device,count,zone:line.zone||GridAidcLayoutReview.defaultZone(device,layout)});
    }
    return rows;
  }
  function mount(host,scene,rows,layout,options={}){
    let view;
    function selectHall(hall){
      view?.dispose();
      view=draw(host,scene,rows,layout,options,hall,selectHall);
    }
    selectHall(1);
    return {dispose(){view?.dispose();}};
  }
  function draw(host,scene,rows,layout,{source='',actions,edit},hall,selectHall){
    const plan=GridCabinetPlan.build(scene,rows,layout,{hall}),wiring=GridCabinetWiring.build(plan,scene);
    const root=el('section','','cr-room');root.dataset.cabinetPlan=scene.id;
    root.dataset.placed=plan.totals.placed;root.dataset.requested=plan.totals.requested;
    const head=el('header','','cr-head'),heading=el('div');
    heading.append(el('h3',title(scene)),el('p',(source?source+' · ':'')+'网络与存储机柜'));
    head.append(heading);if(actions)head.append(actions);root.append(head);
    const part=plan.partition;
    if(part?.count>1){
      root.dataset.cabHall=String(part.index);
      const nav=el('form','','cr-halls'),label=el('label','查看机房编号 '),input=el('input');
      input.type='number';input.min='1';input.max=String(part.count);input.step='1';input.required=true;input.value=String(part.index);
      label.append(input);const apply=el('button','切换机房');apply.type='submit';
      nav.append(el('span','按清单比例规划 '+number(part.count)+' 间，本间 '+number(part.hallDevices)+' 台或套，整个项目含 '+number(part.totalAccessories)+' 台网络与存储设备。'),label,apply);
      nav.onsubmit=event=>{event.preventDefault();if(nav.reportValidity()&&input.valueAsNumber!==part.index)selectHall(input.valueAsNumber);};root.append(nav);
    }
    const stats=el('dl','','cr-stats');
    function metric(name,value,identity){const box=el('div'),dd=el('dd',value);dd.dataset.cabMetric=identity;box.append(el('dt',name),dd);stats.append(box);}
    const {room,totals}=plan;
    metric('网络与存储上架',number(totals.placed)+' / '+number(totals.requested)+' 台','devices');
    metric('新增机柜',number(totals.addedRacks)+' 柜','added');
    metric('规划建筑长 × 深',Number.isFinite(room.w)&&Number.isFinite(room.d)?number(room.w)+' × '+number(room.d)+' m':'待核','room');
    root.append(stats);
    if(totals.addedRacks>totals.addedForNetwork){
      root.append(el('p','新增柜中有 '+number(totals.addedForNetwork)+' 柜因网络或存储设备触发，其余由计算设备触发。','cr-origin'));
    }
    const viewport=el('div','','cr-viewport');root.append(viewport);
    const tools=el('div','','cr-tools');
    for(const [role,label] of [['network','查看一台交换机'],['storage','查看一台存储设备']]){
      const item=plan.devices.find(d=>d.role===role);
      if(item){
        const button=el('button',label);button.type='button';button.dataset.crLocate=role;
        button.onclick=()=>viewer.selectDevice(item.id);tools.append(button);
      }
    }
    if(edit){
      const button=el('button','编辑本项目清单');button.type='button';button.onclick=edit;tools.append(button);
    }
    root.append(tools);
    if(plan.unresolved.length){
      const open=el('details','','cr-check');open.open=true;
      open.append(el('summary','待安置或待核对'));
      const list=el('ul');for(const u of plan.unresolved)list.append(el('li',u.model+' × '+number(u.count)+' · '+u.reason));
      open.append(list);root.append(open);
    }
    const criteria=el('details','','cr-check');criteria.append(el('summary','排柜依据与扩容尺寸'));
    const summary=el('p','原柜阵 '+room.baseRows+' 行 × '+room.baseCols+' 位，规划 '+room.rows+' 行 × '+room.cols+' 位。原建筑 '+number(room.baseW)+' × '+number(room.baseD)+' m。供电与网络端口均为方案分配，点设备可查看连接依据。');
    criteria.append(summary);
    const list=el('ul');for(const note of plan.assumptions)list.append(el('li',note));criteria.append(list);root.append(criteria);
    host.replaceChildren(root);
    const viewer=GridAidcCabinetScene.mount(viewport,plan,wiring);
    return {dispose(){viewer.dispose();root.remove();}};
  }
  window.GridCabinetRoom=Object.freeze({catalog,records,mount,title});
})();
