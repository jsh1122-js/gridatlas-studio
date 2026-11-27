/* A north-up planning map. Ground features, existing lines and proposed endpoints all use WGS84/Web Mercator. */
(() => {
  'use strict';
  const src=document.currentScript?.src||location.href;
  const svgNS='http://www.w3.org/2000/svg', clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmt=km=>km<1?Math.round(km*1000)+' m':km.toFixed(2)+' km';
  const passes=[['wood','grass','built','industrial','quarry','water','wetland','scrub'],['river'],['road','service'],['mainroad'],['rail'],['highway','motorway'],['line','substation']];
  const colors={wood:'#344d43',grass:'#304a3f',built:'#3f4e53',industrial:'#4b5559',quarry:'#555454',water:'#2c6577',wetland:'#365b5c',scrub:'#3b5144',
    river:'#66a0af',road:'#586970',service:'#45565d',mainroad:'#87918c',rail:'#b9b4a9',highway:'#9bafa7',motorway:'#a8b5ae',line:'#c4a276',substation:'#bea485'};
  const entity=(tag,cls,parent)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(parent)parent.append(n);return n;};
  const vector=(tag,parent,attrs={})=>{const n=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;};
  const valid=r=>r&&Number.isFinite(r.lat)&&Number.isFinite(r.lon)&&Math.abs(r.lat)<=85.05113&&Math.abs(r.lon)<=180;
  const delta=(v,center)=>v-center-Math.round(v-center);
  function stationIcon(canvas,site,count) {
    const w=site?48:32,h=site?38:29;
    canvas.width=w*2;canvas.height=h*2;
    const c=canvas.getContext('2d');c.scale(2,2);c.lineWidth=1;c.lineJoin='round';
    const face=(ps,fill,line)=>{c.beginPath();ps.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=line;c.stroke();};
    if(!site){
      face([[16,3],[27,10],[27,19],[16,26],[5,19],[5,10]],'#1f3139','#cab79d');
      c.strokeStyle='#ffe0a1';c.lineWidth=1.6;
      for(const x of [12,20]){c.beginPath();c.moveTo(x-2,18);c.lineTo(x+1,9);c.lineTo(x+3,18);c.moveTo(x-3,12);c.lineTo(x+4,12);c.stroke();}
      return;
    }
    face([[2,24],[28,9],[46,20],[20,36]],'#205654','#a2eee0');
    function box(x,y){face([[x,y],[x+9,y-5],[x+16,y-1],[x+7,y+4]],'#92bebb','#c5f9eb');face([[x,y],[x+7,y+4],[x+7,y+10],[x,y+6]],'#447774','#8cc9bd');face([[x+7,y+4],[x+16,y-1],[x+16,y+5],[x+7,y+10]],'#315b59','#8cc9bd');
      for(let k=0;k<3;k++){c.beginPath();c.strokeStyle='#fad59d';c.moveTo(x+3+3*k,y+1-1.5*k);c.lineTo(x+3+3*k,y-4-1.5*k);c.stroke();}}
    box(19,12);if(count!==1)box(8,20);
  }
  function mount(container,options={}){
    const geo=window.GridTerritoryGeo,frame=entity('div','tg-map',container);
    container.classList.add('tg-shell');
    const stage=container.closest('.tw-stage'),lineKey=entity('section','tg-line-key',container);
    lineKey.hidden=true;lineKey.setAttribute('aria-label','规划接入线图例');
    const keyBody=entity('div','tg-line-rows',lineKey);
    const keyObserver=new ResizeObserver(()=>stage?.style.setProperty('--tg-key-height',lineKey.offsetHeight+'px'));
    keyObserver.observe(lineKey);
    const canvas=entity('canvas','tg-geography',frame);canvas.tabIndex=0;
    canvas.setAttribute('aria-label','区域接入地图；拖动平移、滚轮缩放，方向键平移，Home 复位');
    const ctx=canvas.getContext('2d'),svg=vector('svg',frame,{'class':'tg-routes','aria-hidden':'true'}),marks=entity('div','tg-marks',frame);
    const meta=entity('div','tg-meta',frame),legend=entity('div','tg-legend',meta);
    for(const [text,style] of [['已有电力线',''],['规划接入','tg-sw-plan'],['候选直线','tg-sw-cand']]){
      const item=entity('span','',legend);entity('i',style,item);item.append(text);
    }
    const note=entity('div','tg-note',meta),status=entity('span','',note);status.setAttribute('role','status');
    const retry=entity('button','tg-retry',note);retry.type='button';retry.textContent='重试底图';retry.hidden=true;
    const pickHint=entity('div','tg-pick',meta);pickHint.append('点地图确定新场址');pickHint.hidden=true;
    const cancel=entity('button','',pickHint);cancel.type='button';cancel.textContent='取消';
    const scale=entity('div','tg-scale',frame),scaleText=entity('span','',scale),scaleBar=entity('i','',scale);
    const credit=entity('div','tg-copy',frame);
    function link(label,href){const a=entity('a');a.href=href;a.textContent=label;a.target='_blank';a.rel='noopener noreferrer';return a;}
    let loc,plan,results,selected,region,key='',layers=[],camera=[.5,.5],zoom=10,w=0,h=0,raf=0,debounce=0,
      destroyed=false,revision=0,picking=false,manual=false,activeTag='',markRows=[],linkRows=[],previousPlan='';
    const markerNodes=new Map(),routeNodes=new Map(),tileCache=new Map(),pointers=new Map();
    const network=new AbortController(),events={signal:network.signal};
    const relief=new Image();relief.onload=schedule;relief.src=new URL('relief.webp',src);
    const world=()=>256*2**zoom;
    const pixel=p=>[w/2+delta(p[0],camera[0])*world(),h/2+(p[1]-camera[1])*world()];
    const point=(x,y)=>[camera[0]+(x-w/2)/world(),camera[1]+(y-h/2)/world()];
    const projectRow=r=>geo.project(r.lat,r.lon);
    const nearest=()=>results?.rows?.find(valid)||null;
    const distance=r=>GridNearby.distance(loc.lat,loc.lon,r.lat,r.lon);
    function schedule(){if(!destroyed&&!raf)raf=requestAnimationFrame(draw);}
    function resize(){const box=frame.getBoundingClientRect();if(!box.width||!box.height)return;
      const was=w;w=box.width;h=box.height;
      if(was!==w&&!manual&&loc)fit();schedule();}
    const observer=new ResizeObserver(resize);observer.observe(frame);
    function fit(){
      if(!w||!h||!loc)return;
      const home=projectRow(loc),configured=plan.connections.map(l=>l.station).filter(valid);
      // When a project has a design, frame its endpoints instead of pulling the camera
      // out to an unrelated eighth nearby station several kilometres away.
      const visible=configured.length?[...configured,...(valid(selected)?[selected]:[])]:markRows;
      const points=[home,...visible.map(projectRow)];
      const xx=points.map(p=>delta(p[0],home[0])),yy=points.map(p=>p[1]);
      const dx=Math.max(...xx)-Math.min(...xx),dy=Math.max(...yy)-Math.min(...yy);
      const minSpan=320/(40075016*Math.max(.08,Math.cos(loc.lat*Math.PI/180)));
      if(points.length===1){camera=home;zoom=10.8;return;}
      camera=[home[0]+(Math.min(...xx)+Math.max(...xx))/2,(Math.min(...yy)+Math.max(...yy))/2];
      zoom=clamp(Math.log2(Math.min(Math.max(75,w-(w<500?96:190))/(256*Math.max(dx,minSpan)),Math.max(78,h-(w<500?120:142))/(256*Math.max(dy,minSpan)))),1.5,14.4);
    }
    function zoomBy(factor,anchor=[w/2,h/2]){
      if(!Number.isFinite(factor)||factor<=0)return;
      manual=true;const p=point(...anchor);zoom=clamp(zoom+Math.log2(factor),1.5,18);
      camera=[p[0]-(anchor[0]-w/2)/world(),clamp(p[1]-(anchor[1]-h/2)/world(),0,1)];schedule();
    }
    function reset(){manual=false;fit();schedule();}
    function focusStation(row){
      selected=valid(row)?row:null;sync();
      if(selected){const [x,y]=pixel(projectRow(selected));if(x<38||y<50||x>w-38||y>h-38){manual=false;fit();}}
      schedule();
    }
    function mark(r,site=false){
      const id=site?'@site':r.id;let rec=markerNodes.get(id);
      if(!rec){
        const b=entity('button','tg-mark',marks);b.type='button';
        const icon=entity('canvas','',b);icon.setAttribute('aria-hidden','true');const text=entity('span','tg-bubble',b);
        if(site)b.dataset.siteMarker='';else b.dataset.stationId=id;
        rec={b,icon,text,site,row:r};markerNodes.set(id,rec);
        b.onclick=()=>{if(picking)return;if(site){options.onSelectSite?options.onSelectSite():options.onSelect?.(null);}else{focusStation(rec.row);options.onSelect?.(rec.row);}};
      }
      rec.row=r;
      const rank=(results?.rows||[]).findIndex(row=>row.id===r.id)+1;
      const stationName=site?(plan.site.name&&plan.site.name!==loc.label?plan.site.name:'自建变电站'):(r.name||(rank?'候选站 '+String(rank).padStart(2,'0'):'接入站'));
      const voltage=site&&plan.site.voltageKV?plan.site.voltageKV+' kV':r.voltage||'';
      rec.text.textContent=stationName+(site&&voltage?' · '+voltage:'');rec.b.title=stationName+' '+voltage+(site?' · '+loc.label:' · '+r.id);rec.b.setAttribute('aria-label',rec.b.title);
      const planned=site?null:linkRows.find(l=>!l.preview&&l.station.id===id);
      rec.b.dataset.linked=String(Boolean(planned));
      if(planned)rec.b.dataset.lineNumber=planned.number;else delete rec.b.dataset.lineNumber;
      rec.b.setAttribute('aria-pressed',String(!site&&selected?.id===id));
      stationIcon(rec.icon,site,plan.site.transformers?.units||plan.site.transformers?.length||plan.site.transformers);
    }
    function sync(){
      if(!loc)return;
      const mapped=(results?.rows||[]).filter(valid).slice(0,8),planned=plan.connections.filter(l=>valid(l.station));
      const list=new Map(mapped.map(r=>[r.id,r]));for(const l of planned)list.set(l.station.id,{...l.station,distanceKm:distance(l.station)});
      if(selected)list.set(selected.id,selected);
      markRows=[...list.values()];linkRows=planned.map((l,i)=>({...l,number:String(i+1).padStart(2,'0'),distanceKm:distance(l.station)}));
      const candidate=selected||(!planned.length?nearest():null);
      if(candidate&&!planned.some(l=>l.station.id===candidate.id))linkRows.push({station:candidate,preview:true,distanceKm:distance(candidate)});
      const keep=new Set(['@site',...markRows.map(r=>r.id)]);
      for(const [id,rec] of markerNodes)if(!keep.has(id)){rec.b.remove();markerNodes.delete(id);}
      mark(plan.site,true);for(const r of markRows)mark(r);
      keyBody.replaceChildren();lineKey.hidden=!planned.length;
      for(const l of linkRows.filter(item=>!item.preview)){
        const row=entity('button','',keyBody);row.type='button';row.dataset.lineStation=l.station.id;
        row.setAttribute('aria-pressed',String(selected?.id===l.station.id));
        entity('b','tg-route-number',row).textContent=l.number;
        const name=l.station.name||('接入站 '+l.number);
        const label=entity('span','tg-line-name',row);label.textContent=name;label.title=name;
        entity('strong','',row).textContent=l.circuits+' 回';
        entity('span','tg-line-km',row).textContent=fmt(l.distanceKm);
        row.onclick=()=>{focusStation(l.station);options.onSelect?.(l.station);};
      }
      svg.replaceChildren();routeNodes.clear();
      for(const l of linkRows){
        const g=vector('g',svg,{'data-grid-link':l.station.id,'data-link-kind':l.preview?'candidate':'planned','data-active':String(l.station.id===selected?.id),'data-circuits':l.circuits??'','data-distance-km':l.distanceKm.toFixed(3)});
        const shadow=vector('path',g,{'class':'tg-link-shadow'}),line=vector('path',g,{'class':l.preview?'tg-candidate':'tg-planned'});
        const leader=vector('path',g,{'class':'tg-annotation'});
        const box=vector('g',g,{'class':l.preview?'tg-preview':''}),bg=vector('rect',box,{rx:4,height:20}),t=vector('text',box,{x:5,y:14});
        t.textContent=(l.preview?'候选':String(l.circuits)+' 回')+' · '+fmt(l.distanceKm);
        routeNodes.set(l.station.id,{shadow,line,box,bg,t,leader});
      }
      for(const rec of markerNodes.values())rec.stem=vector('path',svg,{'class':'tg-marker-stem'});
      schedule();
    }
    function update({project,stations,gridPlan}={}){
      if(!valid(project?.location))return;
      const next=project.location.lat+'/'+project.location.lon,moved=next!==key;
      const newPlan=gridPlan||{site:{...project.location,name:'规划自建站'},connections:[]};
      const signature=JSON.stringify(newPlan),sameResults=results===stations;
      if(moved){key=next;revision++;selected=null;region=null;results=null;activeTag='';manual=false;camera=projectRow(project.location);zoom=10.8;}
      loc=project.location;plan={site:{...loc,...newPlan.site},connections:newPlan.connections||[]};
      if(stations!==undefined)results=stations;
      if(moved){
        const rev=revision,lat=loc.lat,lon=loc.lon;
        geo.loadRegion([lon-.5,lat-.35,lon+.5,lat+.35]).then(data=>{if(!destroyed&&rev===revision){region=data;schedule();}});
        if(stations===undefined)GridNearby.find(lat,lon,{radiusKm:15,limit:20,signal:network.signal}).then(r=>{if(!destroyed&&rev===revision){results=r;sync();if(!manual)fit();}}).catch(()=>{if(!destroyed&&rev===revision){results={rows:[],status:'unavailable'};sync();}});
      }
      if(moved||!sameResults||previousPlan!==signature){sync();if(!manual||previousPlan!==signature)fit();else schedule();}
      previousPlan=signature;resize();
    }
    function sitePick(on=true){picking=on;pickHint.hidden=!on;frame.dataset.picking=String(on);if(on)canvas.focus({preventScroll:true});}
    cancel.onclick=()=>sitePick(false);
    function tileRecords(){
      const z=clamp(Math.floor(zoom),2,17),n=2**z,sw=point(0,h),ne=point(w,0),out=[];
      const left=Math.floor(sw[0]*n),right=Math.floor(ne[0]*n),top=clamp(Math.floor(ne[1]*n),0,n-1),bottom=clamp(Math.floor(sw[1]*n),0,n-1);
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
        const tx=(x%n+n)%n,id=z+'/'+tx+'/'+y;
        out.push({id,z,n,x,y,tx,bx:w/2+(x/n-camera[0])*world(),by:h/2+(y/n-camera[1])*world(),size:world()/n});
      }
      return out;
    }
    function queueTiles(tiles){
      const tag=tiles.map(t=>t.id).join(' ');
      if(tag===activeTag)return;
      activeTag=tag;clearTimeout(debounce);
      debounce=setTimeout(()=>{
        for(const t of tiles){
          if(tileCache.has(t.id))continue;
          const task={image:new Image(),raster:'loading',power:'loading',lines:[],abort:new AbortController()};tileCache.set(t.id,task);
          task.image.onload=()=>{task.raster='ok';schedule();};task.image.onerror=()=>{task.raster='error';schedule();};
          task.image.src='https://tile.openstreetmap.org/'+t.id+'.png';
          const timer=setTimeout(()=>task.abort.abort(),9000);
          fetch('https://openinframap.org/map/power/'+t.id+'.pbf',{signal:task.abort.signal}).then(async r=>{
            if(!r.ok)throw Error('tile');task.lines=r.status===204?[]:GridNearby.powerLines(await r.arrayBuffer());task.power='ok';
          }).catch(()=>{task.power='error';}).finally(()=>{clearTimeout(timer);schedule();});
        }
        for(const [id,task] of tileCache){
          if(tileCache.size<=90)break;if(tiles.some(t=>t.id===id))continue;
          task.image.onload=task.image.onerror=null;task.abort.abort();tileCache.delete(id);
        }
      },170);
    }
    retry.onclick=()=>{for(const [id,t] of tileCache)if(t.raster==='error'||t.power==='error'){t.abort.abort();tileCache.delete(id);}activeTag='';schedule();};
    function path(points,screen){
      ctx.beginPath();points.forEach((p,i)=>{const [x,y]=screen(p);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
    }
    function drawLocal(data,view){
      const {paths,places}=geo.unpack(data),nw=pixel(geo.project(data.bounds[3],data.bounds[0])),se=pixel(geo.project(data.bounds[1],data.bounds[2]));
      ctx.save();ctx.beginPath();ctx.rect(nw[0],nw[1],se[0]-nw[0],se[1]-nw[1]);ctx.clip();
      if(data.coverage){
        ctx.beginPath();for(const poly of data.coverage)for(const ring of poly)ring.forEach(([lon,lat],i)=>{const [x,y]=pixel(geo.project(lat,lon));if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);});
        ctx.clip('evenodd');
      }
      ctx.fillStyle='#304047';ctx.fillRect(0,0,w,h);
      if(data.terrain&&relief.complete&&relief.naturalWidth){
        const t=data.terrain,n=2**t.z,[x,y]=pixel([t.x/n,t.y/n]);ctx.globalAlpha=.35;ctx.drawImage(relief,x,y,t.cols/n*world(),t.rows/n*world());ctx.globalAlpha=1;
      }
      const visible=paths.filter(f=>geo.overlap(f.box,view));
      for(const kinds of passes)for(const f of visible){
        if(!kinds.includes(f.kind))continue;
        const fill=passes[0].includes(f.kind)||f.kind==='substation';
        ctx.lineWidth=({road:.65,service:.5,river:1.4,rail:1.2,mainroad:1.55,highway:2,motorway:2.6,line:1.22,substation:1.1})[f.kind]||1;
        ctx.setLineDash(f.kind==='rail'?[3,3]:[]);
        path(f.points,pixel);ctx.strokeStyle=colors[f.kind];
        if(fill){ctx.fillStyle=colors[f.kind];if(f.points.length>2){ctx.closePath();ctx.fill();}if(f.kind==='substation')ctx.stroke();}
        else ctx.stroke();
      }
      ctx.setLineDash([]);const used=[];
      const priority=p=>({city:0,town:1,suburb:2,village:3,hamlet:4})[p.kind]??5;
      for(const place of places.slice().sort((a,b)=>priority(a)-priority(b))){
        const [x,y]=pixel(place.point),major=priority(place)<2;
        if(x<18||x>w-20||y<33||y>h-20||!major&&zoom<10.2)continue;
        ctx.font=(major?'600 14':'500 11')+'px system-ui,sans-serif';const tw=ctx.measureText(place.name).width;
        if(used.some(r=>Math.abs(x-r[0])<(tw+r[2])/2+10&&Math.abs(y-r[1])<16))continue;
        used.push([x,y,tw]);ctx.textAlign='center';ctx.strokeStyle='#24343b';ctx.lineWidth=3;ctx.strokeText(place.name,x,y);ctx.fillStyle=major?'#e1e8dc':'#b8c8c4';ctx.fillText(place.name,x,y);
      }
      ctx.restore();
    }
    function drawWeb(tiles){
      let raster=0,failed=0,lines=0,pfail=0;ctx.save();
      ctx.filter='saturate(.6) brightness(.9)';
      for(const tile of tiles){
        const t=tileCache.get(tile.id);
        if(t?.raster==='ok'){ctx.drawImage(t.image,tile.bx,tile.by,tile.size+.35,tile.size+.35);raster++;}else if(t?.raster==='error')failed++;
      }
      ctx.filter='none';ctx.strokeStyle='#917147';ctx.lineWidth=1.6;
      for(const tile of tiles){
        const t=tileCache.get(tile.id);if(t?.power==='error')pfail++;
        if(t?.power!=='ok')continue;
        lines++;ctx.save();ctx.beginPath();ctx.rect(tile.bx,tile.by,tile.size,tile.size);ctx.clip();
        for(const line of t.lines){path(line,p=>[tile.bx+p[0]*tile.size,tile.by+p[1]*tile.size]);ctx.stroke();}ctx.restore();
      }
      ctx.restore();return{raster,failed,lines,pfail};
    }
    function setCredits(local,online){
      const id=local.map(d=>d.retrieved).join()+online;
      if(credit.dataset.sources===id)return;
      credit.dataset.sources=id;credit.replaceChildren(link('© OpenStreetMap contributors','https://www.openstreetmap.org/copyright'));
      if(online)credit.append(' · ',link('OpenInfraMap','https://openinframap.org/copyright'));
      if(local.includes(region)&&region)credit.append(' · ',link('Geofabrik','https://download.geofabrik.de/asia/china/ningxia.html'),' · ',link('区域数据',geo.url.href));
      if(local.some(d=>d.terrain))credit.append(' · ',link('Mapzen 地形','https://registry.opendata.aws/terrain-tiles/'));
    }
    function drawOverlay(){
      const a=pixel(projectRow(plan.site)),occupied=[[0,0,w,Math.min(meta.offsetHeight+10,50)],[0,h-25,w,h],[w-43,h-150,w,h]];
      const free=box=>box[0]>=1&&box[1]>=1&&box[2]<w-1&&box[3]<h-2&&!occupied.some(b=>geo.overlap(box,b));
      const all=[...markerNodes.values()].sort((a,b)=>Number(b.site)-Number(a.site)||Number(b.b.getAttribute('aria-pressed')==='true')-Number(a.b.getAttribute('aria-pressed')==='true')||Number(b.b.dataset.linked==='true')-Number(a.b.dataset.linked==='true'));
      const markerBoxes=[];
      for(const rec of all){
        const [x,y]=pixel(projectRow(rec.row));rec.b.hidden=x<0||x>w||y<0||y>h;
        rec.stem.style.display='none';
        if(rec.b.hidden)continue;
        const offsets=[[0,0],[-19,-11],[20,-11],[-19,13],[20,13],[0,-26],[0,25],[-35,-22],[35,-22],[-35,22],[35,22]];
        const placement=offsets.find(([dx,dy])=>{
          const b=[x+dx-10,y+dy-11,x+dx+10,y+dy+9];
          return b[0]>=0&&b[2]<=w&&b[1]>=0&&b[3]<=h&&!markerBoxes.some(other=>geo.overlap(b,other));
        })||offsets[0];
        const xx=x+placement[0],yy=y+placement[1];rec.screen=[xx,yy];
        markerBoxes.push([xx-10,yy-11,xx+10,yy+9]);
        if(placement[0]||placement[1]){rec.stem.setAttribute('d','M'+x+' '+y+' L'+xx+' '+yy);rec.stem.style.display='';}
      }
      occupied.push(...markerBoxes);
      function markerLabel(rec,allow=true){
        if(rec.b.hidden)return;
        const [x,y]=rec.screen;rec.b.style.left=x+'px';rec.b.style.top=y+'px';
        const tw=Math.min(rec.site?155:w<500?102:145,Math.max(34,rec.text.textContent.length*(w<500?11:12)+12)),bh=21;
        const positions=[[14,-24],[14,4],[-tw-13,-22],[-tw-13,4],[-tw/2,15],[-tw/2,-39]];
        const target=allow&&positions.find(([dx,dy])=>free([x+dx,y+dy,x+dx+tw,y+dy+bh]));
        rec.text.hidden=!target;
        if(target){const [dx,dy]=target;rec.text.style.left=(dx+rec.b.offsetWidth*.5)+'px';rec.text.style.top=(dy+rec.b.offsetHeight*.6)+'px';occupied.push([x+dx,y+dy,x+dx+tw,y+dy+bh]);}
      }
      markerLabel(all[0]);
      const dense=keyBody.children.length>2&&lineKey.offsetHeight>0;
      const detailId=selected?.id||linkRows[0]?.station.id;
      for(const l of [...linkRows].sort((a,b)=>Number(b.station.id===selected?.id)-Number(a.station.id===selected?.id))){
        const b=pixel(projectRow(l.station)),n=routeNodes.get(l.station.id);
        const d='M'+a.map(v=>v.toFixed(2)).join(' ')+' L'+b.map(v=>v.toFixed(2)).join(' ');
        n.shadow.setAttribute('d',d);n.line.setAttribute('d',d);
        // In a dense mobile view, number the endpoints and reserve the detailed callout for
        // the active line. The map key below keeps the values for every line visible together.
        if(dense&&!l.preview&&l.station.id!==detailId){n.box.style.display=n.leader.style.display='none';continue;}
        const width=Math.ceil(n.t.getComputedTextLength()||n.t.textContent.length*8)+10;
        let label,anchor;
        const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
        for(const off of [14,-14,31,-31,49,-49,68,-68])for(const t of [.5,.67,.35,.81,.22]){
          const p=[a[0]+dx*t,a[1]+dy*t],x=p[0]-dy/len*off-width/2,y=p[1]+dx/len*off-10;
          if(!label&&free([x,y,x+width,y+20])){label=[x,y];anchor=p;}
        }
        n.box.style.display=label?'':'none';n.leader.style.display=label?'':'none';
        if(label){n.bg.setAttribute('width',width);n.box.setAttribute('transform','translate('+label.join(' ')+')');
          n.leader.setAttribute('d','M'+anchor.join(' ')+' L'+[clamp(anchor[0],label[0],label[0]+width),clamp(anchor[1],label[1],label[1]+20)].join(' '));
          occupied.push([...label,label[0]+width,label[1]+20]);}
      }
      let unnamed=0;
      for(const rec of all.slice(1)){
        const important=rec.row.id===selected?.id||rec.b.dataset.linked==='true'||rec.row.id===nearest()?.id;
        const allow=important || rec.row.name || ++unnamed<=(w<500?0:2);
        markerLabel(rec,dense&&rec.b.dataset.linked==='true'?rec.row.id===detailId:allow);
      }
    }
    function draw(){
      raf=0;if(!loc||!w||!h||destroyed||frame.getClientRects().length===0)return;
      const dpr=Math.min(devicePixelRatio||1,2);
      if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
      ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#26353d';ctx.fillRect(0,0,w,h);svg.setAttribute('viewBox','0 0 '+w+' '+h);
      const start=point(0,0),end=point(w,h),view=[...start,...end],bl=geo.unproject(start[0],end[1]),tr=geo.unproject(end[0],start[1]);
      const box=[bl.lon,bl.lat,tr.lon,tr.lat],all=[window.GridMapData,region].filter(Boolean);
      layers=all.filter(d=>geo.overlap(d.bounds,box));const complete=layers.some(d=>geo.covers(d,box)),tiles=complete?[]:tileRecords();
      queueTiles(tiles);const web=drawWeb(tiles);
      for(const d of layers)drawLocal(d,view);
      frame.dataset.base=complete?'local':web.raster===tiles.length&&tiles.length?'online':web.raster||layers.length?'partial':web.failed===tiles.length&&tiles.length?'offline':'loading';
      const warnings=[];
      if(frame.dataset.base==='offline')warnings.push('在线底图不可用，保留坐标与方案');else if(!complete&&web.failed)warnings.push('部分底图未加载');
      if(!complete&&web.pfail)warnings.push('已有线路图层未完整加载');
      if(!results)warnings.push('正在检索附近变电站');else if(results.status==='unavailable'||results.status==='partial')warnings.push('附近站点检索'+(results.status==='partial'?'不完整':'暂不可用'));
      else if(!results.rows?.length)warnings.push('查询半径内未收录公网站');
      if(!warnings.length&&frame.dataset.base==='loading')warnings.push('正在加载在线底图');
      const words=warnings.join(' · ');if(status.textContent!==words)status.textContent=words;
      retry.hidden=!web.failed&&!web.pfail;note.hidden=!words&&retry.hidden;setCredits(layers,!complete);drawOverlay();
      const lat=geo.unproject(...camera).lat,mpp=40075016*Math.cos(lat*Math.PI/180)/world(),meters=Math.max(.01,mpp*(w<480?60:84)),
        exp=10**Math.floor(Math.log10(meters)),length=([5,2,1].find(n=>n*exp<=meters)||1)*exp;
      scaleText.textContent=length>=1000?length/1000+' km':length+' m';scaleBar.style.width=length/mpp+'px';
    }
    const at=e=>{const r=canvas.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];};
    let moved=false,down=null,multi=false;
    canvas.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,at(e));if(pointers.size===1){down=at(e);moved=false;multi=false;}else multi=true;
    },events);
    canvas.addEventListener('pointermove',e=>{
      const last=pointers.get(e.pointerId);if(!last)return;const pos=at(e);
      if(pointers.size===2){const other=[...pointers.entries()].find(([id])=>id!==e.pointerId)?.[1];if(other){const a=Math.hypot(last[0]-other[0],last[1]-other[1]),b=Math.hypot(pos[0]-other[0],pos[1]-other[1]);if(a>4&&b>4)zoomBy(b/a,[(pos[0]+other[0])/2,(pos[1]+other[1])/2]);}}
      else if(!multi){if(Math.hypot(pos[0]-down[0],pos[1]-down[1])>4)moved=true;
        if(moved){camera=[camera[0]-(pos[0]-last[0])/world(),clamp(camera[1]-(pos[1]-last[1])/world(),0,1)];manual=true;schedule();}}
      pointers.set(e.pointerId,pos);
    },events);
    const release=e=>{if(!pointers.has(e.pointerId))return;const pos=at(e);pointers.delete(e.pointerId);
      if(e.type==='pointerup'&&!moved&&!multi&&picking){const p=geo.unproject(...point(...pos));sitePick(false);options.onPickLocation?.(p.lat,p.lon);}};
    canvas.addEventListener('pointerup',release,events);canvas.addEventListener('pointercancel',release,events);
    canvas.addEventListener('wheel',e=>{e.preventDefault();zoomBy(Math.exp(-Math.sign(e.deltaY)*.16),at(e));},{signal:events.signal,passive:false});
    canvas.addEventListener('keydown',e=>{const pan={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]}[e.key];
      if(pan){manual=true;camera=[camera[0]+pan[0]*w/world(),clamp(camera[1]+pan[1]*h/world(),0,1)];schedule();}
      else if(e.key==='Home')reset();else if(['=','+','-'].includes(e.key))zoomBy(e.key==='-'?.8:1.25);
      else if(e.key==='Escape')sitePick(false);else return;e.preventDefault();
    },events);
    resize();
    return {update,zoomBy,reset,resize,focusStation,pickSite:()=>sitePick(true),setPlaying(v){frame.dataset.playing=String(Boolean(v));},destroy(){
      destroyed=true;network.abort();observer.disconnect();keyObserver.disconnect();lineKey.remove();container.classList.remove('tg-shell');stage?.style.removeProperty('--tg-key-height');clearTimeout(debounce);cancelAnimationFrame(raf);relief.onload=null;
      for(const t of tileCache.values()){t.image.onload=t.image.onerror=null;t.abort.abort();}tileCache.clear();frame.remove();
    }};
  }
  window.GridTerritory=Object.freeze({mount});
})();
