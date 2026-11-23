/* Geographic overview for the bundled OSM extract. Coordinate math uses Web Mercator. */
(()=> {
  "use strict";
  const earthCircumference = 40075016.686;
  const home = {lat:39.22415,lon:109.84495};
  const initialZoom = 12.4;
  const radians = Math.PI / 180;
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  function sanePoint(lat,lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=85.05113 && Math.abs(lon)<=180;
  }
  function project(lat,lon) {
    return [(lon+180)/360,(1-Math.asinh(Math.tan(clamp(lat,-85.05112878,85.05112878)*radians))/Math.PI)/2];
  }
  function unproject(x,y) {
    return {lon:clamp(x,0,1)*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*clamp(y,0,1))))/radians};
  }
  const fills = {wood:"#294a4196",grass:"#324c407c",built:"#42526869",quarry:"#57606a6d",industrial:"#4b57617f",water:"#225363",wetland:"#284940",scrub:"#334a40"};
  const strokes = {
    river:["#427686",1.15],service:["#48606b",0.65],road:["#596b74",0.85],mainroad:["#70828c",1.15],
    highway:["#91a2aa",1.75],motorway:["#97a7ae",2.1],rail:["#82939a",1.3]
  };
  const geoFile = new URL("map-data.js",document.currentScript.src);
  const imageUrl = new URL("relief.webp",document.currentScript.src);
  const byKind = Object.create(null);
  let places = [];
  function unpack(data) {
    if (places.length || !data) return;
    for(const [type,id,name,detail,packed] of data.features) {
      const points=[];
      let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
      for(let i=0;i<packed.length;i+=2) {
        const [x,y]=project(data.origin[1]+packed[i+1]/data.scale,data.origin[0]+packed[i]/data.scale);
        points.push([x,y]);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);
      }
      (byKind[type]??=[]).push({id,name,detail,points,left,top,right,bottom});
    }
    places=data.places.map(([kind,name,x,y])=>({kind,name,point:project(data.origin[1]+y/data.scale,data.origin[0]+x/data.scale)}));
  }
  const template = document.createElement("template");
  template.innerHTML =
    '<canvas class="geo-surface" tabindex="0" aria-label="区域基础设施地图，方向键平移，加减键缩放，回车选取中心为场址"></canvas>'+
    '<div class="geo-scale"><span></span><div class="geo-scale-line"></div></div>'+
    '<details class="geo-credits"><summary>© OpenStreetMap contributors · 地形</summary><div class="geo-credit-body">'+
    '<p>区域底图与设施摘自 <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>。提取于 2026-11-23，设施位置以社区记录为准。</p>'+
    '<p><a class="geo-data-link" download="gridatlas-osm-region.js">下载区域数据（ODbL 1.0）</a> · <a class="geo-original" target="_blank" rel="noopener">在 OpenInfraMap 查看</a></p>'+
    '<p>地形阴影依据 <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a> 绘制，SRTM、GMTED2010 来源于 USGS。<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">地形署名</a></p></div></details>'+
    '<div class="geo-outside" hidden>此处超出本地底图范围。<a href="#world">查看全球地图</a></div>';
  function mount(container,{lat=home.lat,lon=home.lon,onPick=()=>{}}={}) {
    const data=window.GridMapData;
    unpack(data);
    const start=sanePoint(lat,lon)?{lat,lon}:home;
    let marker=project(start.lat,start.lon), center=[...marker], zoom=initialZoom, comparison=null;
    let width=1,height=1,world=1,raf=0,activeTouches=new Map(),gesture=null,moved=false;
    const visible={lines:true,substations:true,plants:true};
    container.classList.add("grid-geo");
    container.replaceChildren(template.content.cloneNode(true));
    const canvas=container.querySelector("canvas"),ctx=canvas.getContext("2d");
    const scaleBar=container.querySelector(".geo-scale-line"),scaleText=container.querySelector(".geo-scale span");
    const outside=container.querySelector(".geo-outside"),original=container.querySelector(".geo-original");
    container.querySelector(".geo-data-link").href=geoFile;
    const relief=new Image();
    relief.onload=schedule;
    relief.src=imageUrl;
    const bounds=data?.bounds ?? [109.56,39.025,110.13,39.425];
    const nw=project(bounds[3],bounds[0]), se=project(bounds[1],bounds[2]);
    function screen(point){return [(point[0]-center[0])*world+width/2,(point[1]-center[1])*world+height/2]}
    function atPixel(x,y){return [clamp(center[0]+(x-width/2)/world,0,1),clamp(center[1]+(y-height/2)/world,0,1)]}
    function schedule(){if(!raf)raf=requestAnimationFrame(draw)}
    function geoPath(feature){
      ctx.beginPath();
      const p=screen(feature.points[0]);ctx.moveTo(p[0],p[1]);
      for(let i=1;i<feature.points.length;i++){const point=screen(feature.points[i]);ctx.lineTo(point[0],point[1])}
    }
    function draw(){
      raf=0;
      width=container.clientWidth;height=container.clientHeight;
      if(!width||!height)return;
      const ratio=Math.min(window.devicePixelRatio||1,2);
      if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){
        canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
      }
      ctx.setTransform(ratio,0,0,ratio,0,0);
      world=256*2**zoom;
      const [minX,minY]=atPixel(-12,-12),[maxX,maxY]=atPixel(width+12,height+12);
      const show = (f)=>f.right>=minX&&f.left<=maxX&&f.bottom>=minY&&f.top<=maxY;
      const items = (kind)=>(byKind[kind]||[]).filter(show);
      const [left,top]=screen(nw),[right,bottom]=screen(se);
      const inside = center[0]>=nw[0]&&center[0]<=se[0]&&center[1]>=nw[1]&&center[1]<=se[1];
      outside.hidden=Boolean(data)&&inside;
      ctx.fillStyle="#182b3b";ctx.fillRect(0,0,width,height);
      if(!data)outside.firstChild.textContent="本地底图未加载。";
      ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
      if(relief.complete&&relief.naturalWidth&&data) {
        const tile=data.terrain,denom=2**tile.z;
        const [x,y]=screen([tile.x/denom,tile.y/denom]);ctx.drawImage(relief,x,y,(world*tile.cols)/denom,(world*tile.rows)/denom);
      }
      ctx.lineCap="round";ctx.lineJoin="round";
      for(const [k,color] of Object.entries(fills)){
        ctx.fillStyle=color;for(const f of items(k)){geoPath(f);ctx.fill()}
      }
      for(const [k,[color,lineWidth]] of Object.entries(strokes)){
        if((k==="service"||k==="road")&&zoom<10.75)continue;
        ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.setLineDash(k==="rail"?[3,2]:[]);
        for(const f of items(k)){geoPath(f);ctx.stroke()}
      }
      ctx.setLineDash([]);
      if(visible.lines)for(const f of items("line")){
        const high=Number(f.detail.split(";")[0])>=220000;
        geoPath(f);ctx.strokeStyle="#20291fc9";ctx.lineWidth=high?3.4:2.6;ctx.stroke();
        ctx.strokeStyle=high?"#eabb67":"#cf9c52";ctx.lineWidth=high?1.65:1.12;ctx.stroke();
      }
      const labels=[];
      function symbol(feature,kind){
        const [x,y]=screen([(feature.left+feature.right)/2,(feature.top+feature.bottom)/2]);
        const isSub=kind==="substation",small=kind==="generator";
        const color=isSub?"#c8a2f5":"#62ceb1";
        if(feature.points.length>2){
          geoPath(feature);ctx.fillStyle=isSub?"#ad82d277":"#49a58d65";ctx.fill();
          ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
        }
        const radius=small?2.2:3.8;ctx.fillStyle=color;ctx.strokeStyle="#162b34";ctx.lineWidth=1.25;
        ctx.beginPath();
        if(isSub){ctx.rect(x-radius,y-radius,2*radius,2*radius)}
        else{ctx.arc(x,y,radius,0,Math.PI*2)}
        ctx.fill();ctx.stroke();
        if(kind==="plant"&&feature.name) {
          const title=feature.name==="鄂尔多斯市宝恒煤焦电有限责任公司"?"宝恒煤焦电":feature.name;
          labels.push({text:title,x:x+7,y:y-9,color:"#a3d8c4",size:11});
        }
      }
      if(visible.plants){
        for(const f of items("generator"))symbol(f,"generator");
        for(const f of items("plant"))symbol(f,"plant");
      }
      if(visible.substations)for(const f of items("substation"))symbol(f,"substation");
      const [px,py]=screen(marker);
      const occupied=[[px-15,py-28,px+91,py+12],[0,0,200,44],[width-48,height/2-57,width,height/2+57]];
      function drawLabel({text,x,y,color,size},halo=true){
        ctx.font=(size>=13?"600 ":"500 ")+size+'px "PingFang SC","Microsoft YaHei",sans-serif';
        const tw=ctx.measureText(text).width, box=[x-3,y-size,x+tw+3,y+4];
        if(box[0]<2||box[1]<3||box[2]>width-2||box[3]>height-14)return;
        if(occupied.some(b=>box[0]<b[2]&&box[2]>b[0]&&box[1]<b[3]&&box[3]>b[1]))return;
        occupied.push(box);ctx.textAlign="left";ctx.textBaseline="alphabetic";
        if(halo){ctx.strokeStyle="#172930e8";ctx.lineWidth=3.5;ctx.strokeText(text,x,y)}
        ctx.fillStyle=color;ctx.fillText(text,x,y);
      }
      for(const place of places){
        const [x,y]=screen(place.point);const isTown=place.kind==="town";
        drawLabel({text:place.name,x,y,color:isTown?"#d8e1e5":"#bacad0",size:isTown?14:12});
      }
      labels.forEach(label=>drawLabel(label));
      const seen=new Set();
      for(const k of ["motorway","highway","rail"]){
        for(const f of items(k)){
          const name=f.detail||f.name;if(!name||seen.has(name))continue;
          const p=f.points[Math.floor(f.points.length/2)], [x,y]=screen(p);
          if(x<35||x>width-55||y<50||y>height-40)continue;
          drawLabel({text:name,x,y:y-4,color:"#a4b9c5",size:11});seen.add(name);
        }
      }
      ctx.restore();
      if(comparison){
        ctx.save();ctx.setLineDash([6,4]);ctx.lineJoin="round";
        ctx.beginPath();comparison.path.forEach((point,i)=>{const [x,y]=screen(point);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});
        ctx.lineWidth=2.7;ctx.strokeStyle="#b7faf0";ctx.stroke();ctx.setLineDash([]);
        const [sx,sy]=screen(comparison.point);ctx.fillStyle="#b99be7";ctx.strokeStyle="#f5edff";ctx.lineWidth=2;
        ctx.fillRect(sx-5,sy-5,10,10);ctx.strokeRect(sx-5,sy-5,10,10);ctx.textAlign="center";ctx.textBaseline="bottom";
        ctx.font='600 13px "PingFang SC","Microsoft YaHei",sans-serif';ctx.strokeStyle="#192a39";ctx.lineWidth=4;ctx.strokeText("变电站",sx,sy-8);ctx.fillStyle="#efdfff";ctx.fillText("变电站",sx,sy-8);ctx.restore();
      }
      const [mx,my]=screen(marker);
      if(mx>=-15&&mx<width+15&&my>=-15&&my<=height+15) {
        ctx.beginPath();ctx.arc(mx,my,17,0,Math.PI*2);ctx.fillStyle="#59e3cb20";ctx.fill();ctx.strokeStyle="#67dfc77a";ctx.lineWidth=1;ctx.stroke();
        ctx.beginPath();ctx.arc(mx,my,7.3,0,Math.PI*2);ctx.fillStyle="#69e5ce";ctx.fill();ctx.strokeStyle="#e9fff9";ctx.lineWidth=1.8;ctx.stroke();
        ctx.beginPath();ctx.arc(mx,my,2.5,0,Math.PI*2);ctx.fillStyle="#174941";ctx.fill();
        const tagW=69, x=mx+tagW+17<width?mx+15:mx-15-tagW,y=my-13;
        ctx.fillStyle="#132f37f0";ctx.strokeStyle="#4f9c93";ctx.lineWidth=1;
        ctx.beginPath();ctx.roundRect(x,y,tagW,25,5);ctx.fill();ctx.stroke();
        ctx.fillStyle="#bbf6e8";ctx.font='600 12px "PingFang SC","Microsoft YaHei",sans-serif';ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("候选场址",x+tagW/2,y+12.5);
      }
      const geographic=unproject(...center),resolution=earthCircumference*Math.cos(geographic.lat*radians)/world;
      const target=resolution*70,base=10**Math.floor(Math.log10(target)),step=[5,2,1].find(n=>n*base<=target)||1,metres=step*base;
      scaleText.textContent=metres>=1000?(metres/1000)+" km":Math.round(metres)+" m";scaleBar.style.width=(metres/resolution)+"px";
      const selected=unproject(...marker);
      original.href="https://openinframap.org/#"+zoom.toFixed(2)+"/"+selected.lat.toFixed(5)+"/"+selected.lon.toFixed(5)+"/A,B,L,P,T";
    }
    function fitPair(){
      if(!comparison)return;
      const other=comparison.point;
      const dx=Math.max(Math.abs(marker[0]-other[0]),1e-12),dy=Math.max(Math.abs(marker[1]-other[1]),1e-12);
      const scale=Math.min(Math.max(80,container.clientWidth-144)/dx,Math.max(70,container.clientHeight-98)/dy);
      zoom=clamp(Math.log2(scale/256),9,15.5);world=256*2**zoom;
      center=[(marker[0]+other[0])/2,(marker[1]+other[1])/2];schedule();
    }
    function selectPoint(point){
      if(comparison)return;
      marker=point;const loc=unproject(...point);
      onPick(Number(loc.lat.toFixed(5)),Number(loc.lon.toFixed(5)));schedule();
    }
    function zoomTo(target,x=width/2,y=height/2){
      const anchor=atPixel(x,y);zoom=clamp(target,9,17);world=256*2**zoom;
      center=[clamp(anchor[0]-(x-width/2)/world,0,1),clamp(anchor[1]-(y-height/2)/world,0,1)];
      schedule();
    }
    function cursor(e){const rect=canvas.getBoundingClientRect();return [e.clientX-rect.left,e.clientY-rect.top]}
    function snapshot(){
      const points=[...activeTouches.values()];
      if(!points.length){gesture=null;return}
      const a=points[0],b=points[1]||a;
      const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
      gesture={mid,anchor:atPixel(...mid),zoom,spread:Math.hypot(a[0]-b[0],a[1]-b[1])};
    }
    canvas.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      canvas.setPointerCapture(e.pointerId);if(!activeTouches.size)moved=false;else moved=true;
      activeTouches.set(e.pointerId,cursor(e));snapshot();
    });
    canvas.addEventListener("pointermove",e=>{
      if(!activeTouches.has(e.pointerId)||!gesture)return;
      activeTouches.set(e.pointerId,cursor(e));
      const points=[...activeTouches.values()],a=points[0],b=points[1]||a;
      const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
      if(!moved&&Math.hypot(x-gesture.mid[0],y-gesture.mid[1])<4)return;
      moved=true;canvas.classList.add("dragging");
      if(points.length>1&&gesture.spread>0){
        const ratio=Math.hypot(a[0]-b[0],a[1]-b[1])/gesture.spread;
        zoom=clamp(gesture.zoom+Math.log2(Math.max(ratio,.01)),9,17);world=256*2**zoom;
      }
      center=[clamp(gesture.anchor[0]-(x-width/2)/world,0,1),clamp(gesture.anchor[1]-(y-height/2)/world,0,1)];schedule();
    });
    function release(e){
      if(!activeTouches.has(e.pointerId))return;
      if(!moved&&activeTouches.size===1&&e.type==="pointerup")selectPoint(atPixel(...cursor(e)));
      activeTouches.delete(e.pointerId);snapshot();
      if(!activeTouches.size)canvas.classList.remove("dragging");
    }
    canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
    canvas.addEventListener("wheel",e=>{e.preventDefault();zoomTo(zoom-Math.sign(e.deltaY)*.35,...cursor(e))},{passive:false});
    canvas.addEventListener("keydown",e=>{
      const delta={ArrowLeft:[-45,0],ArrowRight:[45,0],ArrowUp:[0,-45],ArrowDown:[0,45]}[e.key];
      if(delta)center=atPixel(width/2+delta[0],height/2+delta[1]);
      else if(e.key==="+"||e.key==="=")zoomTo(zoom+1);
      else if(e.key==="-")zoomTo(zoom-1);
      else if(e.key==="Enter")selectPoint([...center]);
      else return;
      e.preventDefault();schedule();
    });
    const observer=new ResizeObserver(schedule);observer.observe(container);draw();
    return {
      showPair(station,path){
        comparison={point:project(station.lat,station.lon),path:path.map(([x,y])=>project(y,x))};
        canvas.setAttribute("aria-label","候选场址与变电站位置对照图，方向键平移，加减键缩放");canvas.style.cursor="grab";fitPair();
      },
      fitPair,
      setLocation(newLat,newLon){if(!sanePoint(newLat,newLon))return;marker=project(newLat,newLon);center=[...marker];schedule()},
      setLayer(key,enabled){if(Object.hasOwn(visible,key)){visible[key]=Boolean(enabled);schedule()}},
      zoomBy(delta){if(Number.isFinite(delta))zoomTo(zoom+delta)},
      reset(){zoom=initialZoom;center=[...marker];schedule()},
      resize:schedule,
      destroy(){observer.disconnect();cancelAnimationFrame(raf);container.replaceChildren()}
    };
  }
  window.GridMap={mount};
})();
