import {clamp,ease,mix} from './rig.mjs';
const pulse=(t,start,length)=>Math.sin(Math.PI*clamp((t-start)/length))**2;
const envelope=t=>ease(t/.13)*(1-ease((t-.82)/.18));
const gaze=(t,start,end,blink)=>ease((t-start)/.22)*(1-ease((t-end)/.24))*(1-pulse(t,blink,.20));
const smile=(t,start,end)=>ease((t-start)/.22)*(1-ease((t-end)/.28));
export function poseFor(frame,age=0,clock=age){
 const p={breath:0,calm:1,exhale:0,hum:0,look:0,head:0,tilt:0,hands:0,gather:0,shoulders:0,sway:0,greet:0,brow:0,squint:0,focus:0,release:0,cheeks:0,smile:0,nose:0,lipSeal:0};
 if(frame.motion===false||frame.mode==='paused')return p;
 const t=clamp(frame.progress||0),arc=Math.sin(Math.PI*t)**2;
 p.sway=.10*Math.sin(clock/8.7)+.045*Math.sin(clock/4.3);
 if(frame.mode==='guiding'){
  p.breath=clamp(frame.breath||0)*.98;
  // The breath supplies the shared pose at every phase boundary. Acting is a
  // zero-velocity arc inside the phase, so holds never snap into another face.
  p.shoulders=.70*p.breath;
  p.head=-.72*p.breath;
  p.hands=(frame.belly ? .94 : .63)*p.breath;
  p.brow=.38*p.breath;
  p.cheeks=.17*p.breath;
  p.smile=.14*p.breath;
  if(frame.role==='in'){
   p.head-=.22*arc;p.tilt=-.32*arc;p.brow+=.50*arc;
   p.cheeks+=.27*arc;p.nose=.44*arc;p.smile+=.26*arc;
  }
  if(frame.role==='sip'){
   // A compact second lift reads as a second sniff, without shaking the body.
   p.head-=.40*arc;p.tilt=-.20*arc;p.brow+=.76*arc;
   p.nose=.85*arc;p.cheeks+=.20*arc;p.hands+=.13*arc;p.shoulders+=.22*arc;
  }
  if(frame.role==='out'){
   p.exhale=frame.via==='nose'||frame.humming?0:envelope(t);
   p.hum=frame.humming?envelope(t):0;p.release=arc;
   p.head+=.43*arc;p.tilt=.34*arc;p.squint=.68*arc;
   p.cheeks+=.70*arc;p.smile+=(frame.humming?.50:.36)*arc;
   p.lipSeal=frame.humming?.68*arc:0;
  }
  // Brief, unhurried eye contact follows its own clock, never restarting per breath.
  const life=clock%53;p.look=gaze(life,12.3,14.7,13.5)+gaze(life,36.8,39.5,38.2);
 }else if(frame.mode==='toilet'){
  const release=clamp(frame.f||0),squeeze=clamp(-(frame.f||0)),press=clamp(frame.press||0);
  p.breath=clamp(frame.b||0)*.98;p.shoulders=.35*p.breath;
  p.head=-.62*squeeze+.46*release+.32*press;
  p.hands=.55*p.breath+.32*release-.65*press;p.gather=.9*squeeze;
  p.tilt=.24*release-.16*squeeze;p.brow=.50*squeeze;p.squint=.48*release;
  p.cheeks=.40*release;p.smile=.40*release;
  p.release=release;if(frame.role==='push')p.exhale=envelope(t);
  const life=clock%53;p.look=gaze(life,12.3,14.7,13.5)+gaze(life,36.8,39.5,38.2);
 }else if(frame.mode==='welcome'){
  p.look=gaze(age,.12,3.2,1.65);p.calm=1-smile(age,.3,2.8);
  p.head=.80*pulse(age,.45,1.5)-.24*pulse(age,2.2,2);
  p.tilt=.90*pulse(age,.15,2.5)-.22*pulse(age,3.8,2.5);
  p.greet=.72*pulse(age,.4,2);p.brow=.70*pulse(age,.25,2.2);
  p.cheeks=.70*pulse(age,.4,2.6);p.smile=.50*pulse(age,.4,2.6);
 }else if(frame.mode==='hands'){
  p.hands=ease(age/.8)*(1-ease((age-1.5)/1.6));
  p.focus=.45*pulse(age,0,3.4);p.head=.46*pulse(age,.2,3.4);p.tilt=.28*pulse(age,0,3.4);
  p.brow=.38*pulse(age,.2,3.4);p.smile=.32*pulse(age,.2,3.4);
 }else if(['own','natural','rest'].includes(frame.mode)){
  const x=frame.mode==='own'?(frame.elapsed||0):age,life=x%61;
  p.head=.25*(pulse(life,1.1,2.3)+pulse(life,29,2.8));
  p.tilt=.38*pulse(life,8,3.6)-.28*pulse(life,46,3.2);
  p.look=gaze(life,8,10.5,9.65)+gaze(life,46,48.5,47.55);
  p.hands=.12*pulse(life,3,2.8);
  p.cheeks=.24*pulse(life,8,3.6);p.smile=.22*pulse(life,8,3.6);
 }else if(frame.mode==='finish'){
  p.look=gaze(age,.15,3.3,1.9);p.calm=1-smile(age,.25,2.9);
  p.head=.84*pulse(age,.3,1.5);p.tilt=.82*pulse(age,.6,2.8);
  p.greet=.68*pulse(age,.7,2.4);p.brow=.64*pulse(age,.2,2.5);
  p.cheeks=.78*pulse(age,.4,2.7);p.smile=.55*pulse(age,.4,2.7);
 }
 return p;
}
export function mixPose(a,b,progress){const p={...b},k=ease(progress);for(const key of Object.keys(p))p[key]=mix(a[key]||0,b[key]||0,k);return p;}
// Critically damped follow-through for the joints; breath and facial cues stay on the guide clock.
export function followPose(previous,target,velocity,dt){
 const p={...target};dt=clamp(dt,0,.08);
 for(const key of ['head','tilt','hands','gather','shoulders','sway','greet']){
  const rate=key==='hands'||key==='greet'?17:21,z=(previous[key]||0)-target[key],v=velocity[key]||0,j=v+rate*z,e=Math.exp(-rate*dt);
  p[key]=target[key]+(z+j*dt)*e;velocity[key]=(v-rate*j*dt)*e;
 }
 return p;
}
export function sceneFor(seconds){return {peachX:4*Math.sin(seconds/17),peachY:2*Math.sin(seconds/23),lilacX:3*Math.sin(seconds/21+.8),lilacY:2*Math.sin(seconds/29+.4),fleckY:3*Math.sin(seconds/13),fleckX:2*Math.sin(seconds/19)};}
