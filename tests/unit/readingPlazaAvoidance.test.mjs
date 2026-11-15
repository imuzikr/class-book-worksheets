import test from "node:test";
import assert from "node:assert/strict";
import { PLAZA_AVATAR_SEPARATION, plazaAvoidPath, plazaAvoidStep } from "../../lib/readingPlazaAvoidance.js";
import { CLASSROOM_ROOM, CLASSROOM_SEATS, PLAZA_ROOM, plazaClear, plazaPath, plazaStep, plazaWalkable } from "../../lib/readingPlazaMap.js";
import { plazaSpawnFor } from "../../lib/readingPlazaLive.js";

const FIELD = Object.freeze({
  floor: [[20,20],[1600,20],[1600,900],[20,900]], ellipses: [], rects: [], spawn:{x:800,y:700},
});
const pace = 260 / 60;
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
function toward(from,to,step=pace) {
  const d=dist(from,to),s=Math.min(step,d);
  return d ? {x:from.x+(to.x-from.x)/d*s,y:from.y+(to.y-from.y)/d*s} : {...from};
}
function walk(from,to,peers,room=FIELD,limit=1000) {
  const memo={},trace=[{...from}];let avoided=false;
  for(let n=0;n<limit&&dist(from,to)>.01;n++) {
    const next=plazaAvoidStep(from,toward(from,to),{peers,memo,room,id:'me'});
    assert.ok(dist(from,next)<=pace+1e-6,'fixed movement budget');
    assert.equal(plazaClear(from,next,room),true,'never cut through furniture or walls');
    for(const peer of peers)assert.ok(dist(next,peer)>=Math.min(PLAZA_AVATAR_SEPARATION,dist(from,peer))-1e-6,'no deeper overlap');
    avoided ||= next.avoiding;
    from={x:next.x,y:next.y};trace.push(from);
  }
  return {at:from,trace,avoided};
}

test('no peers preserves the existing proposed step and bounds long movement',()=>{
  const from={x:400,y:300},desired={x:410,y:305};
  assert.deepEqual(plazaAvoidStep(from,desired,{room:FIELD}),{...desired,avoiding:false,blocked:false});
  assert.ok(dist(from,plazaAvoidStep(from,desired,{room:FIELD,maxStep:3}))<=3+1e-9);
  assert.deepEqual(from,{x:400,y:300});assert.deepEqual(desired,{x:410,y:305});
});

test('a stationary peer is passed on a stable side and the goal is reached',()=>{
  const from={x:600,y:400},goal={x:1000,y:400},peer={uid:'friend',x:800,y:400};
  const run=walk(from,goal,[peer]);
  assert.equal(run.avoided,true);assert.ok(dist(run.at,goal)<.01);
  assert.ok(Math.max(...run.trace.map(p=>p.y))-400>50,'starts passing before touching');
  assert.ok(Math.min(...run.trace.map(p=>p.y))>=400-1e-6,'does not oscillate between sides');
});

test('the alternative side is chosen when the preferred side meets a wall',()=>{
  const goal={x:1000,y:850};const run=walk({x:600,y:850},goal,[{uid:'friend',x:800,y:850}]);
  assert.ok(dist(run.at,goal)<.01);assert.ok(Math.min(...run.trace.map(p=>p.y))<800,'passes on upper side');
  assert.ok(Math.max(...run.trace.map(p=>p.y))<900);
});

function walkTogether(people,limit=1000) {
  const trace=[];for(const p of people)p.memo={};
  for(let n=0;n<limit;n++) {
    const peers=people.map(p=>({...p,moving:dist(p,p.goal)>.01}));
    const next=people.map(p=>plazaAvoidStep(p,toward(p,p.goal),{peers,memo:p.memo,id:p.uid,room:FIELD}));
    for(let a=0;a<people.length;a++)for(let b=a+1;b<people.length;b++)assert.ok(dist(next[a],next[b])>=PLAZA_AVATAR_SEPARATION-1e-6,`travellers overlap at frame ${n}: ${JSON.stringify(next)}`);
    for(let i=0;i<people.length;i++){assert.ok(dist(people[i],next[i])<=pace+1e-6);people[i].x=next[i].x;people[i].y=next[i].y;}
    trace.push(next.map(p=>({x:p.x,y:p.y})));
    if(people.every(p=>dist(p,p.goal)<.01))return {arrived:true,trace};
  }
  return {arrived:false,trace};
}

test('opposite travellers give way and do not mirror into one another',()=>{
  const people=[{uid:'a',x:500,y:600,goal:{x:1000,y:600}},{uid:'b',x:1000,y:600,goal:{x:500,y:600}}];
  const run=walkTogether(people);
  assert.equal(run.arrived,true);
  assert.ok(run.trace.some(ps=>ps[0].y>610),'one moves to its right while the other gives way');
});

test('crossing travellers avoid each other and continue to their own destinations',()=>{
  const people=[{uid:'a',x:550,y:600,goal:{x:1050,y:600}},{uid:'b',x:800,y:850,goal:{x:800,y:350}}];
  assert.equal(walkTogether(people).arrived,true);
});

test('diagonal crossing angles remain separated and have no yielding cycles',()=>{
  for(const angle of [.3,.65,1.15,1.57,2.1,2.7,3.14]) {
    const people=[.8,.8+angle].map((a,i)=>({uid:String(i),x:800+Math.cos(a)*250,y:450+Math.sin(a)*250,goal:{x:800-Math.cos(a)*250,y:450-Math.sin(a)*250}}));
    assert.equal(walkTogether(people).arrived,true,`angle ${angle}`);
  }
});

test('a corridor with no passing space waits without sideways jitter',()=>{
  const room={...FIELD,floor:[[20,450],[1600,450],[1600,480],[20,480]]};
  const from={x:700,y:465},peer={uid:'friend',x:800,y:465},memo={};
  for(let n=0;n<60;n++){
    const result=plazaAvoidStep(from,{x:from.x+pace,y:from.y},{peers:[peer],memo,room});
    assert.equal(result.blocked,true);assert.deepEqual({x:result.x,y:result.y},from);
  }
});

test('an overlapping shared spawn escapes gradually rather than teleporting or freezing',()=>{
  const peer={uid:'friend',x:700,y:500};
  const run=walk({x:700,y:500},{x:950,y:500},[peer]);
  assert.ok(dist(run.at,{x:950,y:500})<.01);
  assert.ok(run.trace.every((p,i)=>!i||dist(p,peer)>=Math.min(PLAZA_AVATAR_SEPARATION,dist(run.trace[i-1],peer))-1e-6));
});

test('the existing25-student spawn does not lock surrounded students in every direction',()=>{
  const peers=Array.from({length:25},(_,i)=>{
    const uid=`bookbom_demo_student_${String(i+1).padStart(2,'0')}`;
    return {uid,...plazaSpawnFor(uid)};
  });
  for(const student of peers){
    let escaped=false;
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
      const memo={},round={};let at={...student};
      for(let n=0;n<40;n++){
        const desired=plazaStep(at,dx*pace,dy*pace,round,PLAZA_ROOM);
        const next=plazaAvoidStep(at,desired,{id:student.uid,peers,memo,room:PLAZA_ROOM});
        assert.ok(dist(at,next)<=pace+1e-6,'bounded walking, never a spawn teleport');
        assert.equal(plazaClear(at,next,PLAZA_ROOM),true);
        at={x:next.x,y:next.y};
        if(dist(at,student)>20){escaped=true;break;}
      }
      if(escaped)break;
    }
    assert.equal(escaped,true,`${student.uid} can leave the crowded start`);
  }
});

test('crowded-spawn grace captures only original overlaps and retires them before reentry',()=>{
  const cohort=[{uid:'a',x:710,y:500},{uid:'b',x:695,y:509},{uid:'c',x:695,y:491}];
  const newcomer={uid:'new',x:780,y:500},peers=[...cohort,newcomer],memo={},retired=new Set();
  let at={x:700,y:500},sawGrace=false;
  for(let n=0;n<40;n++){
    const next=plazaAvoidStep(at,{x:at.x+pace,y:at.y},{peers,memo,room:FIELD});
    assert.ok(dist(at,next)<=pace+1e-6);
    assert.ok(dist(next,newcomer)>=PLAZA_AVATAR_SEPARATION-1e-6,'new contact always remains solid');
    sawGrace ||= memo.escape?.size>0;
    assert.equal(memo.escape?.has('new')??false,false,'active cohort never grows to include a new contact');
    for(const peer of cohort){
      if(dist(next,peer)>=PLAZA_AVATAR_SEPARATION-1e-6)retired.add(peer.uid);
      if(retired.has(peer.uid)){
        assert.equal(memo.escape?.has(peer.uid)??false,false,'cleared original UID immediately becomes solid');
        assert.ok(dist(next,peer)>=PLAZA_AVATAR_SEPARATION-1e-6);
      }
    }
    at={x:next.x,y:next.y};
  }
  assert.equal(sawGrace,true);assert.equal(retired.size,3);assert.equal(memo.escape,undefined);
  for(let n=0;n<80;n++){
    const next=plazaAvoidStep(at,toward(at,{x:700,y:500}),{peers,memo,room:FIELD});
    for(const peer of peers)assert.ok(dist(next,peer)>=PLAZA_AVATAR_SEPARATION-1e-6,'walking back cannot reacquire spawn grace');
    assert.equal(memo.escape,undefined);at={x:next.x,y:next.y};
  }
});

test('idle actors and single-overlap escape never acquire multi-person grace',()=>{
  const memo={},at={x:700,y:500},cohort=[{uid:'a',x:710,y:500},{uid:'b',x:695,y:509},{uid:'c',x:695,y:491}];
  assert.deepEqual(plazaAvoidStep(at,at,{peers:cohort,memo,room:FIELD}),{...at,avoiding:false,blocked:false});
  assert.equal(memo.escape,undefined,'idle actors are never pushed');
  const peer={uid:'single',x:700,y:500};let position=at;
  for(let n=0;n<20;n++){
    const next=plazaAvoidStep(position,{x:position.x+pace,y:position.y},{peers:[peer],memo,room:FIELD});
    assert.ok(dist(next,peer)>=Math.min(PLAZA_AVATAR_SEPARATION,dist(position,peer))-1e-6);
    assert.equal(memo.escape,undefined);position={x:next.x,y:next.y};
  }
});

test('self and malformed presence records do not create obstacles',()=>{
  const from={x:400,y:400},desired={x:404,y:400};
  assert.deepEqual(plazaAvoidStep(from,desired,{id:'me',room:FIELD,peers:[{uid:'me',x:400,y:400},{uid:'bad',x:NaN,y:400},null]}),{...desired,avoiding:false,blocked:false});
});

test('long candidate steps cannot tunnel across another character',()=>{
  const from={x:300,y:400},peer={uid:'friend',x:800,y:400};
  const next=plazaAvoidStep(from,{x:1300,y:400},{peers:[peer],memo:{},room:FIELD});
  const steps=300;for(let n=0;n<=steps;n++){
    const p={x:from.x+(next.x-from.x)*n/steps,y:from.y+(next.y-from.y)*n/steps};
    assert.ok(dist(p,peer)>=PLAZA_AVATAR_SEPARATION-1e-6);
    assert.equal(plazaWalkable(p.x,p.y,FIELD),true);
  }
});

test('a peer within the route padding still remains an obstacle when the body is already clear',()=>{
  const from={x:746,y:500},goal={x:1000,y:500},peer={uid:'friend',x:800,y:500};
  const route=plazaAvoidPath(from,goal,[peer],FIELD);
  assert.ok(route.length>1,'the54pxgap must not make the56px planning guard drop the peer');
  let last=from;for(const next of route){
    const n=Math.ceil(dist(last,next)/2);for(let i=0;i<=n;i++)assert.ok(dist({x:last.x+(next.x-last.x)*i/n,y:last.y+(next.y-last.y)*i/n},peer)>=PLAZA_AVATAR_SEPARATION-1e-6);
    last=next;
  }
});

test('full routes pass around a crowd and resolve an occupied destination nearby',()=>{
  const from={x:450,y:700},goal={x:1100,y:700};
  const peers=[{uid:'1',x:700,y:670},{uid:'2',x:750,y:730},{uid:'3',x:1100,y:700}];
  const route=plazaAvoidPath(from,goal,peers,FIELD);
  assert.ok(route.length>1);assert.ok(dist(route.at(-1),goal)<=90,'nearby destination keeps an interaction reachable');
  let previous=from;
  for(const waypoint of route){
    assert.equal(plazaClear(previous,waypoint,FIELD),true);
    const distance=dist(previous,waypoint),steps=Math.ceil(distance/3);
    for(let n=0;n<=steps;n++){
      const p={x:previous.x+(waypoint.x-previous.x)*n/steps,y:previous.y+(waypoint.y-previous.y)*n/steps};
      for(const peer of peers)assert.ok(dist(p,peer)>=PLAZA_AVATAR_SEPARATION-1e-6);
    }
    previous=waypoint;
  }
});

test('dynamic classroom routes respect the original desk rectangles and open corridors',()=>{
  const from={x:836,y:806},goal=CLASSROOM_SEATS[0].sides[0].stand;
  const original=plazaPath(from,goal,CLASSROOM_ROOM);assert.ok(original.length);
  // Block one ordinary approach segment; the remaining classroom routes stay open.
  const peer={uid:'friend',x:original[0].x,y:original[0].y};
  const route=plazaAvoidPath(from,goal,[peer],CLASSROOM_ROOM);assert.ok(route.length);
  let last=from;for(const waypoint of route){assert.equal(plazaWalkable(waypoint.x,waypoint.y,CLASSROOM_ROOM),true);assert.equal(plazaClear(last,waypoint,CLASSROOM_ROOM),true);last=waypoint;}
});

test('following classroom detours also passes desk corners at actual frame resolution',()=>{
  const from={x:836,y:806},goal=CLASSROOM_SEATS[0].sides[0].stand;
  const first=plazaPath(from,goal,CLASSROOM_ROOM)[0];
  for(const peers of [[],[{uid:'friend',...first}]]){
    const route=plazaAvoidPath(from,goal,peers,CLASSROOM_ROOM),memo={};let at=from;
    for(let n=0;n<1500&&route.length;n++){
      const target=route[0];
      const next=plazaAvoidStep(at,toward(at,target),{peers,memo,room:CLASSROOM_ROOM,goal:target});
      assert.equal(plazaClear(at,next,CLASSROOM_ROOM),true,'actual frame remains off furniture');
      for(const peer of peers)assert.ok(dist(next,peer)>=PLAZA_AVATAR_SEPARATION-1e-6);
      at={x:next.x,y:next.y};
      if(dist(at,target)<.1)route.shift();
    }
    assert.equal(route.length,0,'all waypoints are reached instead of freezing beside a desk corner');
    assert.ok(dist(at,goal)<.1);
  }
});

test('empty dynamic routes preserve the original fountain detour',()=>{
  const from={x:836,y:330},goal={x:836,y:700};
  assert.deepEqual(plazaAvoidPath(from,goal,[],PLAZA_ROOM),plazaPath(from,goal,PLAZA_ROOM));
});
