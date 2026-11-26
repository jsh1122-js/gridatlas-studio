/* Project logical connections onto the current 3-D camera. Each endpoint follows a real model anchor. */
(() => {
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  const svg=(tag,attrs={})=>{const e=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
  const palette={power:'#f8bc64',supply:'#66e6dd',return:'#ffa68d',signal:'#c5a8ff',air:'#8dc5ff'};
  function mount(host,onSelect,onCurrent){
    const ink=svg('svg',{'aria-hidden':'true',class:'tw-trace-ink'}),defs=svg('defs');
    const labels=document.createElement('div');labels.className='tw-trace-labels';
    ink.append(defs);host.append(ink,labels);
    for(const [k,tone] of Object.entries(palette)){
      const m=svg('marker',{id:'tw-route-tip-'+k,viewBox:'0 0 8 8',refX:6.8,refY:4,markerWidth:6.5,markerHeight:6.5,orient:'auto-start-reverse',markerUnits:'userSpaceOnUse'});
      m.append(svg('path',{d:'M0 0L8 4L0 8L2 4Z',fill:tone}));defs.append(m);
    }
    let desc=null,lines=[],pins=[],keyList=[],last='',dims=[0,0],projector=null;
    const toolBox={w:0,h:0};
    const observer=new ResizeObserver(entries=>{
      const {width,height}=entries[0].contentRect;dims=[width,height];last='';if(width&&height&&projector)draw(projector);
    });observer.observe(host);
    function makePin(key,title,kind,current){
      const interactive=!current||(key.startsWith('cooling-unit-')&&onCurrent);
      const b=document.createElement(interactive?'button':'span');if(interactive)b.type='button';
      b.className='tw-trace-pin';b.dataset.sceneDevice=key;
      b.dataset.current=String(current);b.style.setProperty('--tone',palette[kind]||palette.power);b.textContent=title;
      if(current)b.setAttribute('aria-current','true');
      b.title=current?(interactive?'查看'+title+'的部件':'当前观察 · '+title):'观察'+title;
      if(interactive){
        b.setAttribute('aria-label',b.title);
        b.onclick=e=>{e.stopPropagation();if(current)onCurrent(key);else onSelect(key);};
      }else b.style.pointerEvents='none';
      const dot=svg('circle',{r:current?4:3.4,fill:palette[kind]||palette.power,stroke:'#142735','stroke-width':1.25});
      const stem=svg('line',{stroke:palette[kind]||palette.power,'stroke-width':1,opacity:.64});
      labels.append(b);return {key,b,current,dot,stem};
    }
    function update(d){
      desc=d;last='';lines=[];pins=[];keyList=[];ink.replaceChildren(defs);labels.replaceChildren();host.hidden=!d;
      if(!d)return;
      const seen=new Set([d.key]);keyList.push(d.key);
      const mainKind=d.circuit==='liquid'?'supply':d.circuit==='data'?'signal':d.circuit==='air'?'air':'power';
      pins.push(makePin(d.key,d.title,mainKind,true));
      const occurrences=new Map();
      for(const link of d.links){
        if(link.key===d.key||link.kind==='reference')continue;
        const kind=link.circuit==='air'&&link.kind!=='return'?'air':Object.hasOwn(palette,link.kind)?link.kind:'power';
        const duplicate=occurrences.get(link.key)||0;occurrences.set(link.key,duplicate+1);
        const g=svg('g',{'data-medium':kind,'data-target':link.key,'data-dir':link.direction});
        const outline=svg('path',{class:'tw-line-shade'}),rail=svg('path',{class:'tw-line-rail',stroke:palette[kind],'marker-end':'url(#tw-route-tip-'+kind+')'});
        const pulse=svg('path',{class:'tw-line-flow',stroke:palette[kind]});
        g.append(outline,rail,pulse);
        if(link.direction==='both'){
          rail.setAttribute('marker-start','url(#tw-route-tip-'+kind+')');
          const counter=svg('path',{class:'tw-line-flow tw-counter-flow',stroke:palette[kind]});g.append(counter);
        }
        ink.append(g);lines.push({link,g,paths:[...g.children],duplicate});
        if(!seen.has(link.key)){pins.push(makePin(link.key,link.label,kind,false));seen.add(link.key);keyList.push(link.key);}
      }
      for(const p of pins)ink.append(p.stem,p.dot);
    }
    function preview(link){
      for(const line of lines){
        const focused=!link||line.link.key===link.key&&line.link.kind===link.kind&&line.link.direction===link.direction;
        line.g.classList.toggle('tw-route-muted',!focused);
      }
      for(const pin of pins){
        const matched=!link||pin.current||pin.key===link.key;
        for(const e of [pin.b,pin.dot,pin.stem])e.classList.toggle('tw-route-muted',!matched);
      }
    }
    function draw(project){
      if(!desc||!project)return;projector=project;
      const w=dims[0]||host.clientWidth,h=dims[1]||host.clientHeight;if(!w||!h)return;
      const positions=project(keyList);
      const hash=[w,h,...keyList.map(k=>positions[k]?Math.round(positions[k].x*2)+','+Math.round(positions[k].y*2):'-')].join('/');
      if(last===hash)return;last=hash;
      const here=positions[desc.key];
      for(const {link,g,paths,duplicate} of lines){
        const peer=positions[link.key];
        if(!here||!peer){g.style.display='none';continue;}g.style.display='';
        const vx=peer.x-here.x,vy=peer.y-here.y,length=Math.hypot(vx,vy)||1;
        const normal={x:-vy/length,y:vx/length},bend=Math.min(48,Math.max(link.direction==='both'?27:12,length*.155))*(duplicate%2?-1:1);
        const p0=link.direction==='in'?peer:here,p1=link.direction==='in'?here:peer;
        const midx=(here.x+peer.x)*.5+normal.x*bend,midy=(here.y+peer.y)*.5+normal.y*bend-8;
        const path='M'+p0.x.toFixed(1)+' '+p0.y.toFixed(1)+' Q'+midx.toFixed(1)+' '+midy.toFixed(1)+' '+p1.x.toFixed(1)+' '+p1.y.toFixed(1);
        for(const p of paths)p.setAttribute('d',path);
      }
      const used=[];toolBox.w=w<500?43:54;toolBox.h=w<500?142:166;
      for(const pin of pins){
        const p=positions[pin.key],b=pin.b;
        pin.stem.style.display='none';
        if(!p||p.x<1||p.x>w-1||p.y<1||p.y>h-1){b.hidden=true;pin.dot.style.display='none';continue;}
        pin.dot.style.display='';pin.dot.setAttribute('cx',p.x);pin.dot.setAttribute('cy',p.y);
        const width=Math.min(164,Math.max(58,b.textContent.length*(w<500?10.5:11.5)+19));
        let best;
        for(const [dx,dy] of [[0,-25],[0,27],[-40,-40],[40,-40],[0,-55],[-52,32],[52,32],[0,54]]){
          const right=p.y+dy>h-toolBox.h?w-toolBox.w:w-5;
          const x=Math.max(width*.5+4,Math.min(right-width*.5,p.x+dx)),y=Math.max(17,Math.min(h-18,p.y+dy));
          const penalty=used.reduce((v,r)=>v+(Math.abs(r.x-x)<(r.w+width)/2+3&&Math.abs(r.y-y)<24?1:0),0);
          if(!best||penalty<best.penalty)best={x,y,w:width,penalty};
          if(!penalty)break;
        }
        if(!pin.current&&best.penalty){b.hidden=true;continue;}
        b.hidden=false;b.style.left=best.x+'px';b.style.top=best.y+'px';
        const dx=p.x-best.x,dy=p.y-best.y,edge=Math.min(1,width*.5/(Math.abs(dx)||.01),10/(Math.abs(dy)||.01));
        pin.stem.setAttribute('x1',best.x+dx*edge);pin.stem.setAttribute('y1',best.y+dy*edge);
        pin.stem.setAttribute('x2',p.x);pin.stem.setAttribute('y2',p.y);pin.stem.style.display='';used.push(best);
      }
    }
    return {update,draw,preview,setPlaying(value){host.dataset.playing=String(Boolean(value));},destroy(){observer.disconnect();ink.remove();labels.remove();}};
  }
  window.GridDeviceOverlay={mount};
})();
