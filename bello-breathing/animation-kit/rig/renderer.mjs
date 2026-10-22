import {warp,clamp,ART_SCALE,ART_INSET} from './rig.mjs';
export const CROP={x:307,y:586,w:332,h:360};
// The new tightly framed artwork stays at native resolution through texture upload.
// Only facial regions are taken from expression edits, keeping one shared body.
export function prepareHighResolutionTextures(original,calm,makeCanvas,exhale,eyes){
 const w=original.width,h=original.height;
 const make=()=>{const c=makeCanvas(w,h),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';return [c,ctx]};
 const [base,baseContext]=make();baseContext.drawImage(original,0,0,w,h);
 const patch=(source,{x,y,rx,ry})=>{
  const [layer,ctx]=make();ctx.drawImage(source,0,0,w,h);
  ctx.globalCompositeOperation='destination-in';ctx.save();ctx.translate(x*w,y*h);ctx.scale(rx*w,ry*h);
  const mask=ctx.createRadialGradient(0,0,0,0,0,1);mask.addColorStop(0,'#000');mask.addColorStop(.78,'#000');mask.addColorStop(1,'transparent');
  ctx.fillStyle=mask;ctx.fillRect(-x/rx,-y/ry,1/rx,1/ry);ctx.restore();return layer;
 };
 const mouth={x:.502,y:.316,rx:.145,ry:.085};
 const [relaxed,rc]=make();rc.drawImage(original,0,0,w,h);rc.drawImage(patch(calm,mouth),0,0);
 const [out,oc]=make();oc.drawImage(original,0,0,w,h);oc.drawImage(patch(exhale,mouth),0,0);
 const [eyeLayer,ec]=make();
 for(const area of [{x:.397,y:.215,rx:.069,ry:.037},{x:.607,y:.207,rx:.069,ry:.037}])ec.drawImage(patch(eyes,area),0,0);
 return [base,relaxed,out,eyeLayer];
}
// Generated expressions are restricted to small mouth and eye patches. The
// original head, nose, hands, clothing and body remain the supplied artwork.
export function prepareTextures(original,expression,makeCanvas,exhale,eyes){
 const {x,y,w,h}=CROP;
 const a=makeCanvas(w,h),b=makeCanvas(w,h);a.getContext('2d').drawImage(original,x,y,w,h,0,0,w,h);
 const bc=b.getContext('2d');bc.drawImage(a,0,0);
 const patch=makeCanvas(w,h),pc=patch.getContext('2d');
 // Both images have the same source canvas; align the mouth around its midpoint.
 pc.drawImage(expression,432,684,80,48,125,89,80,48);
 pc.globalCompositeOperation='destination-in';
 const vertical=pc.createLinearGradient(0,89,0,137);vertical.addColorStop(0,'transparent');vertical.addColorStop(.04,'#000');vertical.addColorStop(.85,'#000');vertical.addColorStop(1,'transparent');pc.fillStyle=vertical;pc.fillRect(125,89,80,48);
 const horizontal=pc.createLinearGradient(125,0,205,0);horizontal.addColorStop(0,'transparent');horizontal.addColorStop(.10,'#000');horizontal.addColorStop(.90,'#000');horizontal.addColorStop(1,'transparent');pc.fillStyle=horizontal;pc.fillRect(125,89,80,48);
 bc.drawImage(patch,0,0);
 const c=makeCanvas(w,h),cc=c.getContext('2d');cc.drawImage(b,0,0);
 if(exhale){
  const ep=makeCanvas(w,h),ec=ep.getContext('2d');
  // Generated mouth is aligned to the original mouth, not to the generated body.
  ec.drawImage(exhale,420,704,104,48,125,89,80,48);
  ec.globalCompositeOperation='destination-in';
  const mask=ec.createRadialGradient(165,113,12,165,113,41);mask.addColorStop(0,'#000');mask.addColorStop(.70,'#000');mask.addColorStop(1,'transparent');ec.fillStyle=mask;ec.fillRect(125,89,80,48);
  const edge=ec.createLinearGradient(0,89,0,137);edge.addColorStop(0,'transparent');edge.addColorStop(.08,'#000');edge.addColorStop(.80,'#000');edge.addColorStop(1,'transparent');ec.fillStyle=edge;ec.fillRect(125,89,80,48);
  cc.drawImage(ep,0,0);
 }
 const eyePatch=makeCanvas(w,h);
 if(eyes){const ec=eyePatch.getContext('2d');for(const [sx,sy,dx,dy] of [[414,648,108,53],[490,645,176,53]]){const cut=makeCanvas(44,34),cx=cut.getContext('2d');cx.drawImage(eyes,sx,sy,44,34,0,0,44,34);cx.globalCompositeOperation='destination-in';const mask=cx.createRadialGradient(22,17,8,22,17,23);mask.addColorStop(0,'#000');mask.addColorStop(.8,'#000');mask.addColorStop(1,'transparent');cx.fillStyle=mask;cx.fillRect(0,0,44,34);ec.drawImage(cut,dx,dy);}}
 return [a,b,c,eyePatch];
}
export function makeMesh(cols=64,rows=72){
 const uv=[],indices=[];for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)uv.push(x/cols,y/rows);
 for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+1,c=a+cols+1,d=c+1;indices.push(a,b,c,b,d,c)}
 return {uv:new Float32Array(uv),indices:new Uint16Array(indices),cols,rows};
}
const vert=`attribute vec2 a_position;attribute vec2 a_uv;varying vec2 v_uv;void main(){gl_Position=vec4(a_position,0.,1.);v_uv=a_uv;}`;
const frag=`precision mediump float;varying vec2 v_uv;uniform sampler2D u_original;uniform sampler2D u_calm;uniform sampler2D u_exhale;uniform float u_mix;uniform float u_blow;uniform sampler2D u_eyes;uniform float u_look;void main(){vec4 face=mix(texture2D(u_original,v_uv),texture2D(u_calm,v_uv),u_mix);vec4 body=mix(face,texture2D(u_exhale,v_uv),u_blow);vec4 eyes=texture2D(u_eyes,v_uv);gl_FragColor=body*(1.-eyes.a*u_look)+eyes*u_look;}`;
function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
export function makeWebGLRenderer(canvas,textures){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true});if(!gl)throw Error('WebGL unavailable');
 const program=gl.createProgram();gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,vert));gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,frag));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const mesh=makeMesh(),positions=new Float32Array(mesh.uv.length);
 const vertexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,positions,gl.DYNAMIC_DRAW);const ap=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(ap);gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
 const uvBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvBuffer);gl.bufferData(gl.ARRAY_BUFFER,mesh.uv,gl.STATIC_DRAW);const au=gl.getAttribLocation(program,'a_uv');gl.enableVertexAttribArray(au);gl.vertexAttribPointer(au,2,gl.FLOAT,false,0,0);
 const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
 textures.forEach((t,i)=>{gl.activeTexture(gl.TEXTURE0+i);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,t);gl.uniform1i(gl.getUniformLocation(program,['u_original','u_calm','u_exhale','u_eyes'][i]),i)});
 const um=gl.getUniformLocation(program,'u_mix'),ub=gl.getUniformLocation(program,'u_blow'),ul=gl.getUniformLocation(program,'u_look');gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
 return {draw(p){
  const dpr=Math.min(window.devicePixelRatio||1,3),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  for(let i=0;i<mesh.uv.length;i+=2){const [x,y]=warp(mesh.uv[i],mesh.uv[i+1],p);positions[i]=(x-.5)*2*ART_SCALE;positions[i+1]=(.5-y)*2*ART_SCALE}
  gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,positions);gl.uniform1f(um,clamp(p.calm));gl.uniform1f(ub,clamp(p.exhale||0));gl.uniform1f(ul,clamp(p.look||0));gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);
 }};
}
// Also used to render inspection frames without a browser. Same deformations.
export function drawCanvasPose(ctx,texture,pose,width,height,{cols=20,rows=22}={}){
 ctx.clearRect(0,0,width,height);const mesh=makeMesh(cols,rows),pts=[];
 for(let i=0;i<mesh.uv.length;i+=2){const [x,y]=warp(mesh.uv[i],mesh.uv[i+1],pose);pts.push([(x*ART_SCALE+ART_INSET)*width,(y*ART_SCALE+ART_INSET)*height])}
 for(let i=0;i<mesh.indices.length;i+=3){
  const ids=[mesh.indices[i],mesh.indices[i+1],mesh.indices[i+2]],dst=ids.map(k=>pts[k]),src=ids.map(k=>[mesh.uv[k*2]*texture.width,mesh.uv[k*2+1]*texture.height]);
  const [a,b,c]=src,[d,e,f]=dst;const den=a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]);if(!den)continue;
  const m1=(d[0]*(b[1]-c[1])+e[0]*(c[1]-a[1])+f[0]*(a[1]-b[1]))/den;
  const m2=(d[1]*(b[1]-c[1])+e[1]*(c[1]-a[1])+f[1]*(a[1]-b[1]))/den;
  const m3=(d[0]*(c[0]-b[0])+e[0]*(a[0]-c[0])+f[0]*(b[0]-a[0]))/den;
  const m4=(d[1]*(c[0]-b[0])+e[1]*(a[0]-c[0])+f[1]*(b[0]-a[0]))/den;
  const m5=d[0]-m1*a[0]-m3*a[1],m6=d[1]-m2*a[0]-m4*a[1];
  ctx.save();ctx.beginPath();const cx=(d[0]+e[0]+f[0])/3,cy=(d[1]+e[1]+f[1])/3;
  [d,e,f].forEach((v,j)=>{const vx=v[0]-cx,vy=v[1]-cy,len=Math.hypot(vx,vy),px=v[0]+vx/len*1.6,py=v[1]+vy/len*1.6;j?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.closePath();ctx.clip();ctx.setTransform(m1,m2,m3,m4,m5,m6);
  // Sample only this triangle's source tile, rather than the entire HD image.
  const pad=Math.ceil(3*Math.max(texture.width/width,texture.height/height)),sx=Math.max(0,Math.floor(Math.min(...src.map(v=>v[0])))-pad),sy=Math.max(0,Math.floor(Math.min(...src.map(v=>v[1])))-pad),sw=Math.min(texture.width,Math.ceil(Math.max(...src.map(v=>v[0])))+pad)-sx,sh=Math.min(texture.height,Math.ceil(Math.max(...src.map(v=>v[1])))+pad)-sy;
  ctx.drawImage(texture,sx,sy,sw,sh,sx,sy,sw,sh);ctx.restore();
 }
}
export function makeCanvasRenderer(canvas,textures,makeCanvas){
 const ctx=canvas.getContext('2d'),mw=Math.min(textures[0].width,768),mh=Math.round(mw*textures[0].height/textures[0].width),mixCanvas=makeCanvas(mw,mh),mc=mixCanvas.getContext('2d');
 mc.imageSmoothingEnabled=true;mc.imageSmoothingQuality='high';
 return {draw(p){
  const dpr=Math.min(window.devicePixelRatio||1,2),width=Math.round(canvas.clientWidth*dpr),height=Math.round(canvas.clientHeight*dpr);
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';mc.clearRect(0,0,mw,mh);
  for(const [i,alpha] of [1,p.calm,p.exhale||0,p.look||0].entries()){mc.globalAlpha=alpha;mc.drawImage(textures[i],0,0,mw,mh);}
  // Keep the software path within a frame budget on devices without WebGL.
  // This grid still places rows through the brows, lids and mouth.
  mc.globalAlpha=1;drawCanvasPose(ctx,mixCanvas,p,canvas.width,canvas.height,{cols:24,rows:28});
 }};
}
