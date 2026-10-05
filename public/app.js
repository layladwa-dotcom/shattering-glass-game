const socket=io();
const $=id=>document.getElementById(id);
const screens=["home","hostSetup","hostLobby","hostGame","join","playerLobby","playerGame","minigameHost","minigamePlayer","finished"];
let role=null,code="",duration=15,timer=null,selected=null,myAvatar="🦊",state=null,miniSelected=null;

const powers=[
 {type:"double",label:"2X",cost:120,desc:"Double your next correct-answer points."},
 {type:"shield",label:"🛡",cost:160,desc:"Blocks the next steal."},
 {type:"steal",label:"STEAL",cost:220,desc:"Steal 15% of a random opponent's score after a correct answer."},
 {type:"freeze",label:"❄",cost:180,desc:"Cuts the next question timer by 3 seconds."}
];

function show(id){screens.forEach(x=>$(x).classList.toggle("active",x===id));scrollTo(0,0)}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
document.querySelectorAll("[data-back]").forEach(x=>x.onclick=()=>show("home"));
$("hostBtn").onclick=()=>show("hostSetup");
$("joinBtn").onclick=()=>show("join");
$("playAgain").onclick=()=>location.reload();
$("createRoom").onclick=()=>{duration=+$("duration").value;role="host";socket.emit("host:create",{duration})};
socket.on("host:created",x=>{code=x.code;$("roomCode").textContent=code;show("hostLobby")});
$("joinCode").oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");
$("joinGame").onclick=()=>{myAvatar=$("avatar").value;socket.emit("player:join",{code:$("joinCode").value,name:$("nickname").value,avatar:myAvatar})};
socket.on("join:error",x=>$("joinError").textContent=x);
socket.on("player:joined",x=>{code=x.code;myAvatar=x.avatar;$("playerWelcome").textContent=`Ready, ${x.name}!`;$("lobbyAvatar").textContent=myAvatar;$("playerRoomCode").textContent=code;show("playerLobby")});
$("startGame").onclick=()=>socket.emit("host:start");
$("resetLobby").onclick=()=>socket.emit("host:reset");

socket.on("room:update",r=>{
 state=r;
 $("playerCount").textContent=r.players.length;
 $("hostPlayers").textContent=r.players.length;
 $("mgHostPlayers").textContent=r.players.length;
 $("lobbyStatus").textContent=r.players.length+" online";
 $("answeredCount").textContent=r.players.filter(p=>p.answered).length+" answered";
 $("classAnswered").textContent=r.players.filter(p=>p.answered).length+" answered";
 $("classProgress").style.width=(r.players.length?100*r.players.filter(p=>p.answered).length/r.players.length:0)+"%";
 renderPlayers(r.players);renderBoard(r.players);
 const me=r.players.find(p=>p.id===socket.id);
 if(me){
  $("playerScore").textContent=me.score;$("playerCoins").textContent=me.coins;$("playerStreak").textContent=me.streak+" 🔥";
  $("mgPlayerScore").textContent=me.score;$("mgPlayerCoins").textContent=me.coins;$("mgPlayerStreak").textContent=me.streak+" 🔥";
  renderPowers(me);
 }
});

function renderPlayers(ps){$("lobbyPlayers").innerHTML=ps.map(p=>`<div class="player"><span class="av">${esc(p.avatar)}</span><span>${esc(p.name)}</span></div>`).join("")}
function renderBoard(ps){let a=[...ps].sort((x,y)=>y.score-x.score);$("leaderboard").innerHTML=a.map((p,i)=>`<div class="rank"><b>#${i+1}</b><span>${esc(p.avatar)} ${esc(p.name)}</span><strong>${p.score}</strong></div>`).join("")}
function countdown(n,hostId="hostTimer",playerId="playerTimer"){
 clearInterval(timer);let t=n;$(hostId).textContent=t;$(playerId).textContent=t;
 timer=setInterval(()=>{t--;$(hostId).textContent=Math.max(0,t);$(playerId).textContent=Math.max(0,t);if(t<=0)clearInterval(timer)},1000);
}
function miniCountdown(n){
 clearInterval(timer);let t=n;
 $("mgHostTimer").textContent=t;$("mgPlayerTimer").textContent=t;
 timer=setInterval(()=>{t--;$("mgHostTimer").textContent=Math.max(0,t);$("mgPlayerTimer").textContent=Math.max(0,t);if(t<=0)clearInterval(timer)},1000);
}
function eventUI(e,host){
 const el=$(host?"eventBanner":"playerEvent");
 if(!e){el.classList.add("hidden");return}
 el.classList.remove("hidden");el.innerHTML=`<b>⚡ ${esc(e.name)}</b> — ${esc(e.desc)}`;
}

socket.on("question:start",d=>{
 selected=null;countdown(d.duration);
 $("hostProgress").textContent=`${d.index+1} / ${d.total}`;
 $("playerProgress").textContent=`${d.index+1} / ${d.total}`;
 $("hostQuestion").textContent=d.question;$("playerQuestion").textContent=d.question;
 $("hostPhase").textContent="ANSWER NOW";$("answerFeedback").textContent="";$("answerFeedback").className="feedback";
 $("nextQuestion").disabled=true;eventUI(d.event,true);eventUI(d.event,false);
 $("hostChoices").innerHTML=d.choices.map((x,i)=>`<div class="choice"><b>${String.fromCharCode(65+i)}.</b> ${esc(x)}</div>`).join("");
 $("playerChoices").innerHTML="";
 d.choices.forEach((x,i)=>{
  let b=document.createElement("button");b.className="choice";b.innerHTML=`<b>${String.fromCharCode(65+i)}.</b> ${esc(x)}`;
  b.onclick=()=>{if(selected!==null)return;selected=i;b.classList.add("selected");[...$("playerChoices").children].forEach(z=>z.disabled=true);socket.emit("player:answer",{choice:i})};
  $("playerChoices").appendChild(b);
 });
 if(role==="host")show("hostGame");else show("playerGame");
});

socket.on("answer:result",r=>{
 $("playerScore").textContent=r.score;$("playerCoins").textContent=r.coins;$("playerStreak").textContent=r.streak+" 🔥";
 $("answerFeedback").textContent=r.correct?`✅ Correct! ${r.streak>=2?"Streak bonus active!":""}`:`❌ Not quite — answer: ${r.correctChoice}`;
 $("answerFeedback").className="feedback "+(r.correct?"good":"bad");
});

socket.on("question:reveal",d=>{
 clearInterval(timer);
 $("hostPhase").textContent="ANSWER REVEALED";$("nextQuestion").disabled=false;
 [...$("hostChoices").children].forEach((x,i)=>x.classList.toggle("correct",i===d.answer));
 [...$("playerChoices").children].forEach((x,i)=>{x.disabled=true;x.classList.toggle("correct",i===d.answer);if(selected===i&&i!==d.answer)x.classList.add("wrong")});
 $("answerFeedback").textContent=d.explanation;
});

$("nextQuestion").onclick=()=>socket.emit("host:next");
$("shopBtn").onclick=()=>{renderShop();$("shop").classList.remove("hidden")};
$("closeShop").onclick=()=>$("shop").classList.add("hidden");

function renderPowers(me){
 $("powerupBar").innerHTML=powers.map(p=>`<button class="power" onclick="usePower('${p.type}')" ${me.powerups[p.type]>0?"":"disabled"}>${p.label} <b>×${me.powerups[p.type]}</b></button>`).join("");
}
window.usePower=t=>{socket.emit("player:powerup",{type:t});$("shop").classList.add("hidden")};
function renderShop(){
 const me=state?.players.find(p=>p.id===socket.id);
 $("shopItems").innerHTML=powers.map(p=>`<div class="shopitem"><div><b>${p.label} — ${p.cost} 🪙</b><p>${p.desc}</p></div><button class="buy" onclick="buyPower('${p.type}')">Buy</button></div>`).join("");
}
window.buyPower=t=>socket.emit("player:buy",{type:t});
socket.on("shop:ok",()=>{renderShop()});
socket.on("shop:error",x=>alert(x));

function setupMiniGameButtons(d){
 miniSelected=null;
 const choices=$("mgPlayerChoices");
 choices.innerHTML="";
 if(d.type==="target"){
  $("mgPlayerHint").textContent="Pick the number you think the secret target will be.";
  [1,2,3,4,5].forEach(n=>addMiniChoice(String(n),n));
 }else if(d.type==="coinflip"){
  $("mgPlayerHint").textContent="Pick heads or tails before the timer hits zero.";
  addMiniChoice("HEADS","heads");addMiniChoice("TAILS","tails");
 }else{
  $("mgPlayerHint").textContent="Pick a vault. One is a jackpot, one is a small stash, and one is a trap.";
  ["A","B","C"].forEach((label,i)=>addMiniChoice(`🔐 VAULT ${label}`,String(i+1)));
 }
 function addMiniChoice(label,value){
  const b=document.createElement("button");b.className="mg-choice";b.textContent=label;
  b.onclick=()=>{if(miniSelected!==null)return;miniSelected=value;b.classList.add("selected");[...choices.children].forEach(x=>x.disabled=true);$("mgPlayerStatus").textContent="Locked in! Watch the reveal.";socket.emit("player:minigameChoice",{choice:value})};
  choices.appendChild(b);
 }
}

socket.on("minigame:start",d=>{
 clearInterval(timer);
 $("mgHostName").textContent=d.name;$("mgHostTitle").textContent=d.name;$("mgHostDesc").textContent=d.desc;
 $("mgHostHint").textContent=d.type==="target"?"The secret target is hidden until the reveal.":d.type==="coinflip"?"The coin is hidden until the reveal.":"One vault is a jackpot, one is a small stash, and one is a trap.";
 $("mgHostResults").innerHTML="";
 $("mgHostNext").disabled=true;
 $("mgPlayerName").textContent=d.name;$("mgPlayerTitle").textContent=d.name;$("mgPlayerDesc").textContent=d.desc;$("mgPlayerStatus").textContent="";
 setupMiniGameButtons(d);miniCountdown(d.duration);
 if(role==="host")show("minigameHost");else show("minigamePlayer");
});

socket.on("minigame:choice",d=>{if(role==="player")$("mgPlayerStatus").textContent="🔒 Choice locked in!"});

socket.on("minigame:reveal",d=>{
 clearInterval(timer);$("mgHostNext").disabled=false;
 let secretText=d.type==="target"?`🎯 Secret target: ${d.secret}`:d.type==="coinflip"?`🪙 The coin landed: ${String(d.secret).toUpperCase()}`:`🏦 Jackpot vault: ${["A","B","C"][Number(d.secret)-1]}`;
 $("mgHostHint").textContent=secretText;
 $("mgPlayerStatus").textContent=secretText;
 const sorted=[...d.results].sort((a,b)=>b.delta-a.delta);
 $("mgHostResults").innerHTML=sorted.map(x=>`<div class="rank"><b>${esc(x.avatar)}</b><span>${esc(x.name)} — ${esc(x.message)}</span><strong>${x.delta>=0?"+":""}${x.delta} pts</strong></div>`).join("");
 const me=d.results.find(x=>x.id===socket.id);
 if(me){$("mgPlayerScore").textContent=me.score;$("mgPlayerCoins").textContent=me.totalCoins;$("playerScore").textContent=me.score;$("playerCoins").textContent=me.totalCoins}
});

$("mgHostNext").onclick=()=>socket.emit("host:minigameNext");

socket.on("game:finished",d=>{
 clearInterval(timer);
 let p=d.leaderboard;
 $("podium").innerHTML=p.slice(0,3).map((x,i)=>`<div class="pod ${i===0?"first":i===1?"second":"third"}"><div class="av">${esc(x.avatar)}</div><b>${["🥇","🥈","🥉"][i]}</b><div>${esc(x.name)}</div><strong>${x.score}</strong></div>`).join("");
 $("finalLeaderboard").innerHTML=p.map(x=>`<div class="rank"><b>#${x.rank}</b><span>${esc(x.avatar)} ${esc(x.name)}</span><strong>${x.score}</strong></div>`).join("");
 show("finished");
});

socket.on("host:left",()=>{if(role==="player"){alert("The teacher disconnected.");location.reload()}});
