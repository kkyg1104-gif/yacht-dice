import {joinRoom, selfId} from 'https://esm.run/trystero@0.25.3'

const CATS=[
 {id:'ones',name:'에이스',icon:'1',desc:'숫자 1의 합'}, {id:'twos',name:'듀스',icon:'2',desc:'숫자 2의 합'},
 {id:'threes',name:'트레이',icon:'3',desc:'숫자 3의 합'}, {id:'fours',name:'포',icon:'4',desc:'숫자 4의 합'},
 {id:'fives',name:'파이브',icon:'5',desc:'숫자 5의 합'}, {id:'sixes',name:'식스',icon:'6',desc:'숫자 6의 합'},
 {id:'choice',name:'초이스',icon:'Σ',desc:'모든 주사위의 합'}, {id:'four',name:'포 오브 어 카인드',icon:'4×',desc:'같은 숫자 4개 이상'},
 {id:'full',name:'풀 하우스',icon:'3·2',desc:'같은 숫자 3개 + 2개'}, {id:'small',name:'스몰 스트레이트',icon:'↗',desc:'연속된 숫자 4개 · 15점'},
 {id:'large',name:'라지 스트레이트',icon:'⇗',desc:'연속된 숫자 5개 · 30점'}, {id:'yacht',name:'요트',icon:'⚓',desc:'모두 같은 숫자 · 50점'}
]
const APP_ID='io.github.kkyg1104-gif.yacht-dice.v1'
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)]
const blankState=()=>({dice:[1,2,3,4,5],held:[false,false,false,false,false],rolls:0,players:[],current:0,round:1,sound:true,rolling:false,started:false,finished:false,version:0})
let state=blankState()
const net={mode:'local',room:null,isHost:false,roomCode:'',playerId:'',hostPeerId:'',actions:null,peers:new Set(),joinTimer:null}
let ac

const esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))
const cleanName=s=>(String(s||'').trim().replace(/[<>]/g,'').slice(0,10)||'익명 선장')
const randomId=()=>crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint32Array(4)),x=>x.toString(36)).join('')
const randomDie=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%6+1}
const randomCode=()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',a=new Uint32Array(6);crypto.getRandomValues(a);return [...a].map(x=>chars[x%chars.length]).join('')}
const openModal=id=>$('#'+id).classList.add('open')
const closeModal=id=>$('#'+id).classList.remove('open')

function score(id,d){const counts=Array(7).fill(0);d.forEach(x=>counts[x]++);const sum=d.reduce((a,b)=>a+b,0),uniq=[...new Set(d)].sort()
 if(['ones','twos','threes','fours','fives','sixes'].includes(id)){const n=['ones','twos','threes','fours','fives','sixes'].indexOf(id)+1;return counts[n]*n}
 if(id==='choice')return sum;if(id==='four')return counts.some(x=>x>=4)?sum:0;if(id==='full')return counts.includes(3)&&counts.includes(2)?sum:0
 if(id==='small')return ([1,2,3,4].every(x=>uniq.includes(x))||[2,3,4,5].every(x=>uniq.includes(x))||[3,4,5,6].every(x=>uniq.includes(x)))?15:0
 if(id==='large')return (uniq.join('')==='12345'||uniq.join('')==='23456')?30:0;if(id==='yacht')return counts.includes(5)?50:0;return 0}
function total(p){const base=Object.values(p.scores||{}).reduce((a,b)=>a+b,0),upper=CATS.slice(0,6).reduce((a,c)=>a+(p.scores?.[c.id]||0),0);return base+(upper>=63?35:0)}
function pips(n){const maps={1:[4],2:[1,7],3:[1,4,7],4:[1,2,6,7],5:[1,2,4,6,7],6:[1,2,3,5,6,7]};return maps[n].map(p=>`<i class="pip p${p}"></i>`).join('')}
const cubeFaces=()=>[1,2,3,4,5,6].map(n=>`<span class="die-face face-${n}">${pips(n)}</span>`).join('')
function faceAngles(n){return ({1:[0,0],2:[-90,0],3:[0,-90],4:[0,90],5:[90,0],6:[0,180]})[n]}
function isMyTurn(){if(net.mode==='local')return true;return state.players[state.current]?.id===net.playerId}
function canAct(){return state.started&&!state.finished&&!state.rolling&&isMyTurn()}

function renderDice(animate=false){const enabled=canAct()&&state.rolls>0,drifts=[-15,10,-8,14,-11];$('#diceRow').innerHTML=state.dice.map((n,i)=>{const [fx,fy]=faceAngles(n),moving=animate&&!state.held[i];return `<div class="die-wrap ${moving?'rolling-wrap':''}" style="--fx:${fx}deg;--fy:${fy}deg;--delay:${i*42}ms;--drift:${drifts[i]}px"><button class="die ${state.held[i]?'held':''} ${moving?'rolling':''}" data-i="${i}" aria-label="주사위 ${n}${state.held[i]?', 고정됨':''}" ${enabled?'':'disabled'}><span class="die-cube">${cubeFaces()}</span></button><span class="hold-label">${state.held[i]?'HOLD':' '}</span></div>`}).join('');$$('.die').forEach(x=>x.onclick=()=>toggleHold(+x.dataset.i))}
function render(){const p=state.players[state.current];if(!p){renderDice();return}
 const mine=isMyTurn();$('#turnTitle').textContent=`${p.name} 선장의 차례`;$('#turnSub').textContent=!mine&&net.mode==='online'?'다른 선장의 선택이 실시간으로 반영됩니다.':state.rolls?`${state.rolls}번째 항해. ${3-state.rolls}번 더 굴릴 수 있습니다.`:'새로운 조합을 향해 주사위를 굴려보세요.';$('#roundNo').textContent=String(state.round).padStart(2,'0')
 $$('.roll-track i').forEach((x,i)=>x.classList.toggle('used',i<state.rolls));$('#rollBtn').disabled=!canAct()||state.rolls>=3;$('#rollBtn').textContent=!mine&&net.mode==='online'?'상대 차례입니다':state.rolls===0?'주사위 굴리기':state.rolls<3?'다시 굴리기':'점수를 선택하세요';$('#spectatorNote').classList.toggle('show',net.mode==='online'&&!mine)
 $('#players').innerHTML=state.players.map((x,i)=>`<button class="player-tab ${i===state.current?'active':''}" data-i="${i}">${esc(x.name)}${x.connected===false?' ◌':''} · ${total(x)}</button>`).join('');$$('.player-tab').forEach(b=>b.onclick=()=>{if(+b.dataset.i!==state.current)toast('점수표에는 현재 차례의 선장이 표시됩니다')})
 $('#totalScore').textContent=total(p);renderScores();renderDice(state.rolling);$('#bestScore').textContent=+(localStorage.getItem('yachtBest')||0)+'점'
 $('#netBadge').classList.toggle('show',net.mode==='online');if(net.mode==='online')$('#netLabel').textContent=`${net.roomCode} · ${state.players.length}명`}
function renderScores(){const p=state.players[state.current];if(!p)return;const available=state.rolls>0&&canAct(),preview=state.rolls>0;let recommendation=null,best=-1
 if(preview)CATS.filter(c=>p.scores[c.id]===undefined).forEach(c=>{const v=score(c.id,state.dice);if(v>best){best=v;recommendation=c.id}})
 let html='<div class="section-label"><span>NUMBER</span><span>상단 합계</span></div>'
 CATS.forEach((c,idx)=>{if(idx===6){const up=CATS.slice(0,6).reduce((a,x)=>a+(p.scores[x.id]||0),0);html+=`<div class="bonus"><div>상단 보너스 <b>${up>=63?'달성 +35':'63점 이상 +35'}</b><div class="bonus-track"><i style="width:${Math.min(100,up/63*100)}%"></i></div></div><strong>${up} / 63</strong></div><div class="section-label"><span>COMBINATION</span><span>조합 점수</span></div>`}
  const filled=p.scores[c.id]!==undefined,v=filled?p.scores[c.id]:(preview?score(c.id,state.dice):null),rec=!filled&&preview&&c.id===recommendation&&best>0
  html+=`<button class="score-row ${filled?'filled':available?'available':''} ${rec?'recommended':''}" data-id="${c.id}" ${!available||filled?'disabled':''}><span class="cat-icon">${c.icon}</span><span><span class="cat-name">${c.name}${rec?'<i class="tag">추천</i>':''}</span><span class="cat-desc">${c.desc}</span></span><span class="score-value ${!filled&&preview?'preview':''} ${v===0?'zero':''}">${v??'—'}</span></button>`})
 $('#scoreList').innerHTML=html;$$('.score-row.available').forEach(b=>b.onclick=()=>selectScore(b.dataset.id))
 if(preview){const rc=CATS.find(c=>c.id===recommendation);$('#tipTitle').textContent=best>0?`${rc.name} ${best}점 가능`:'선택이 필요한 순간';$('#tipText').textContent=best>0?'추천 칸이 민트색으로 표시되어 있습니다.':'0점 처리할 칸을 전략적으로 골라보세요.'}}

function toggleHold(i){if(!canAct()||state.rolls===0)return;tone(state.held[i]?320:520,.05);dispatchIntent({type:'hold',index:i})}
function roll(){if(!canAct()||state.rolls>=3)return;dispatchIntent({type:'roll'})}
function selectScore(id){if(!canAct()||state.rolls===0)return;dispatchIntent({type:'score',category:id})}
function dispatchIntent(intent){if(net.mode==='online'){if(net.isHost)hostApplyIntent(intent,net.playerId);else if(net.actions&&net.hostPeerId)net.actions.intent.send(intent,{target:net.hostPeerId});else toast('방장과 연결 중입니다')}else localApplyIntent(intent)}
function localApplyIntent(intent){if(intent.type==='hold'){state.held[intent.index]=!state.held[intent.index];render();return}if(intent.type==='roll'){performRoll(false);return}if(intent.type==='score')commitScore(intent.category,false)}
function hostApplyIntent(intent,playerId){if(!net.isHost||!state.started||state.finished)return;const active=state.players[state.current];if(!active||active.id!==playerId||state.rolling)return
 if(intent.type==='hold'&&state.rolls>0&&Number.isInteger(intent.index)&&intent.index>=0&&intent.index<5){state.held[intent.index]=!state.held[intent.index];broadcastState();render()}
 if(intent.type==='roll'&&state.rolls<3)performRoll(true)
 if(intent.type==='score'&&state.rolls>0&&CATS.some(c=>c.id===intent.category)&&active.scores[intent.category]===undefined)commitScore(intent.category,true)}
function performRoll(sync){const moving=state.held.map((held,i)=>held?null:i).filter(i=>i!==null),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,duration=reduced?220:1090;state.dice=state.dice.map((n,i)=>state.held[i]?n:randomDie());state.rolling=true;tone(145,.075,'triangle');if(sync)broadcastState();render();if(!reduced)moving.forEach((i,k)=>setTimeout(()=>tone(125+i*17,.032,'triangle'),760+k*43));setTimeout(()=>{state.rolls++;state.rolling=false;render();tone(205,.045,'sine');if(sync)broadcastState()},duration)}
function commitScore(id,sync){const p=state.players[state.current],v=score(id,state.dice),cat=CATS.find(c=>c.id===id);p.scores[id]=v;tone(v>=30?760:500,.1);toast(`${cat.name}에 ${v}점 기록!`);if(v>=50)celebrate();nextTurn(sync)}
function nextTurn(sync){state.rolls=0;state.held=[false,false,false,false,false];state.dice=[1,2,3,4,5];if(state.current<state.players.length-1)state.current++;else{state.current=0;state.round++}if(state.round>12){state.finished=true;state.started=false;showResults()}render();if(sync)broadcastState()}
function showResults(){const sorted=[...state.players].sort((a,b)=>total(b)-total(a)),high=total(sorted[0]);$('#winnerTitle').textContent=state.players.length===1?`${high}점, 멋진 항해였습니다!`:`${sorted[0].name} 선장 승리!`;$('#ranking').innerHTML=sorted.map((p,i)=>`<div class="rank"><span>${['🥇','🥈','🥉','⚓'][i]} ${esc(p.name)}</span><b>${total(p)}점</b></div>`).join('');if(high>+(localStorage.getItem('yachtBest')||0))localStorage.setItem('yachtBest',high);openModal('resultModal');celebrate()}

function openSetup(){if(net.mode==='online')leaveOnline();const n=state.players.length||1;$$('.mode').forEach(x=>x.classList.toggle('active',+x.dataset.n===n));renderNames(Math.min(4,n));openModal('setupModal')}
function renderNames(n){const old=state.players.map(x=>x.name);$('#names').innerHTML=Array.from({length:n},(_,i)=>`<input id="captain-${i+1}" name="captain-${i+1}" maxlength="10" value="${esc(old[i]||`선장${i+1}`)}" aria-label="${i+1}번 선장 이름">`).join('')}
function startLocal(){const names=$$('#names input').map((x,i)=>String(x.value||'').trim()?cleanName(x.value):`선장${i+1}`);state=blankState();state.players=names.map((name,i)=>({id:`local-${i}`,name,scores:{},connected:true}));state.started=true;net.mode='local';closeModal('setupModal');render();toast('순풍을 빕니다. 첫 항해를 시작합니다!')}

function playerToken(code){const key=`yacht-player-${code}`;let id=sessionStorage.getItem(key);if(!id){id=randomId();sessionStorage.setItem(key,id)}return id}
function publicState(){return JSON.parse(JSON.stringify(state))}
function broadcastState(){if(!net.isHost||!net.actions)return;state.version++;net.actions.state.send(publicState());renderLobby()}
function applyRemoteState(next){if(!next||typeof next.version!=='number'||next.version<state.version)return;const wasRolling=state.rolling;state=next;state.sound=$('#soundBtn').textContent!=='×';if(state.started){closeModal('onlineModal');closeModal('lobbyModal')}else if(!state.finished)openModal('lobbyModal');render();renderLobby();if(!wasRolling&&state.rolling)renderDice(true);if(state.finished)showResults()}
function createOnline(){const name=cleanName($('#onlineName').value);localStorage.setItem('yachtName',name);const code=randomCode();joinOnline(code,name,true)}
function joinOnlineFromForm(){const name=cleanName($('#onlineName').value),code=$('#joinCode').value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);if(code.length!==6){toast('6자리 방 코드를 입력해 주세요');return}localStorage.setItem('yachtName',name);joinOnline(code,name,false)}
function joinOnline(code,name,isHost){leaveOnline(false);state=blankState();net.mode='online';net.roomCode=code;net.isHost=isHost;net.playerId=playerToken(code);net.hostPeerId=isHost?selfId:'';$('#onlineStatus').innerHTML='<div class="loading-ring"></div><div class="room-caption">온라인 선착장에 연결 중입니다…</div>'
 try{const room=joinRoom({appId:APP_ID},`room-${code}`);net.room=room;const hello=room.makeAction('hello'),welcome=room.makeAction('welcome'),stateAction=room.makeAction('state'),intent=room.makeAction('intent');net.actions={hello,welcome,state:stateAction,intent}
  room.onPeerJoin=peerId=>{net.peers.add(peerId);if(!net.isHost)hello.send({playerId:net.playerId,name},{target:peerId});renderLobby()}
  room.onPeerLeave=peerId=>handlePeerLeave(peerId)
  hello.onMessage=(data,{peerId})=>handleHello(data,peerId)
  welcome.onMessage=(data,{peerId})=>handleWelcome(data,peerId)
  stateAction.onMessage=(data,{peerId})=>{if(!net.isHost&&peerId===net.hostPeerId)applyRemoteState(data)}
  intent.onMessage=(data,{peerId})=>{if(net.isHost){const p=state.players.find(x=>x.peerId===peerId);if(p)hostApplyIntent(data,p.id)}}
  if(isHost){state.players=[{id:net.playerId,name,scores:{},connected:true,peerId:selfId,host:true}];$('#onlineStatus').innerHTML='';closeModal('onlineModal');openModal('lobbyModal');updateRoomUrl();renderLobby();render()}
  else{openModal('onlineModal');$('#onlineStatus').innerHTML='<div class="loading-ring"></div><div class="room-caption">방장을 찾는 중입니다…</div>';net.joinTimer=setTimeout(()=>{if(!net.hostPeerId)$('#onlineStatus').innerHTML='<div class="lobby-note">아직 방장을 찾지 못했습니다. 코드와 방장 접속 상태를 확인해 주세요.</div>'},12000)}
 }catch(e){console.error(e);$('#onlineStatus').innerHTML='<div class="lobby-note">온라인 연결을 시작하지 못했습니다. 네트워크를 확인해 주세요.</div>';toast('온라인 연결 실패')}}
function handleHello(data,peerId){if(!net.isHost||!data)return;const id=String(data.playerId||''),name=cleanName(data.name);let p=state.players.find(x=>x.id===id)
 if(!p&&state.started){net.actions.welcome.send({accepted:false,reason:'이미 게임이 시작되었습니다.'},{target:peerId});return}if(!p&&state.players.length>=4){net.actions.welcome.send({accepted:false,reason:'방이 가득 찼습니다.'},{target:peerId});return}
 if(p){p.connected=true;p.peerId=peerId;p.name=name}else{p={id,name,scores:{},connected:true,peerId,host:false};state.players.push(p)}
 state.version++;net.actions.welcome.send({accepted:true,hostPeerId:selfId,playerId:id,state:publicState()},{target:peerId});broadcastState();renderLobby();toast(`${name} 선장이 입장했습니다`)}
function handleWelcome(data,peerId){if(net.isHost||!data)return;if(!data.accepted){clearTimeout(net.joinTimer);$('#onlineStatus').innerHTML=`<div class="lobby-note">${esc(data.reason||'입장할 수 없습니다.')}</div>`;return}clearTimeout(net.joinTimer);$('#onlineStatus').innerHTML='';net.hostPeerId=peerId;net.playerId=data.playerId;applyRemoteState(data.state);closeModal('onlineModal');updateRoomUrl();openModal('lobbyModal');renderLobby();toast('온라인 방에 입장했습니다')}
function handlePeerLeave(peerId){net.peers.delete(peerId);if(net.isHost){const p=state.players.find(x=>x.peerId===peerId);if(p){if(state.started)p.connected=false;else state.players=state.players.filter(x=>x!==p);broadcastState();toast(`${p.name} 선장의 연결이 끊겼습니다`)}}else if(peerId===net.hostPeerId){net.hostPeerId='';state.started=false;render();openModal('onlineModal');$('#onlineStatus').innerHTML='<div class="lobby-note">방장 연결이 끊겼습니다. 방장이 돌아오면 같은 코드로 다시 참가해 주세요.</div>';toast('방장과 연결이 끊겼습니다')}}
function renderLobby(){if(net.mode!=='online')return;$('#roomCodeText').textContent=net.roomCode;$('#lobbyList').innerHTML=state.players.map((p,i)=>`<div class="lobby-player"><span><i class="avatar">${i+1}</i>${esc(p.name)} ${p.host?'<i class="host-tag">방장</i>':''}</span><span class="presence ${p.connected===false?'off':''}">${p.connected===false?'연결 끊김':'접속 중'}</span></div>`).join('')+Array.from({length:Math.max(0,2-state.players.length)},()=>'<div class="lobby-player"><span style="color:var(--muted)">참가자를 기다리는 중…</span></div>').join('');$('#onlineStartBtn').style.display=net.isHost?'block':'none';$('#onlineStartBtn').disabled=state.players.length<2||state.players.some(p=>p.connected===false);$('#lobbyNote').textContent=net.isHost?state.players.length<2?'초대 링크를 보내고 한 명 이상 기다려 주세요.':'방장입니다. 참가 인원을 확인한 뒤 시작하세요.':'방장이 게임을 시작하기를 기다리고 있습니다.'}
function startOnlineGame(){if(!net.isHost||state.players.length<2||state.players.length>4)return;state.current=0;state.round=1;state.rolls=0;state.held=[false,false,false,false,false];state.dice=[1,2,3,4,5];state.started=true;state.finished=false;closeModal('lobbyModal');broadcastState();render();toast('온라인 항해를 시작합니다!')}
function leaveOnline(showSetup=true){clearTimeout(net.joinTimer);try{net.room?.leave()}catch{}net.room=null;net.actions=null;net.peers.clear();net.mode='local';net.isHost=false;net.hostPeerId='';net.roomCode='';$('#netBadge').classList.remove('show');history.replaceState(null,'',location.pathname);closeModal('lobbyModal');closeModal('onlineModal');if(showSetup){state=blankState();renderDice();openSetup()}}
function updateRoomUrl(){const u=new URL(location.href);u.searchParams.set('room',net.roomCode);history.replaceState(null,'',u)}
async function copyText(text,msg){try{await navigator.clipboard.writeText(text);toast(msg)}catch{prompt('복사해 주세요',text)}}
function inviteUrl(){const u=new URL(location.href);u.searchParams.set('room',net.roomCode);return u.toString()}

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),1900)}
function tone(freq,dur,type='sine'){if(!state.sound)return;try{ac=ac||new (AudioContext||webkitAudioContext)();const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.045,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur);o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+dur)}catch{}}
function celebrate(){const c=$('#confetti'),x=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;const colors=['#68e0cf','#f3c66b','#ff806f','#fff'],ps=Array.from({length:130},()=>({x:innerWidth/2,y:innerHeight*.35,vx:(Math.random()-.5)*14,vy:-Math.random()*11-3,g:.26+Math.random()*.14,r:2+Math.random()*5,c:colors[Math.random()*4|0],a:1}));let f=0;(function go(){x.clearRect(0,0,c.width,c.height);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=p.g;p.a-=.008;x.globalAlpha=Math.max(0,p.a);x.fillStyle=p.c;x.fillRect(p.x,p.y,p.r,p.r*1.8)});x.globalAlpha=1;if(f++<130)requestAnimationFrame(go);else x.clearRect(0,0,c.width,c.height)})()}

$('#rollBtn').onclick=roll;$('#newBtn').onclick=openSetup;$('#rulesBtn').onclick=()=>openModal('rulesModal');$('#soundBtn').onclick=()=>{state.sound=!state.sound;$('#soundBtn').textContent=state.sound?'♪':'×';toast(state.sound?'사운드를 켰습니다':'사운드를 껐습니다')};$('#startBtn').onclick=startLocal;$('#onlineBtn').onclick=()=>{closeModal('setupModal');$('#onlineName').value=localStorage.getItem('yachtName')||'영기';openModal('onlineModal')};$('#createRoomBtn').onclick=createOnline;$('#joinRoomBtn').onclick=joinOnlineFromForm;$('#onlineStartBtn').onclick=startOnlineGame;$('#leaveRoomBtn').onclick=()=>leaveOnline(true);$('#copyLinkBtn').onclick=()=>copyText(inviteUrl(),'초대 링크를 복사했습니다');$('#copyCodeBtn').onclick=()=>copyText(net.roomCode,'방 코드를 복사했습니다');$('#againBtn').onclick=()=>{closeModal('resultModal');openSetup()}
$$('.close').forEach(x=>x.onclick=()=>closeModal(x.dataset.close));$$('.mode').forEach(x=>x.onclick=()=>{$$('.mode').forEach(y=>y.classList.remove('active'));x.classList.add('active');renderNames(+x.dataset.n)});$('#joinCode').oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);document.addEventListener('keydown',e=>{if(e.code==='Space'&&!$('.modal.open')){e.preventDefault();roll()}});addEventListener('beforeunload',()=>{try{net.room?.leave()}catch{}})
$('#ruleList').innerHTML=CATS.map(c=>`<div class="rule"><b>${c.icon}</b><span>${c.name}<small style="display:block;color:#68898c">${c.desc}</small></span><b>${c.id==='yacht'?'50':c.id==='large'?'30':c.id==='small'?'15':'가변'}</b></div>`).join('');renderDice();renderNames(1)
const invited=new URLSearchParams(location.search).get('room')?.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6);if(invited?.length===6){$('#onlineName').value=localStorage.getItem('yachtName')||'영기';$('#joinCode').value=invited;openModal('onlineModal')}else openModal('setupModal')

// Test hooks are read-only helpers used by automated QA.
window.__YACHT_TEST__={score,total,getState:()=>publicState(),getNet:()=>({mode:net.mode,isHost:net.isHost,roomCode:net.roomCode,playerId:net.playerId,hostPeerId:net.hostPeerId})}
