(() => {
  'use strict';
  const RAD=Math.PI/180, MAX_LAT=85.05112878;
  const zhongwei=[104.64,37.20,105.95,37.82];
  const url=new URL('territory-zhongwei.json',document.currentScript.src);
  let loaded, pending;
  function project(lat,lon) {
    const clipped=Math.max(-MAX_LAT,Math.min(MAX_LAT,lat));
    return [(lon+180)/360,(1-Math.asinh(Math.tan(clipped*RAD))/Math.PI)/2];
  }
  function unproject(x,y) {
    return {lon:((x%1+1)%1)*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*Math.max(0,Math.min(1,y)))))/RAD};
  }
  const overlap=(a,b)=>a[2]>=b[0]&&a[0]<=b[2]&&a[3]>=b[1]&&a[1]<=b[3];
  const inBox=(p,b)=>p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3];
  function inRing(p,ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const a=ring[i],b=ring[j];
      if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }
  function crossesBox(a,b,box) {
    let t0=0,t1=1;
    for(let k=0;k<2;k++){
      const delta=b[k]-a[k];
      if(!delta){if(a[k]<box[k]||a[k]>box[k+2])return false;continue;}
      const u=(box[k]-a[k])/delta,v=(box[k+2]-a[k])/delta;
      t0=Math.max(t0,Math.min(u,v));t1=Math.min(t1,Math.max(u,v));
    }
    return t0<=t1;
  }
  // Geofabrik clips its province extract to a non-rectangular outline.
  function covers(data,box) {
    if(!data || !inBox([box[0],box[1]],data.bounds) || !inBox([box[2],box[3]],data.bounds))return false;
    if(!data.coverage)return true;
    const mid=[(box[0]+box[2])/2,(box[1]+box[3])/2];
    return data.coverage.some(poly=>inRing(mid,poly[0])&&!poly.slice(1).some(ring=>inRing(mid,ring))&&
      poly.every(ring=>!ring.some((p,i)=>i&&crossesBox(p,ring[i-1],box))));
  }
  // Measure inclusion of the query circle itself. A province boundary may cut a corner
  // of its enclosing box without entering the search radius. Spherical haversine distance
  // is bounded below by this linear metric inside the box (sin(a)/a accounts for curvature).
  function coversRadius(data,box,lat,lon,radiusKm) {
    if(!data?.coverage)return covers(data,box);
    if(!inBox([box[0],box[1]],data.bounds)||!inBox([box[2],box[3]],data.bounds))return false;
    const maxAngle=Math.max(box[2]-box[0],box[3]-box[1])*RAD/2;
    const kmPerDegree=6371.0088*RAD*(maxAngle?Math.sin(maxAngle)/maxAngle:1);
    const east=kmPerDegree*Math.cos(Math.max(Math.abs(box[1]),Math.abs(box[3]))*RAD);
    function touches(a,b){
      if(!crossesBox(a,b,box))return false;
      const ax=(a[0]-lon)*east,ay=(a[1]-lat)*kmPerDegree;
      const dx=(b[0]-a[0])*east,dy=(b[1]-a[1])*kmPerDegree;
      const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(ax+t*dx,ay+t*dy)<=radiusKm;
    }
    const center=[lon,lat];
    return data.coverage.some(poly=>inRing(center,poly[0])&&!poly.slice(1).some(r=>inRing(center,r))&&
      poly.every(r=>!r.some((p,i)=>i&&touches(p,r[i-1]))));
  }
  async function loadRegion(bounds) {
    if(!overlap(bounds,zhongwei))return null;
    if(loaded)return loaded;
    if(!pending)pending=fetch(url).then(r=>{if(!r.ok)throw new Error('region');return r.json();}).then(data=>{
      if(!Array.isArray(data.features)||!Array.isArray(data.coverage))throw new Error('region');
      loaded=data;return data;
    }).catch(()=>null).finally(()=>{pending=null;});
    return pending;
  }
  const packed=new WeakMap();
  function unpack(data) {
    if(packed.has(data))return packed.get(data);
    const paths=[],places=[];
    const at=(x,y)=>project(data.origin[1]+y/data.scale,data.origin[0]+x/data.scale);
    for(const [kind,id,name,info,xy] of data.features){
      const points=[],box=[Infinity,Infinity,-Infinity,-Infinity];
      for(let i=0;i+1<xy.length;i+=2){
        const p=at(xy[i],xy[i+1]);points.push(p);
        for(let k=0;k<2;k++){box[k]=Math.min(box[k],p[k]);box[k+2]=Math.max(box[k+2],p[k]);}
      }
      if(points.length)paths.push({kind,id,name,info,points,box});
    }
    for(const [kind,name,x,y] of data.places)places.push({kind,name,point:at(x,y)});
    const result={paths,places};packed.set(data,result);return result;
  }
  window.GridTerritoryGeo={project,unproject,overlap,covers,coversRadius,unpack,loadRegion,zhongwei,url};
})();
