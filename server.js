const express=require("express");
const http=require("http");
const path=require("path");
const {Server}=require("socket.io");
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static(path.join(__dirname,"public")));
const PORT=process.env.PORT||3000;

const QUESTIONS=[
["Who narrates most of Shattering Glass?",["Rob Haynes","Young Steward","Simon Glass","Coop Cooper"],1,"Young Steward tells the main story while looking back on the events."],
["At the beginning, how is Simon Glass viewed at school?",["As the star athlete","As the most popular student","As an unpopular outsider","As class president"],2,"Simon begins as a social outcast who is frequently bullied."],
["What does Rob propose doing to Simon?",["Making him a better athlete","Transforming him into a popular student","Getting him expelled","Teaching him to drive"],1,"Rob treats Simon's transformation as a challenge and a way to demonstrate control."],
["Which character is the group's star football player?",["Bob","Young","Coop","Lance"],2,"Coop is B'Vale's star football player."],
["What does the novel suggest about popularity?",["It always makes people kinder","It can be used as a form of power","It has no effect","It only matters to teachers"],1,"The story connects status with influence, control, jealousy, and social power."],
["Which character is known as 'the Bobster'?",["Bob DeMarco","Robert Baddeck","Young Steward","Lance Ansley"],0,"Bob DeMarco is one of Rob's friends."],
["What is unusual about the novel's opening?",["It starts with a wedding","It reveals Simon will be killed","Simon becomes prom king","Everyone has graduated"],1,"The opening gives away the outcome and creates mystery about how and why it happens."],
["What literary effect comes from revealing the outcome early?",["Dramatic tension","Comic relief","Second-person narration","No effect"],0,"Knowing the ending makes readers watch for the choices that lead toward disaster."],
["How does Simon change as Rob's plan succeeds?",["He becomes more socially confident","He leaves school","He becomes less intelligent","He stops speaking"],0,"His confidence, appearance, status, and willingness to use power all change."],
["What does Simon discover through computer skills?",["Coop's football plays","Information about Rob's real identity","Young's favorite class","The cafeteria menu"],1,"Simon accesses school records and discovers that Rob's identity is not what the group believed."],
["Which theme is shown when Young follows Rob despite doubts?",["Peer pressure and conformity","Environmental conservation","Travel","Sportsmanship"],0,"Young often recognizes problems but still follows Rob, showing the force of peer pressure."],
["How does Simon's transformation complicate the story?",["He stays completely passive","He gains confidence and becomes more calculating","He forgets everyone","He becomes narrator"],1,"Simon gains agency and begins making strategic choices of his own."],
["Which best describes Rob?",["Charismatic but controlling","Shy but powerless","Unpopular and ignored","Kind but indecisive"],0,"Rob's charisma helps him gain influence, but he is deeply manipulative and control-focused."],
["What is a central warning of the novel?",["Popularity and power can have destructive consequences","Football is always dangerous","Schoolwork is unnecessary","Quiet people solve every conflict"],0,"Bullying, status, manipulation, jealousy, and unchecked power can escalate into devastating consequences."],
["Which idea best fits the novel's title?",["A literal window breaks","Social identities and relationships can be shattered","Glass is Simon's hobby","The school is made of glass"],1,"The title can be read as a metaphor for identities, trust, and social structures breaking apart."]
].map((x,i)=>({id:i,q:x[0],choices:x[1],answer:x[2],explanation:x[3]}));

const EVENTS=[
{name:"DOUBLE COINS",desc:"Everyone earns 2× coins on the next correct answer.",type:"double"},
{name:"STREAK RUSH",desc:"Any player on a 2+ streak gets a 300-point bonus this round.",type:"streak"},
{name:"GLASS SHIELD",desc:"Top 3 players are protected from the next steal.",type:"shield"},
{name:"SPEED ROUND",desc:"The next question is 8 seconds long.",type:"speed"},
{name:"LUCKY BREAK",desc:"All correct answers receive +250 bonus points.",type:"bonus"}
];

const POWERUPS=[
{name:"2X",cost:120,desc:"Double your points on your next correct answer.",type:"double"},
{name:"SHIELD",cost:160,desc:"Blocks the next steal against you.",type:"shield"},
{name:"STEAL",cost:220,desc:"Steal 15% of a random opponent's points after a correct answer.",type:"steal"},
{name:"FREEZE",cost:180,desc:"Cut the next question timer by 3 seconds for everyone else.",type:"freeze"}
];

const rooms=new Map();
function code(){let c;do{c=Math.random().toString(36).slice(2,7).toUpperCase()}while(rooms.has(c));return c}
function pub(r){return {code:r.code,phase:r.phase,index:r.index,total:r.questions.length,duration:r.duration,event:r.event?{name:r.event.name,desc:r.event.desc}:null,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,avatar:p.avatar,score:p.score,coins:p.coins,streak:p.streak,answered:p.answered,powerups:p.powerups}))}}
function emit(r){io.to(r.code).emit("room:update",pub(r))}
function rankings(r){return [...r.players.values()].sort((a,b)=>b.score-a.score)}
function begin(r){
 clearTimeout(r.timer);r.phase="question";r.started=Date.now();
 for(const p of r.players.values()){p.answered=false;p.lastCorrect=false}
 let duration=r.event?.type==="speed"?8:r.duration;
 if([...r.players.values()].some(p=>p.pendingFreeze)) duration=Math.max(6,duration-3);
 r.currentDuration=duration;
 io.to(r.code).emit("question:start",{index:r.index,total:r.questions.length,question:r.questions[r.index].q,choices:r.questions[r.index].choices,duration,event:r.event?{name:r.event.name,desc:r.event.desc}:null});
 emit(r);r.timer=setTimeout(()=>reveal(r),duration*1000)
}
function reveal(r){
 if(!rooms.has(r.code))return;clearTimeout(r.timer);r.phase="reveal";
 const q=r.questions[r.index];
 io.to(r.code).emit("question:reveal",{index:r.index,total:r.questions.length,answer:q.answer,explanation:q.explanation,correctChoice:q.choices[q.answer],leaderboard:rankings(r).map(p=>({name:p.name,avatar:p.avatar,score:p.score,coins:p.coins}))});
 emit(r)
}
function grantEvent(r){
 r.event=null;
 if(Math.random()<0.72)r.event=EVENTS[Math.floor(Math.random()*EVENTS.length)];
}
function resetScores(r){
 for(const p of r.players.values()){p.score=0;p.coins=0;p.streak=0;p.answered=false;p.powerups=Object.fromEntries(POWERUPS.map(x=>[x.type,0]));p.pendingDouble=false;p.pendingFreeze=false;p.pendingShield=false}
}

io.on("connection",s=>{
 s.on("host:create",({duration=15}={})=>{
  const c=code();const r={code:c,host:s.id,phase:"lobby",index:0,duration:Math.max(8,Math.min(30,Number(duration)||15)),currentDuration:Number(duration)||15,questions:QUESTIONS,event:null,players:new Map(),timer:null};
  rooms.set(c,r);s.join(c);s.data.room=c;s.data.role="host";s.emit("host:created",{code:c});emit(r)
 });
 s.on("player:join",({code:c,name,avatar="A"})=>{
  c=String(c||"").trim().toUpperCase();name=String(name||"").trim().replace(/\s+/g," ").slice(0,18);
  const r=rooms.get(c);if(!r)return s.emit("join:error","Room not found.");if(r.phase!=="lobby")return s.emit("join:error","That game has already started.");if(!name)return s.emit("join:error","Enter a nickname.");
  if([...r.players.values()].some(p=>p.name.toLowerCase()===name.toLowerCase()))return s.emit("join:error","That nickname is already taken.");
  const p={id:s.id,name,avatar:String(avatar).slice(0,2),score:0,coins:100,streak:0,answered:false,lastCorrect:false,powerups:Object.fromEntries(POWERUPS.map(x=>[x.type,0])),pendingDouble:false,pendingFreeze:false,pendingShield:false};
  r.players.set(s.id,p);s.join(c);s.data.room=c;s.data.role="player";s.emit("player:joined",{code:c,name,avatar:p.avatar});emit(r)
 });
 s.on("host:start",()=>{
  const r=rooms.get(s.data.room);if(!r||r.host!==s.id||r.phase!=="lobby")return;if(!r.players.size)return;
  r.index=0;grantEvent(r);begin(r)
 });
 s.on("player:powerup",({type})=>{
  const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!r||!p||r.phase!=="question")return;
  const item=POWERUPS.find(x=>x.type===type);if(!item||!(p.powerups[type]>0))return;
  p.powerups[type]--;p.coins=Math.max(0,p.coins);
  if(type==="double")p.pendingDouble=true;
  if(type==="shield")p.pendingShield=true;
  if(type==="freeze"){p.pendingFreeze=true}
  if(type==="steal")p.pendingSteal=true;
  s.emit("powerup:used",{type});emit(r)
 });
 s.on("player:buy",({type})=>{
  const r=rooms.get(s.data.room),p=r?.players.get(s.id),item=POWERUPS.find(x=>x.type===type);if(!r||!p||!item)return;
  if(p.coins<item.cost)return s.emit("shop:error","Not enough coins.");
  p.coins-=item.cost;p.powerups[type]++;s.emit("shop:ok",{type});emit(r)
 });
 s.on("player:answer",({choice})=>{
  const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!r||!p||r.phase!=="question"||p.answered)return;
  const q=r.questions[r.index],selected=Number(choice);if(!Number.isInteger(selected)||selected<0||selected>=q.choices.length)return;
  p.answered=true;const correct=selected===q.answer;p.lastCorrect=correct;
  if(correct){
   p.streak++;let elapsed=Date.now()-r.started;let speed=Math.max(0,1-elapsed/(r.currentDuration*1000));let pts=400+Math.round(600*speed)+Math.min(800,(p.streak-1)*100);
   if(p.pendingDouble){pts*=2;p.pendingDouble=false}
   if(r.event?.type==="double")p.coins+=30;
   if(r.event?.type==="bonus")pts+=250;
   if(r.event?.type==="streak"&&p.streak>=2)pts+=300;
   p.score+=pts;p.coins+=50+Math.min(50,p.streak*5);
   if(p.pendingSteal){
    const targets=rankings(r).filter(x=>x.id!==p.id&&x.score>0);if(targets.length){const t=targets[Math.floor(Math.random()*targets.length)];const stolen=Math.max(50,Math.round(t.score*.15));if(!t.pendingShield){t.score=Math.max(0,t.score-stolen);p.score+=stolen}}
    p.pendingSteal=false;
   }
  }else{p.streak=0}
  s.emit("answer:result",{correct,correctChoice:q.choices[q.answer],score:p.score,coins:p.coins,streak:p.streak});emit(r)
 });
 s.on("host:next",()=>{
  const r=rooms.get(s.data.room);if(!r||r.host!==s.id||r.phase!=="reveal")return;
  if(r.index>=r.questions.length-1){r.phase="finished";io.to(r.code).emit("game:finished",{leaderboard:rankings(r).map((p,i)=>({rank:i+1,name:p.name,avatar:p.avatar,score:p.score,coins:p.coins}))});emit(r);return}
  for(const p of r.players.values())p.pendingFreeze=false; r.index++;grantEvent(r);begin(r)
 });
 s.on("host:reset",()=>{const r=rooms.get(s.data.room);if(!r||r.host!==s.id)return;clearTimeout(r.timer);r.phase="lobby";r.index=0;r.event=null;resetScores(r);emit(r)});
 s.on("disconnect",()=>{const r=rooms.get(s.data.room);if(!r)return;if(r.host===s.id){r.host=null;io.to(r.code).emit("host:left")}if(r.players.delete(s.id))emit(r);if(!r.host&&!r.players.size){clearTimeout(r.timer);rooms.delete(r.code)}})
});
server.listen(PORT,()=>console.log("Running on "+PORT));