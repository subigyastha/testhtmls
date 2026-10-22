export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
export const mix=(a,b,x)=>a+(b-a)*x;
export const ART_SCALE=.94;
export const ART_INSET=(1-ART_SCALE)/2;
const zone=(x,y,cx,cy,rx,ry)=>1-ease((Math.hypot((x-cx)/rx,(y-cy)/ry)-.82)/.72);
const rotate=(x,y,cx,cy,a)=>[cx+(x-cx)*Math.cos(a)-(y-cy)*Math.sin(a),cy+(x-cx)*Math.sin(a)+(y-cy)*Math.cos(a)];
// Broad compact-support weights join one painted body; they never move a
// detached hand or scale the skull. Facial acting stays inside the face.
export function warp(x,y,p){
 const b=clamp(p.breath||0),seat=1-ease((y-.83)/.07);
 const left=zone(x,y,.315,.725,.112,.071),right=zone(x,y,.685,.725,.112,.071);
 const hand=Math.max(left,right),abdomen=zone(x,y,.5,.685,.23,.15)*seat;
 const torso=ease((y-.39)/.12)*(1-ease((y-.80)/.1));
 let nx=x+(x-.5)*.115*b*abdomen*(1-hand);
 let ny=y+(y-.69)*.06*b*abdomen*(1-hand)-.0045*b*torso*(1-hand);
 // Each palm follows its wrist as a unit instead of growing with the belly.
 for(const [weight,side] of [[left,-1],[right,1]]){
  const wristX=.5+side*.285,wristY=.717,h=p.hands||0,g=p.gather||0;
  const greet=(p.greet||0)*(side<0?1:.28);
  const angle=-side*(.045*h-.065*g+.11*greet);
  const [hx,hy]=rotate(x,y,wristX,wristY,angle);
  nx+=weight*(hx-x+side*(.008*b-.011*g));
  ny+=weight*(hy-y-.006*b-.009*h-.012*greet);
 }
 const shoulders=(zone(x,y,.23,.49,.12,.12)+zone(x,y,.77,.49,.12,.12))*.5;
 ny-=.009*(p.shoulders||0)*shoulders;
 // Brows lead the inhale; cheek pads and lower lids lift together on release.
 // Existing expressions remain the texture, with no added strokes or face decals.
 const cheekAmount=clamp(p.cheeks||0),squint=clamp(p.squint||0),brow=clamp(p.brow||0);
 for(const [side,eyeX,eyeY,browX,browY,cheekX] of [[-1,.397,.217,.388,.148,.337],[1,.607,.209,.598,.141,.669]]){
  const eye=zone(x,y,eyeX,eyeY,.070,.033);
  // Flatten the crescent slightly and carry it with the rising cheek, rather
  // than expanding the eye itself. Eyes remain gentle during a long exhale.
  ny+=((eyeY-y)*.20*squint-.0038*cheekAmount)*eye;
  const eyebrow=zone(x,y,browX,browY,.078,.030);
  ny-=.0105*brow*eyebrow;
  ny+=side*(x-browX)*.055*brow*eyebrow;
  const cheek=zone(x,y,cheekX,.292,.078,.067);
  nx+=side*.0035*cheekAmount*cheek;
  ny-=.0080*cheekAmount*cheek;
  // The corners follow the cheeks, including the closed-mouth humming smile.
  const corner=zone(x,y,.5+side*.078,.297,.037,.037);
  nx+=side*.0030*(p.smile||0)*corner;
  ny-=.0085*(p.smile||0)*corner;
 }
 // A small nostril flare supplies the second-inhale cue without snout stretch.
 const nose=zone(x,y,.502,.251,.040,.026);
 nx+=(x-.502)*.065*clamp(p.nose||0)*nose;
 ny-=.0030*clamp(p.nose||0)*nose;
 const lips=zone(x,y,.502,.311,.064,.025);
 ny+=(.302-y)*.10*clamp(p.lipSeal||0)*lips;
 // Face and skull share one rigid transform, blended only at the neck.
 const head=1-ease((y-.385)/.12);
 const [hx,hy]=rotate(nx,ny,.5,.395,(p.tilt||0)*.055);
 nx=mix(nx,hx,head);ny=mix(ny,hy+.018*(p.head||0),head);
 // Small posture shifts pivot above the seated base, which remains planted.
 const upper=1-ease((y-.65)/.25);
 const [sx,sy]=rotate(nx,ny,.5,.88,(p.sway||0)*.028);
 return [mix(nx,sx,upper),mix(ny,sy,upper)];
}
