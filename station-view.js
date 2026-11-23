(()=> {
  "use strict";
  const ownUrl=document.currentScript.src;
  const degrees=Math.PI/180;
  let active=null;
  // Spherical interpolation. Keep successive longitudes on the same world copy around the date line.
  function arc(a,b){
    const vector=p=>[Math.cos(p.lat*degrees)*Math.cos(p.lon*degrees),Math.cos(p.lat*degrees)*Math.sin(p.lon*degrees),Math.sin(p.lat*degrees)];
    const u=vector(a),v=vector(b),angle=Math.acos(Math.max(-1,Math.min(1,u.reduce((n,x,i)=>n+x*v[i],0))));
    const sine=Math.sin(angle),out=[];let last=a.lon;
    for(let i=0;i<=24;i++){
      const t=i/24,s=sine>1e-8?Math.sin((1-t)*angle)/sine:1-t,e=sine>1e-8?Math.sin(t*angle)/sine:t;
      const p=u.map((x,k)=>s*x+e*v[k]);
      let lon=Math.atan2(p[1],p[0])/degrees;
      lon+=360*Math.round((last-lon)/360);last=lon;
      out.push([lon,Math.atan2(p[2],Math.hypot(p[0],p[1]))/degrees]);
    }
    return out;
  }
  function point(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85.05&&Math.abs(p.lon)<=180}
  function text(tag,value,cls){const n=document.createElement(tag);if(value)n.textContent=value;if(cls)n.className=cls;return n}
  function button(value,callback){const n=text("button",value);n.type="button";n.onclick=callback;return n}
  function urlFor(raw){
    try{const u=new URL(raw);return u.protocol==="https:"?u.href:""}catch{return ""}
  }
  function link(value,url){const a=text("a",value);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a}
  function coordinate(p){return p.lat.toFixed(5)+", "+p.lon.toFixed(5)}
  function open(site,station){
    if(!point(site)||!point(station))return;
    if(active)active.close();
    const previous=document.activeElement;
    const dialog=text("dialog","","station-dialog");active=dialog;dialog.setAttribute("aria-labelledby","station-view-title");
    const head=text("div","","station-heading"),title=text("h2",station.name||"未标注站名的变电站");title.id="station-view-title";
    const close=button("关闭",()=>dialog.close());
    head.append(title,close);
    const span=station.distanceKm;
    const distance=Number.isFinite(span)?(span<1?Math.round(span*1000)+" m":span.toFixed(2)+" km"):"未提供";
    const info=text("p","场址至变电站直线距离 "+distance+(station.voltage?" · "+station.voltage:""),"station-caption");
    const area=text("div","","station-area"),tools=text("div","","station-actions"),legend=text("div","","station-legend");
    const loc=text("span","候选场址 · "+coordinate(site)),sub=text("span","变电站 · "+coordinate(station));legend.append(loc,sub);
    const url=urlFor(station.url);
    tools.append(url?link("查看设施原始记录",url):link("在原图查看变电站","https://openinframap.org/#15/"+station.lat.toFixed(5)+"/"+station.lon.toFixed(5)+"/P"));
    dialog.append(head,info,area,legend,tools);document.body.append(dialog);dialog.showModal();
    let runtime=null;
    const bounds=window.GridMapData?.bounds;
    const local=p=>bounds&&p.lon>=bounds[0]&&p.lon<=bounds[2]&&p.lat>=bounds[1]&&p.lat<=bounds[3];
    if(local(site)&&local(station)&&window.GridMap){
      const canvas=text("div","","station-local");area.append(canvas);
      runtime=window.GridMap.mount(canvas,{lat:site.lat,lon:site.lon});
      runtime.showPair(station,arc(site,station));
      tools.prepend(button("显示两点",()=>runtime.fitPair()),button("放大",()=>runtime.zoomBy(1)),button("缩小",()=>runtime.zoomBy(-1)));
    }else{
      const frame=document.createElement("iframe");const mapURL=new URL("world/index.html",ownUrl);
      mapURL.search=new URLSearchParams({pair:"1",lat:site.lat,lon:site.lon,stationLat:station.lat,stationLon:station.lon}).toString();
      frame.src=mapURL;frame.title="候选场址与变电站的全球基础设施地图";area.append(frame);
      tools.prepend(button("显示两点",()=>frame.contentWindow?.postMessage({type:"gridatlas-fit-pair"},location.origin)));
    }
    dialog.addEventListener("click",e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close()}});
    dialog.addEventListener("close",()=>{runtime?.destroy();dialog.remove();if(active===dialog){active=null;if(previous?.isConnected)previous.focus()}},{once:true});
    close.focus();
  }
  window.GridStationView={open,arc};
})();
