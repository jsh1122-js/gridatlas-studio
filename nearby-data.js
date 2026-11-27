(() => {
'use strict';
/* Nearby substations in the packaged OSM extract or in Open Infrastructure Map's worldwide vector tiles.
 * The same spherical distance ranks point-mapped stations and representative station centroids.
 * The upstream power_substation_point layer includes all mapped voltages at zoom 10 and above:
 * https://github.com/openinframap/openinframap/blob/780e6b96d9d465d9e8cd751db7ebcfc80230bfd6/tegola/layers.yml
 */
const EARTH = 6371.0088, RAD = Math.PI/180, ZOOM = 10, N = 2**ZOOM;
const MERCATOR_MAX = Math.atan(Math.sinh(Math.PI))/RAD;
const tileCache = new Map(), inflight = new Map();
const cacheLifetime = 6*60*60*1000;
const isTrue = v=>v===true||v===1||v==='true';
const fixed = (n,d)=>Number(n.toFixed(d));
const osmSource = 'OpenStreetMap 区域快照';
const worldSource = 'OpenInfraMap 全球电力瓦片';
let localMemoData, localMemoRows=[];
function distance(lat1,lon1,lat2,lon2) {
  const p=(lat2-lat1)*RAD/2, l=(lon2-lon1)*RAD/2;
  const h=Math.sin(p)**2+Math.cos(lat1*RAD)*Math.cos(lat2*RAD)*Math.sin(l)**2;
  return 2*EARTH*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}
function yMerc(lat) {return Math.asinh(Math.tan(lat*RAD));}
function latMerc(y){return Math.atan(Math.sinh(y))/RAD;}
function boundsOfCircle(lat,lon,radius) {
  const angle=radius/EARTH;
  const north=Math.min(90,lat+angle/RAD),south=Math.max(-90,lat-angle/RAD);
  const longitudeDelta=(north===90||south===-90)?180:Math.asin(Math.min(1,Math.sin(angle)/Math.cos(lat*RAD)))/RAD;
  return {south,north,west:lon-longitudeDelta,east:lon+longitudeDelta};
}
function localRepresentative(coords,data){
  const points=[];
  for(let i=0;i+1<coords.length;i+=2)points.push([data.origin[0]+coords[i]/data.scale,data.origin[1]+coords[i+1]/data.scale]);
  if(!points.length)return null;
  if(points.length===1)return points[0];
  const [ox,lat0]=points[0],oy=yMerc(lat0);
  const xy=points.map(([lon,lat])=>[(lon-ox)*RAD,yMerc(lat)-oy]);
  let area2=0,mx=0,my=0;
  for(let i=0,j=xy.length-1;i<xy.length;j=i++){
    const [x1,y1]=xy[j],[x2,y2]=xy[i],c=x1*y2-x2*y1;
    area2+=c;mx+=(x1+x2)*c;my+=(y1+y2)*c;
  }
  if(Math.abs(area2)>1e-17)return [ox+mx/(3*area2*RAD),latMerc(oy+my/(3*area2))];
  return [points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length];
}
function kv(values,divisor){
  const nums=[...new Set(values.map(Number).filter(n=>Number.isFinite(n)&&n>0).map(n=>fixed(n/divisor,4)))].sort((a,b)=>b-a);
  return nums.length?nums.join(' / ')+' kV':'';
}
function objectRow(type,number,point,name,voltage,lifecycle=''){
  const id=type+'/'+Math.abs(number);
  return {id,type,osmType:type,osmId:Math.abs(number),name:String(name||''),lat:point[1],lon:point[0],voltage,lifecycle,
    url:'https://www.openstreetmap.org/'+id};
}
function localRows(data) {
  if(localMemoData===data)return localMemoRows;
  localMemoRows=[];
  if(data)for(const [kind,raw,name,voltage,coordinates] of data.features){
    if(kind!=='substation'||!/^([nwr])(\d+)$/.test(raw))continue;
    const point=localRepresentative(coordinates,data);
    if(point)localMemoRows.push(objectRow({n:'node',w:'way',r:'relation'}[raw[0]],Number(raw.slice(1)),point,name,kv(String(voltage||'').split(';'),1000)));
  }
  localMemoData=data;return localMemoRows;
}
function decode(bytes,x,y){
  if(!bytes.byteLength)return [];
  const tile=new MVT.VectorTile(new MVT.PbfReader(new Uint8Array(bytes))),layer=tile.layers.power_substation_point;
  if(!layer)return [];
  const rows=[];
  for(let i=0;i<layer.length;i++){
    const feature=layer.feature(i),p=feature.properties,raw=Number(p.osm_id);
    if(!Number.isSafeInteger(raw)||raw===0)throw new Error('上游站点缺少可识别的 OSM 标识');
    const geom=feature.toGeoJSON(x,y,ZOOM).geometry;
    if(geom.type!=='Point'||!geom.coordinates.every(Number.isFinite))throw new Error('站点代表点数据异常');
    const type=raw<0?'relation':isTrue(p.is_node)?'node':'way';
    const volts=kv([p.voltage,p.voltage_2,p.voltage_3,p.voltage_4],1);
    rows.push(objectRow(type,raw,geom.coordinates,p.name_zh||p.name||p.name_en,volts,isTrue(p.disused)?'停用':isTrue(p.construction)?'在建':''));
  }
  return rows;
}
function tilesOf(bounds,lat,lon) {
  const xOf=v=>Math.floor((v+180)/360*N);
  const yOf=v=>Math.max(0,Math.min(N-1,Math.floor((1-yMerc(Math.max(-MERCATOR_MAX,Math.min(MERCATOR_MAX,v)))/Math.PI)/2*N)));
  const out=new Map();
  if(bounds.north < -MERCATOR_MAX||bounds.south > MERCATOR_MAX)return [];
  for(let x=xOf(bounds.west);x<=xOf(bounds.east);x++){
    const wx=(x%N+N)%N;
    for(let y=yOf(bounds.north);y<=yOf(bounds.south);y++){
      const midLat=latMerc(Math.PI*(1-2*(y+.5)/N)), midLon=(wx+.5)/N*360-180;
      const id=wx+'/'+y;out.set(id,{id,x:wx,y,order:distance(lat,lon,midLat,midLon)});
    }
  }
  return [...out.values()].sort((a,b)=>a.order-b.order);
}
function abortError(){return new DOMException('已取消查询','AbortError');}
function checkSignal(signal){if(signal?.aborted)throw abortError();}
function requestTile(tile,signal){
  checkSignal(signal);
  const previous=tileCache.get(tile.id);
  if(previous&&Date.now()-previous.at<cacheLifetime){tileCache.delete(tile.id);tileCache.set(tile.id,previous);return Promise.resolve(previous.rows);}
  let job=inflight.get(tile.id);
  if(!job){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8000);
    job={controller,subscribers:0,done:false};inflight.set(tile.id,job);
    const current=job;
    job.task=(async()=>{
      try{
        const url='https://openinframap.org/map/power/'+ZOOM+'/'+tile.id+'.pbf';
        const r=await fetch(url,{signal:controller.signal});
        if(!r.ok)throw new Error('地图服务 HTTP '+r.status);
        let rows=[];
        if(r.status!==204){
          const type=r.headers.get('content-type')||'';
          if(!/vector-tile|protobuf|octet-stream/i.test(type))throw new Error('地图服务返回了非瓦片内容');
          rows=decode(await r.arrayBuffer(),tile.x,tile.y);
        }
        tileCache.set(tile.id,{at:Date.now(),rows});if(tileCache.size>256)tileCache.delete(tileCache.keys().next().value);
        return rows;
      } finally{clearTimeout(timeout);current.done=true;if(inflight.get(tile.id)===current)inflight.delete(tile.id);}
    })();
  }
  job.subscribers++;
  const current=job;
  return new Promise((resolve,reject)=>{
    let ended=false;
    const end=(fn,value)=>{
      if(ended)return;ended=true;signal?.removeEventListener('abort',cancel);current.subscribers--;
      if(!current.done&&!current.subscribers){if(inflight.get(tile.id)===current)inflight.delete(tile.id);current.controller.abort();}
      fn(value);
    };
    const cancel=()=>end(reject,abortError());
    signal?.addEventListener('abort',cancel,{once:true});
    current.task.then(rows=>end(resolve,rows),err=>end(reject,err));if(signal?.aborted)cancel();
  });
}
function rank(items,lat,lon,radius,limit){
  const dedup=new Map();
  for(const row of items)if(!dedup.has(row.id)){
    const distanceKm=distance(lat,lon,row.lat,row.lon);if(distanceKm<=radius)dedup.set(row.id,{...row,distanceKm});
  }
  const ranked=[...dedup.values()].sort((a,b)=>a.distanceKm-b.distanceKm||a.id.localeCompare(b.id));
  return {rows:ranked.slice(0,limit),totalMatched:ranked.length};
}
async function find(lat,lon,{radiusKm=15,limit=1000,signal}={}){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new RangeError('场址经纬度超出范围');
  if(!Number.isFinite(radiusKm)||radiusKm<=0||radiusKm>30)throw new RangeError('查询半径须大于 0 且不超过 30 km');
  if(!Number.isSafeInteger(limit)||limit<1)throw new RangeError('返回数量须为正整数');
  checkSignal(signal);
  const bounds=boundsOfCircle(lat,lon,radiusKm),box=[bounds.west,bounds.south,bounds.east,bounds.north];
  const geo=window.GridTerritoryGeo,regional=geo?await geo.loadRegion(box):null;
  checkSignal(signal);
  const data=regional||window.GridMapData,b=data?.bounds;
  const touchesLocal=b&&bounds.east>=b[0]&&bounds.west<=b[2]&&bounds.north>=b[1]&&bounds.south<=b[3];
  const local=touchesLocal?localRows(data):[];
  const meta={radiusKm,method:'representative',checkedAt:new Date().toISOString()};
  if(b&&bounds.west>=b[0]&&bounds.south>=b[1]&&bounds.east<=b[2]&&bounds.north<=b[3]&&(!data.coverage||geo?.coversRadius(data,box,lat,lon,radiusKm))){
    const result=rank(local,lat,lon,radiusKm,limit);
    return {...meta,...result,source:osmSource,scope:'regional',status:result.totalMatched?'ok':'empty',complete:true,asOf:data.retrieved};
  }
  const tiles=tilesOf(bounds,lat,lon),collected=[],deadline=Date.now()+22000;
  let next=0,ok=0,failed=0;
  async function worker(){
    while(next<tiles.length && Date.now()<deadline){
      checkSignal(signal);const tile=tiles[next++];
      try{const rows=await requestTile(tile,signal);collected.push(...rows);ok++;}
      catch(error){checkSignal(signal);failed++;if(failed>=4&&!ok)return;}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,tiles.length)},worker));checkSignal(signal);
  const complete=ok===tiles.length && tiles.length>0 && bounds.south>=-MERCATOR_MAX && bounds.north<=MERCATOR_MAX;
  const result=rank(complete?collected:[...collected,...local],lat,lon,radiusKm,limit);
  const scope=complete||!touchesLocal?'global':'mixed';
  const status=complete?(result.totalMatched?'ok':'empty'):(ok||result.totalMatched?'partial':'unavailable');
  return {...meta,...result,complete,status,scope,source:scope==='mixed'?worldSource+' / '+osmSource:worldSource,
    asOf:!ok&&result.totalMatched?data?.retrieved:null,tilesRead:ok,tilesRequested:tiles.length};
}
// Coordinates stay in tile space so the cartographic renderer can use the same Mercator origin.
function powerLines(bytes) {
  if(!bytes.byteLength)return [];
  const tile=new MVT.VectorTile(new MVT.PbfReader(new Uint8Array(bytes))),layer=tile.layers.power_line,lines=[];
  if(layer)for(let i=0;i<layer.length;i++){
    const f=layer.feature(i),properties=f.properties;
    if(f.type!==2||isTrue(properties.construction)||isTrue(properties.proposed)||isTrue(properties.disused))continue;
    for(const line of f.loadGeometry())lines.push(line.map(p=>[p.x/layer.extent,p.y/layer.extent]));
  }
  return lines;
}
window.GridNearby={find,distance,powerLines};

/* Bundled vector-tile reader dependencies
@mapbox/vector-tile
Copyright (c) 2024, Mapbox

All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
      and/or other materials provided with the distribution.
    * Neither the name of Mapbox nor the names of its contributors
      may be used to endorse or promote products derived from this software
      without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


@mapbox/point-geometry
Copyright (c) 2024, Mapbox

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.


pbf
Copyright (c) 2026, Mapbox
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of pbf nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

*/
var MVT=(()=>{var V=Object.defineProperty;var k=Object.getOwnPropertyDescriptor;var m=Object.getOwnPropertyNames;var E=Object.prototype.hasOwnProperty;var M=(e,t)=>{for(var i in t)V(e,i,{get:t[i],enumerable:!0})},B=(e,t,i,n)=>{if(t&&typeof t=="object"||typeof t=="function")for(let r of m(t))!E.call(e,r)&&r!==i&&V(e,r,{get:()=>t[r],enumerable:!(n=k(t,r))||n.enumerable});return e};var T=e=>B(V({},"__esModule",{value:!0}),e);var O={};M(O,{PbfReader:()=>g,VectorTile:()=>p});function l(e,t){this.x=e,this.y=t}l.prototype={clone(){return new l(this.x,this.y)},add(e){return this.clone()._add(e)},sub(e){return this.clone()._sub(e)},multByPoint(e){return this.clone()._multByPoint(e)},divByPoint(e){return this.clone()._divByPoint(e)},mult(e){return this.clone()._mult(e)},div(e){return this.clone()._div(e)},rotate(e){return this.clone()._rotate(e)},rotateAround(e,t){return this.clone()._rotateAround(e,t)},matMult(e){return this.clone()._matMult(e)},unit(){return this.clone()._unit()},perp(){return this.clone()._perp()},round(){return this.clone()._round()},mag(){return Math.sqrt(this.x*this.x+this.y*this.y)},equals(e){return this.x===e.x&&this.y===e.y},dist(e){return Math.sqrt(this.distSqr(e))},distSqr(e){let t=e.x-this.x,i=e.y-this.y;return t*t+i*i},angle(){return Math.atan2(this.y,this.x)},angleTo(e){return Math.atan2(this.y-e.y,this.x-e.x)},angleWith(e){return this.angleWithSep(e.x,e.y)},angleWithSep(e,t){return Math.atan2(this.x*t-this.y*e,this.x*e+this.y*t)},_matMult(e){let t=e[0]*this.x+e[1]*this.y,i=e[2]*this.x+e[3]*this.y;return this.x=t,this.y=i,this},_add(e){return this.x+=e.x,this.y+=e.y,this},_sub(e){return this.x-=e.x,this.y-=e.y,this},_mult(e){return this.x*=e,this.y*=e,this},_div(e){return this.x/=e,this.y/=e,this},_multByPoint(e){return this.x*=e.x,this.y*=e.y,this},_divByPoint(e){return this.x/=e.x,this.y/=e.y,this},_unit(){return this._div(this.mag()),this},_perp(){let e=this.y;return this.y=this.x,this.x=-e,this},_rotate(e){let t=Math.cos(e),i=Math.sin(e),n=t*this.x-i*this.y,r=i*this.x+t*this.y;return this.x=n,this.y=r,this},_rotateAround(e,t){let i=Math.cos(e),n=Math.sin(e),r=t.x+i*(this.x-t.x)-n*(this.y-t.y),s=t.y+n*(this.x-t.x)+i*(this.y-t.y);return this.x=r,this.y=s,this},_round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this},constructor:l};l.convert=function(e){if(e instanceof l)return e;if(Array.isArray(e))return new l(+e[0],+e[1]);if(e.x!==void 0&&e.y!==void 0)return new l(+e.x,+e.y);throw new Error("Expected [x, y] or {x, y} point format")};var y=class{constructor(t,i,n,r,s){for(this.properties=Object.create(null),this.extent=n,this.type=0,this.id=void 0,this._pbf=t,this._geometry=-1,this._keys=r,this._values=s;t.pos<i;){let h=t.readVarint();if(h===8)this.id=t.readVarint();else if(h===18){let o=t.readVarint()+t.pos;for(;t.pos<o;){let d=r[t.readVarint()],u=s[t.readVarint()];this.properties[d]=u}}else h===24?this.type=t.readVarint():(h===34&&(this._geometry=t.pos),t.skip(h))}}loadGeometry(){if(this._geometry<0)throw new Error("feature has no geometry");let t=this._pbf;t.pos=this._geometry;let i=t.readVarint()+t.pos,n=[],r,s=1,h=0,o=0,d=0;for(;t.pos<i;){if(h<=0){let u=t.readVarint();if(s=u&7,h=u>>3,h===0)continue}if(h--,s===1)o+=t.readSVarint(),d+=t.readSVarint(),r&&n.push(r),r=[new l(o,d)];else if(s===2)o+=t.readSVarint(),d+=t.readSVarint(),r&&r.push(new l(o,d));else if(s===7)r&&r.push(r[0].clone());else throw new Error(`unknown command ${s}`)}return r&&n.push(r),n}bbox(){if(this._geometry<0)throw new Error("feature has no geometry");let t=this._pbf;t.pos=this._geometry;let i=t.readVarint()+t.pos,n=1,r=0,s=0,h=0,o=1/0,d=-1/0,u=1/0,x=-1/0;for(;t.pos<i;){if(r<=0){let w=t.readVarint();if(n=w&7,r=w>>3,r===0)continue}if(r--,n===1||n===2)s+=t.readSVarint(),h+=t.readSVarint(),s<o&&(o=s),s>d&&(d=s),h<u&&(u=h),h>x&&(x=h);else if(n!==7)throw new Error(`unknown command ${n}`)}return[o,u,d,x]}toGeoJSON(t,i,n){let r=this.extent*Math.pow(2,n),s=this.extent*t,h=this.extent*i,o=this.loadGeometry();function d(a){return[(a.x+s)*360/r-180,360/Math.PI*Math.atan(Math.exp((1-(a.y+h)*2/r)*Math.PI))-90]}function u(a){return a.map(d)}let x;if(this.type===1){let a=[];for(let F of o)a.push(F[0]);let c=u(a);x=a.length===1?{type:"Point",coordinates:c[0]}:{type:"MultiPoint",coordinates:c}}else if(this.type===2){let a=o.map(u);x=a.length===1?{type:"LineString",coordinates:a[0]}:{type:"MultiLineString",coordinates:a}}else if(this.type===3){let a=D(o),c=[];for(let F of a)c.push(F.map(u));x=c.length===1?{type:"Polygon",coordinates:c[0]}:{type:"MultiPolygon",coordinates:c}}else throw new Error("unknown feature type");let w={type:"Feature",geometry:x,properties:this.properties};return this.id!=null&&(w.id=this.id),w}};y.types=["Unknown","Point","LineString","Polygon"];function D(e){let t=e.length;if(t<=1)return[e];let i=[],n,r;for(let s=0;s<t;s++){let h=I(e[s]);h!==0&&(r===void 0&&(r=h<0),r===h<0?(n&&i.push(n),n=[e[s]]):n&&n.push(e[s]))}return n&&i.push(n),i}function I(e){let t=0;for(let i=0,n=e.length,r=n-1,s,h;i<n;r=i++)s=e[i],h=e[r],t+=(h.x-s.x)*(s.y+h.y);return t}var _=class{constructor(t,i){for(this.version=1,this.name="",this.extent=4096,this.length=0,this._pbf=t,this._keys=[],this._values=[],this._features=[],i===void 0&&(i=t.length);t.pos<i;){let n=t.readVarint();n===10?this.name=t.readString():n===18?(this._features.push(t.pos),t.skip(n)):n===26?this._keys.push(t.readString()):n===34?this._values.push(A(t)):n===40?this.extent=t.readVarint():n===120?this.version=t.readVarint():t.skip(n)}this.length=this._features.length}feature(t){if(t<0||t>=this._features.length)throw new Error("feature index out of bounds");this._pbf.pos=this._features[t];let i=this._pbf.readVarint()+this._pbf.pos;return new y(this._pbf,i,this.extent,this._keys,this._values)}};function A(e){let t=null,i=e.readVarint()+e.pos;for(;e.pos<i;){let n=e.readVarint();t=n===10?e.readString():n===21?e.readFloat():n===25?e.readDouble():n===32?e.readVarint(!0):n===40?e.readVarint():n===48?e.readSVarint():n===56?e.readBoolean():(e.skip(n),null)}if(t==null)throw new Error("unknown feature value");return t}var p=class{constructor(t,i=t.length){let n=Object.create(null);for(;t.pos<i;){let r=t.readVarint();if(r===26){let s=new _(t,t.readVarint()+t.pos);s.length&&(n[s.name]=s)}else t.skip(r)}this.layers=n}};var L=12,C=32,P=new TextDecoder,U=0,v=1,S=2,H=5,g=class{constructor(t){this.buf=ArrayBuffer.isView(t)?t:new Uint8Array(t),this.dataView=new DataView(this.buf.buffer,this.buf.byteOffset,this.buf.byteLength),this.pos=0,this.type=0,this._valueStart=-1,this.length=this.buf.length}readFields(t,i,n=this.length){let r;for(;r=this.nextField(n);)t(r,i,this);return i}readMessage(t,i){return this.readFields(t,i,this.readVarint()+this.pos)}readFixed32(){let t=this.dataView.getUint32(this.pos,!0);return this.pos+=4,t}readSFixed32(){let t=this.dataView.getInt32(this.pos,!0);return this.pos+=4,t}readFixed64(){let t=this.dataView.getUint32(this.pos,!0)+this.dataView.getUint32(this.pos+4,!0)*4294967296;return this.pos+=8,t}readSFixed64(){let t=this.dataView.getUint32(this.pos,!0)+this.dataView.getInt32(this.pos+4,!0)*4294967296;return this.pos+=8,t}readFloat(){let t=this.dataView.getFloat32(this.pos,!0);return this.pos+=4,t}readDouble(){let t=this.dataView.getFloat64(this.pos,!0);return this.pos+=8,t}readVarint(t){let i=this.buf,n=i[this.pos++];if(n<128)return n;let r=n&127,s;return s=i[this.pos++],r|=(s&127)<<7,s<128||(s=i[this.pos++],r|=(s&127)<<14,s<128)||(s=i[this.pos++],r|=(s&127)<<21,s<128)?r:(s=i[this.pos],r|=(s&15)<<28,N(r,t,this))}readSVarint(){let t=this.readVarint();return t%2===1?(t+1)/-2:t/2}readBoolean(){return!!this.readVarint()}readString(){let t=this.readVarint()+this.pos,i=this.pos;return this.pos=t,t-i>=(this.buf[i]<128?L:C)?P.decode(this.buf.subarray(i,t)):R(this.buf,i,t)}readBytes(){let t=this.readVarint()+this.pos,i=this.buf.subarray(this.pos,t);return this.pos=t,i}readPackedVarint(t=[],i){let n=this.readPackedEnd(),r=this.buf,s=this.pos;for(;s<n;){let h=r[s];if(h<128){t.push(h),s++;continue}let o=r[s+1];if(o<128){t.push(h&127|o<<7),s+=2;continue}this.pos=s,t.push(this.readVarint(i)),s=this.pos}return this.pos=s,t}readPackedSVarint(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readSVarint());return t}readPackedBoolean(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readBoolean());return t}readPackedFloat(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readFloat());return t}readPackedDouble(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readDouble());return t}readPackedFixed32(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readFixed32());return t}readPackedSFixed32(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readSFixed32());return t}readPackedFixed64(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readFixed64());return t}readPackedSFixed64(t=[]){let i=this.readPackedEnd();for(;this.pos<i;)t.push(this.readSFixed64());return t}readPackedEnd(){return this.type===S?this.readVarint()+this.pos:this.pos+1}nextField(t=this.length){if(this.pos===this._valueStart&&this.skip(this.type),this.pos>=t)return 0;let i=this.readVarint();return this.type=i&7,this._valueStart=this.pos,i>>>3}skip(t){let i=t&7;if(i===U)for(;this.buf[this.pos++]>127;);else if(i===S)this.pos=this.readVarint()+this.pos;else if(i===H)this.pos+=4;else if(i===v)this.pos+=8;else throw new Error(`Unimplemented type: ${i}`)}};function N(e,t,i){let n=i.buf,r,s;if(s=n[i.pos++],r=(s&112)>>4,s<128||(s=n[i.pos++],r|=(s&127)<<3,s<128)||(s=n[i.pos++],r|=(s&127)<<10,s<128)||(s=n[i.pos++],r|=(s&127)<<17,s<128)||(s=n[i.pos++],r|=(s&127)<<24,s<128)||(s=n[i.pos++],r|=(s&1)<<31,s<128))return f(e,r,t);throw new Error("Expected varint not more than 10 bytes")}function f(e,t,i){return i?t*4294967296+(e>>>0):(t>>>0)*4294967296+(e>>>0)}function R(e,t,i){let n="";for(let r=t;r<i;r++){let s=e[r];if(s>127){let h=e[r+1]^128,o=e[r+2]^128;if(s>=194&&s<224&&h<64&&r+1<i)s=(s&31)<<6|h,r++;else if((s&240)===224&&h<64&&o<64&&r+2<i&&(s=(s&15)<<12|h<<6|o)>=2048&&(s<55296||s>57343))r+=2;else return P.decode(e.subarray(t,i))}n+=String.fromCharCode(s)}return n}return T(O);})();

})();
