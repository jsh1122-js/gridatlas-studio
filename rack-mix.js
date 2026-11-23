((root) => {
  'use strict';
  const profiles = Object.freeze([
    Object.freeze({profile:'gb200',name:'GB200 NVL72',referenceKW:120,basis:'目录参考 120 kW/柜'}),
    Object.freeze({profile:'gb300',name:'GB300 NVL72',referenceKW:140,basis:'目录参考 140 kW/柜'}),
    Object.freeze({profile:'pcie',name:'PCIe 风冷机柜',referenceKW:50,basis:'规划假设 50 kW/柜'})
  ]);
  const MAX_COUNT = 1_000_000_000, MIN_KW = 0.000001, MAX_KW = 1_000_000;
  function number(value) {
    return typeof value === 'number' || (typeof value === 'string' && value.trim()) ? Number(value) : NaN;
  }
  function clean(value) {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > profiles.length) throw new TypeError('机柜搭配只接受三种样机，每种一行。');
    const byType = new Map();
    for (const row of value) {
      const type = profiles.find(p => p.profile === row?.profile);
      if (!type || byType.has(type.profile)) throw new TypeError('机柜搭配存在未知或重复的型号。');
      const count = number(row.count);
      if (!Number.isSafeInteger(count) || count < 0 || count > MAX_COUNT) throw new RangeError(type.name+' 的柜数须为 0 至 10 亿的整数。');
      const kW = number(row.kW);
      if (count > 0 && (!Number.isFinite(kW) || kW < MIN_KW || kW > MAX_KW)) throw new RangeError(type.name+' 的单柜规划功率须在 0.000001 至 1,000,000 kW 之间。');
      byType.set(type.profile,{profile:type.profile,count,kW});
    }
    return profiles.map(p=>byType.get(p.profile)).filter(row=>row && row.count>0);
  }
  function summarize(value) {
    let racks=0, totalKW=0;
    const counts={gb200:0,gb300:0,pcie:0},regions=[];
    for (const row of clean(value)) {
      const startIndex=racks, power=row.count*row.kW;
      racks+=row.count; totalKW+=power;counts[row.profile]=row.count;
      regions.push({...row,startIndex,endIndex:racks,itMW:power/1000});
    }
    return {racks,totalKW,itMW:totalKW/1000,density:racks?totalKW/racks:0,counts,regions};
  }
  function profileAt(rows,index,totalDisplayed) {
    if (!Number.isSafeInteger(index) || index<0) return null;
    const {racks,regions}=summarize(rows);
    if (totalDisplayed==null || totalDisplayed===racks) return regions.find(r=>index>=r.startIndex&&index<r.endIndex)?.profile??null;
    if (!Number.isSafeInteger(totalDisplayed) || totalDisplayed<=0) return null;
    const slots=Math.min(racks,totalDisplayed);
    if (index>=slots) return null;
    // Reserve one representative per installed type whenever the display permits; distribute the rest
    // by largest remainder. Work and storage depend on the number of types, never on cabinet counts.
    if (slots<regions.length) {
      const visible=regions.slice().sort((a,b)=>b.count-a.count||a.startIndex-b.startIndex).slice(0,slots);
      return visible.sort((a,b)=>a.startIndex-b.startIndex)[index].profile;
    }
    const baseline=1, reserve=regions.length;
    const remaining=slots-reserve, available=racks-reserve;
    const parts=regions.map((r,i)=>{
      const share=available?remaining*((r.count-baseline)/available):0,whole=Math.floor(share);
      return {index:i,profile:r.profile,seats:whole+baseline,remainder:share-whole,count:r.count};
    });
    let missing=slots-parts.reduce((n,p)=>n+p.seats,0);
    const byRemainder=parts.slice().sort((a,b)=>b.remainder-a.remainder || a.index-b.index);
    for(const part of byRemainder)if(missing>0 && part.seats<part.count){part.seats++;missing--;}
    let stop=0;
    for(const part of parts){stop+=part.seats;if(index<stop)return part.profile;}
    return null;
  }
  const display = value => Number.isFinite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:4}) : '—';
  function addStyles(doc) {
    if(doc.getElementById('gridatlas-rack-mix-style'))return;
    const style=doc.createElement('style');style.id='gridatlas-rack-mix-style';
    style.textContent=`
      .rmx-panel{margin-top:14px;border-top:1px solid #304352;color:#e2edf3;font-variant-numeric:tabular-nums}
      .rmx-panel summary{cursor:pointer;display:flex;align-items:center;gap:9px;min-height:45px;padding:8px 0;color:#dbedf0;font-size:.87rem;font-weight:650;list-style:none}
      .rmx-panel summary::-webkit-details-marker{display:none}.rmx-panel summary:before{content:'';width:7px;height:7px;border:solid #7ed8c3;border-width:0 1.5px 1.5px 0;transform:rotate(-45deg);margin:0 4px 0 3px;transition:transform .16s}
      .rmx-panel[open] summary:before{transform:rotate(45deg)}.rmx-panel summary:hover{color:#a5f0d7}
      .rmx-summary{font-weight:500;color:#a8bdca;margin-left:auto;font-size:.76rem;overflow-wrap:anywhere;text-align:right}
      .rmx-body{max-width:720px;padding:1px 0 6px}.rmx-table{display:grid;grid-template-columns:minmax(118px,1.35fr) minmax(70px,1fr) minmax(85px,1fr);gap:7px 12px;align-items:center}
      .rmx-th,.rmx-hint{font-size:.75rem;color:#a9bdc9}.rmx-th{padding:3px 0;border-bottom:1px solid #2c4050}
      .rmx-name{font-size:.82rem;font-weight:600;color:#e0edf3}.rmx-name small{display:block;color:#a9bdc9;font-size:.70rem;line-height:1.5;font-weight:400}
      .rmx-table input{font-family:inherit;font-size:.85rem;line-height:1.3;font-weight:550;width:100%;min-width:0;min-height:34px;padding:6px 8px;box-sizing:border-box;border:1px solid #3b5260;background:#0d1b28;color:#e9f3f8;border-radius:6px}
      .rmx-table input:focus-visible,.rmx-panel summary:focus-visible,.rmx-apply:focus-visible{outline:2px solid #80e4cb;outline-offset:2px}
      .rmx-preview{margin:10px 0 7px;color:#c1e2da;font-size:.82rem}.rmx-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .rmx-apply{border:1px solid #3a6b63;background:#1d403f;color:#a5edd7;border-radius:6px;padding:7px 12px;font:600 .82rem system-ui;cursor:pointer}.rmx-apply:hover{background:#28514c}
      .rmx-feedback{font-size:.78rem;color:#a6d9c9}.rmx-feedback[data-error=true]{color:#ffb1a0}
      @media(max-width:560px){.rmx-table{grid-template-columns:minmax(88px,1.2fr) minmax(55px,.75fr) minmax(75px,1fr);gap:6px}.rmx-table input{padding:6px}.rmx-summary{font-size:.69rem}.rmx-name{font-size:.76rem}}
      @media(prefers-reduced-motion:reduce){.rmx-panel summary:before{transition:none}}
    `;doc.head.append(style);
  }
  function mount(host,{onApply}={}) {
    const doc=host.ownerDocument;addStyles(doc);
    const el=(tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node;};
    const panel=el('details','rmx-panel'),header=el('summary','', '按型号搭配机柜'),saved=el('span','rmx-summary'),form=el('form','rmx-body');
    header.append(saved);panel.append(header,form);host.replaceChildren(panel);
    const grid=el('div','rmx-table');form.noValidate=true;form.append(grid);
    for(const label of ['机柜型号','数量（柜）','功率（kW/柜）'])grid.append(el('span','rmx-th',label));
    const inputs=profiles.map(type=>{
      const name=el('div','rmx-name',type.name);name.append(el('small','',type.basis));grid.append(name);
      const field=(key,label,min,max,step)=>{
        const node=el('input');node.type='number';node.setAttribute('aria-label',type.name+label);node.dataset.profile=type.profile;node.dataset.field=key;
        node.min=String(min);node.max=String(max);node.step=String(step);node.inputMode=key==='count'?'numeric':'decimal';grid.append(node);return node;
      };
      return {type,count:field('count','机柜数量',0,MAX_COUNT,1),kW:field('kW','单柜规划功率',MIN_KW,MAX_KW,'any')};
    });
    const preview=el('p','rmx-preview'),apply=el('button','rmx-apply','应用机柜搭配'),actions=el('div','rmx-actions'),feedback=el('span','rmx-feedback');
    apply.type='submit';feedback.setAttribute('role','status');actions.append(apply,feedback);form.append(preview,actions);
    const drafts=new Map();let key,entry;
    function getRows(){return inputs.map(({type,count,kW})=>({profile:type.profile,count:count.value===''&&!count.validity.badInput?0:count.value,kW:kW.value}));}
    function snapshot(){return inputs.map(({count,kW})=>[count.value,kW.value]);}
    function fill(values){inputs.forEach(({count,kW},i)=>{count.value=values[i][0];kW.value=values[i][1];});}
    function valuesOf(rows){return profiles.map(t=>{const row=rows.find(r=>r.profile===t.profile);return [String(row?.count??0),String(row?.kW??t.referenceKW)];});}
    function showFeedback(message,error=false){feedback.textContent=message;feedback.dataset.error=String(error);}
    function showPreview(){
      try{const s=summarize(getRows());preview.textContent=s.racks?`合计 ${display(s.racks)} 柜 · IT ${display(s.itMW)} MW · 加权单柜 ${display(s.density)} kW`:'数量为 0 的型号不参与计算。';}
      catch(e){preview.textContent=e.message;}
    }
    function update(project){
      if(!project)return;
      const next=project.id??'__current__',rows=clean(project.rackMix),serialized=JSON.stringify(rows),newProject=next!==key;
      if(newProject){if(entry)entry.values=snapshot();key=next;entry=drafts.get(next);showFeedback('');}
      if(!entry){entry={dirty:false,values:valuesOf(rows),saved:serialized};drafts.set(key,entry);}
      const changed=serialized!==entry.saved;
      if(!entry.dirty && (newProject||changed)){entry.values=valuesOf(rows);fill(entry.values);}
      else if(newProject)fill(entry.values);
      if(!newProject && changed){
        if(rows.length)showFeedback(entry.dirty?'已保留未提交的搭配草稿。':'');
        else showFeedback(entry.dirty?'当前方案已改为手动规模，搭配草稿已保留。':'当前方案已改为手动规模。');
      }
      entry.saved=serialized;
      const active=summarize(rows);saved.textContent=active.racks?`${rows.length} 种 · ${display(active.racks)} 柜`:'当前按单柜功率测算';
      showPreview();
    }
    form.addEventListener('input',()=>{
      if(!entry)return;
      entry.dirty=true;entry.values=snapshot();showFeedback('');showPreview();
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(!entry)return;
      const thisKey=key,thisEntry=entry;
      try{
        const rows=clean(getRows()),summary=summarize(rows);
        if(!summary.racks)throw new Error('请至少填入一柜后再应用。');
        if(typeof onApply!=='function')throw new Error('当前页面未连接方案。');
        const submitted=JSON.stringify(snapshot());
        await onApply(rows,summary);
        if(key!==thisKey)return;
        if(JSON.stringify(snapshot())===submitted){thisEntry.dirty=false;thisEntry.values=snapshot();}
        showFeedback('已将 '+display(summary.racks)+' 柜搭配计入当前方案。');
      }catch(e){if(key===thisKey)showFeedback(e.message,true);}
    });
    return {update};
  }
  root.GridRackMix=Object.freeze({profiles,clean,summarize,profileAt,mount});
})(typeof window!=='undefined'?window:globalThis);
