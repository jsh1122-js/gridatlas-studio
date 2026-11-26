/* Project the modeled cable or pipe centerline through the live scene camera. */
(() => {
  'use strict';
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  const ease=t=>t*t*(3-2*t);
  function measure(points){
    let length=0;
    const distances=[0];
    for(let i=1;i<points.length;i++){
      length+=Math.hypot(...points[i].map((v,k)=>v-points[i-1][k]));distances.push(length);
    }
    function sample(f){
      const d=clamp(f,0,1)*length;
      let i=1;while(i<points.length-1&&distances[i]<d)i++;
      if(!length||points.length===1)return {point:points[0],index:0};
      const t=(d-distances[i-1])/(distances[i]-distances[i-1]||1);
      return {point:points[i-1].map((v,k)=>v+(points[i][k]-v)*t),index:i-1};
    }
    return {length,points,sample};
  }
  function mount(host,{pose,requestDraw,onInspect}){
    const svgNS='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(svgNS,'svg');svg.setAttribute('aria-hidden','true');svg.classList.add('tw-tour-rail');
    function node(kind,cls){const n=document.createElementNS(svgNS,kind);n.setAttribute('class',cls);svg.append(n);return n;}
    const shadow=node('path','tw-tour-shadow'),rail=node('path','tw-tour-conductor'),lit=node('path','tw-tour-passed'),internal=node('path','tw-tour-transfer');
    const ring=node('circle','tw-tour-glow'),dot=node('circle','tw-tour-charge');ring.setAttribute('r','7.5');dot.setAttribute('r','3.8');
    const label=document.createElement('button');label.type='button';label.className='tw-tour-pin';label.hidden=true;
    label.onclick=e=>{e.stopPropagation();if(scene)onInspect(scene.step);};
    host.append(svg,label);svg.style.display='none';
    let motion=null,scene=null;
    function settle(result){
      if(!motion)return;
      const old=motion;motion=null;old.signal.removeEventListener('abort',old.cancel);old.resolve(result);
    }
    function halt(clear=false){
      settle(false);
      if(clear){scene=null;svg.style.display='none';label.hidden=true;delete host.dataset.tourStep;delete host.dataset.tourMedium;}
      requestDraw();
    }
    function play({step,fromFraction=0,onProgress,signal,reducedMotion},view){
      halt(true);
      if(signal.aborted||!step.points?.length)return Promise.resolve(false);
      const path=measure(step.points),start=pose(),from=clamp(fromFraction,0,1);
      const target=path.sample(from).point,dist=Math.hypot(target[0]-start.fx,target[1]-start.fy,target[2]-start.fz);
      const samePose=dist<.001&&Math.abs(Math.log(view.zoom/start.zoom))<.01&&Math.abs(view.pitch-start.pitch)<.01&&Math.cos(view.yaw-start.yaw)>.9999;
      const approach=reducedMotion||(step.medium&&samePose)?0:clamp(350+Math.min(280,dist*9)+Math.abs(Math.log(view.zoom/start.zoom))*110,350,1050);
      const duration=reducedMotion?0:clamp(1750+Math.sqrt(path.length)*390,1800,5700)*(1-from);
      const desiredYaw=start.yaw+Math.atan2(Math.sin(view.yaw-start.yaw),Math.cos(view.yaw-start.yaw));
      scene={step,path,at:from};host.dataset.tourStep=step.key;svg.style.display='';label.textContent=step.title;
      if(step.medium)host.dataset.tourMedium=step.medium;
      label.setAttribute('aria-label','停下查看'+step.title);
      const promise=new Promise(resolve=>{
        const cancel=()=>halt(false);
        motion={approach,duration,start,from,view:{...view,yaw:desiredYaw},started:null,signal,cancel,resolve,onProgress};
        signal.addEventListener('abort',cancel,{once:true});
      });requestDraw();return promise;
    }
    function tick(now){
      if(!motion)return null;
      const m=motion;m.started??=now;
      const elapsed=now-m.started,blend=m.approach?ease(clamp(elapsed/m.approach,0,1)):1;
      const progress=m.duration?clamp((elapsed-m.approach)/m.duration,0,1):1;
      const at=m.from+(1-m.from)*ease(progress),point=scene.path.sample(at).point;
      scene.at=at;m.onProgress?.(at);
      const lerp=(a,b)=>a+(b-a)*blend;
      const current={yaw:lerp(m.start.yaw,m.view.yaw),pitch:lerp(m.start.pitch,m.view.pitch),
        zoom:Math.exp(lerp(Math.log(m.start.zoom),Math.log(m.view.zoom))),fx:lerp(m.start.fx,point[0]),fy:lerp(m.start.fy,point[1]),fz:lerp(m.start.fz,point[2])};
      if(progress===1&&blend===1)settle(true);
      return current;
    }
    function draw(cam,project){
      if(!scene)return;
      const pixels=scene.path.points.map(p=>project(p,cam)),head=scene.path.sample(scene.at),end=pixels.at(-1),p=project(head.point,cam);
      const xy=v=>v[0].toFixed(1)+','+v[1].toFixed(1);
      const line=ps=>ps.length?'M'+ps.map(xy).join(' L'):'';
      const segments=scene.step.segments;
      if(segments?.some(s=>s.kind==='transfer')){
        const visible=kind=>segments.filter(s=>(s.kind==='transfer')===kind).map(s=>line(s.points.map(q=>project(q,cam)))).join(' ');
        const conductor=visible(false);
        shadow.setAttribute('d',conductor);rail.setAttribute('d',conductor);internal.setAttribute('d',visible(true));lit.setAttribute('d','');
      }else{
        const track=line(pixels);shadow.setAttribute('d',track);rail.setAttribute('d',track);internal.setAttribute('d','');
        lit.setAttribute('d',line([...pixels.slice(0,head.index+1),p]));
      }
      for(const n of [ring,dot]){n.setAttribute('cx',p[0]);n.setAttribute('cy',p[1]);}
      label.hidden=end[0]<5||end[0]>cam.width-5||end[1]<5||end[1]>cam.height-6;
      if(!label.hidden){
        const limit=Math.min(scene.step.medium?260:170,cam.width*.76);
        label.style.maxWidth=limit+'px';
        const half=Math.min(limit,scene.step.title.length*13+22)/2+4;
        const space=end[1]>cam.height-145?43:0;
        label.style.left=clamp(end[0],half,cam.width-half-space)+'px';label.style.top=clamp(end[1]-23,17,cam.height-17)+'px';
      }
    }
    return {play,tick,draw,halt,get medium(){return scene?.step.medium;},get moving(){return Boolean(motion);},destroy(){halt(true);svg.remove();label.remove();}};
  }
  window.GridPowerCamera={mount,measure};
})();
