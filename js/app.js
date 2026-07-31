var SUPABASE_URL='https://jnhetrqhizfuxwfnjcoh.supabase.co';
var SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaGV0cnFoaXpmdXh3Zm5qY29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODIwMDIsImV4cCI6MjEwMDM1ODAwMn0.Bj4g5R4MOCdvW8gZTHRehqLzaCE5Q8huCtHO7_WWmR0';
var AC=window.AC,esc=AC.esc;

/* Minimal Supabase client using raw fetch */
var accessToken='',refreshToken='';
function sb(){var h={'apikey':SUPABASE_KEY,'Content-Type':'application/json'};if(accessToken)h['Authorization']='Bearer '+accessToken;return h;}
async function sbGet(path){var r=await fetch(SUPABASE_URL+path,{headers:sb()});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}
async function sbPost(path,body){var r=await fetch(SUPABASE_URL+path,{method:'POST',headers:sb(),body:JSON.stringify(body)});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}
async function sbPatch(path,body){var r=await fetch(SUPABASE_URL+path,{method:'PATCH',headers:sb(),body:JSON.stringify(body)});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}
async function sbDelete(path){var r=await fetch(SUPABASE_URL+path,{method:'DELETE',headers:sb()});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}

async function sbLogin(email,password){
  var r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:email,password:password})});
  if(!r.ok){var e=await r.json();throw new Error(e.error_description||e.msg||'Login failed');}
  var d=await r.json();accessToken=d.access_token;refreshToken=d.refresh_token;return d.user;
}
async function sbRegister(email,password){
  var r=await fetch(SUPABASE_URL+'/auth/v1/signup',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:email,password:password})});
  if(!r.ok){var e=await r.json();throw new Error(e.msg||'Register failed');}
  var d=await r.json();if(d.access_token){accessToken=d.access_token;refreshToken=d.refresh_token;return d.user;}return null;
}
async function sbLogout(){accessToken='';refreshToken='';}
async function sbRestore(){
  var s=localStorage.getItem('sb_session');if(!s)return null;
  try{var t=JSON.parse(s);accessToken=t.access_token;refreshToken=t.refresh_token;var r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+accessToken}});if(!r.ok)return null;return await r.json();}catch(e){return null;}
}
function sbSaveSession(){if(accessToken)localStorage.setItem('sb_session',JSON.stringify({access_token:accessToken,refresh_token:refreshToken}));}

/* Rest of app */
var user=null,animes=[],bracket=null,picks=[],hasVoted=false;
var view='login',matchIdx=0,authMode='login',comments={};
var $=function(s){return document.querySelector(s);};

function validEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);}
async function doLogin(e,p){var u=await sbLogin(e,p);sbSaveSession();return u;}
async function doRegister(e,p){var u=await sbRegister(e,p);if(u)sbSaveSession();return u;}
async function doLogout(){await sbLogout();localStorage.removeItem('sb_session');user=null;animes=[];bracket=null;picks=[];hasVoted=false;comments={};view='login';render();}
async function loadAnimes(){
  var d=await sbGet('/rest/v1/animes?select=*&order=seed');
  if(!d||d.length<32)throw new Error('need_32');animes=d;
}
async function loadMyVotes(){
  if(!user)return;
  try{var d=await sbGet('/rest/v1/votes?select=*&user_id=eq.'+encodeURIComponent(user.id));}catch(e){return;}
  if(!d||d.length===0)return;
  d.forEach(function(v){var ri=v.round-1;var mi=bracket.rounds[ri].findIndex(function(m){return m.a===v.anime_a_id&&m.b===v.anime_b_id;});if(mi>=0)picks[ri][mi]=v.winner_id;});
  for(var r=0;r<picks.length-1;r++){if(picks[r].every(function(p){return p!==null;})){var nr=bracket.rounds[r+1];for(var mi=0;mi<nr.length;mi++){nr[mi].a=picks[r][mi*2];nr[mi].b=picks[r][mi*2+1];}}}
  try{var c=await sbGet('/rest/v1/comments?select=*&user_id=eq.'+encodeURIComponent(user.id));}catch(e){return;}
  (c||[]).forEach(function(x){comments[x.anime_id]=x.comment||'';});
  hasVoted=true;
}
function buildBracket(){var p=animes.slice(0,32).map(function(a){return a.id;});bracket={rounds:AC.buildRounds(p)};picks=bracket.rounds.map(function(r){return new Array(r.length).fill(null);});}
async function submitVotes(){
  if(!user)return;
  await sbDelete('/rest/v1/votes?user_id=eq.'+encodeURIComponent(user.id));
  await sbDelete('/rest/v1/comments?user_id=eq.'+encodeURIComponent(user.id));
  var rows=[];
  bracket.rounds.forEach(function(round,ri){round.forEach(function(m,mi){if(picks[ri][mi])rows.push({user_id:user.id,round:ri+1,anime_a_id:m.a,anime_b_id:m.b,winner_id:picks[ri][mi]});});});
  if(rows.length)await sbPost('/rest/v1/votes',rows);
  var crs=Object.entries(comments).filter(function(e){return e[1].trim();}).map(function(e){return{user_id:user.id,anime_id:+e[0],comment:e[1]};});
  if(crs.length)await sbPost('/rest/v1/comments',crs);
  hasVoted=true;
}
async function loadResults(){
  var d=await sbGet('/rest/v1/votes?select=*');
  var scores={};animes.forEach(function(a){scores[a.id]=0;});
  var bu={};(d||[]).forEach(function(v){if(!bu[v.user_id])bu[v.user_id]=[];bu[v.user_id].push(v);});
  Object.values(bu).forEach(function(vs){
    vs.filter(function(v){return v.round===5;}).forEach(function(v){scores[v.winner_id]+=4;scores[v.anime_a_id===v.winner_id?v.anime_b_id:v.anime_a_id]+=3;});
    vs.filter(function(v){return v.round===4;}).forEach(function(v){scores[v.anime_a_id===v.winner_id?v.anime_b_id:v.anime_a_id]+=2;});
    vs.filter(function(v){return v.round===3;}).forEach(function(v){scores[v.anime_a_id===v.winner_id?v.anime_b_id:v.anime_a_id]+=1;});
  });
  return Object.entries(scores).map(function(e){return{id:+e[0],pts:e[1]};}).sort(function(a,b){return b.pts-a.pts;});
}

function render(){var app=$('#app');if(!app)return;
  switch(view){case'login':app.innerHTML=tplLogin();break;case'voting':app.innerHTML=tplVoting();setTimeout(function(){if(bracket)syncPicks();},0);break;case'done':app.innerHTML=tplDone();break;case'results':tplResults().then(function(h){app.innerHTML=h;});break;}
}
function tplLogin(){return'<section class="screen login-screen"><div class="hero"><h1 class="logo-lockup"><span class="logo-badge">\u{1f3c6}</span><span class="logo-anime"><i>\u52a8</i><i>\u6f2b</i><i>\u4e4b</i><i>\u5dc5</i></span><span class="logo-cup">CUP</span></h1><p class="slogan">\u51b3\u6218\u52a8\u6f2b\u4e4b\u5dc5</p><p class="tagline">32\u90e8\u52a8\u6f2b\u6dd8\u6c70\u8d5b \u00b7 \u9009\u51fa\u4f60\u7684\u672c\u547d</p></div><div class="auth-box"><div class="auth-tabs"><button class="auth-tab active" data-act="auth-tab" data-tab="login">\u767b\u5f55</button><button class="auth-tab" data-act="auth-tab" data-tab="register">\u6ce8\u518c</button></div><div id="authForm">'+tplAuthForm('login')+'</div><p class="auth-error" id="authError" hidden></p></div><div class="home-foot"><button class="btn ghost sm" data-act="show-results">\u67e5\u770b\u5b9e\u65f6\u6392\u540d</button></div></section>';}
function tplAuthForm(mode){return'<div class="auth-fields"><input id="authEmail" type="email" placeholder="\u90ae\u7bb1\u5730\u5740"><input id="authPass" type="password" placeholder="\u5bc6\u7801\uff08\u81f3\u5c116\u4f4d\uff09" autocomplete="'+(mode==='login'?'current-password':'new-password')+'"><button class="btn primary" data-act="'+(mode==='login'?'login':'register')+'">'+(mode==='login'?'\u767b\u5f55':'\u6ce8\u518c')+'</button></div>';}
function tplVoting(){
  if(!bracket||!bracket.rounds)return'<p>Loading...</p>';
  var cr=0;for(var r=0;r<bracket.rounds.length;r++){if(!picks[r].every(function(p){return p!==null;})){cr=r;break;}if(r===bracket.rounds.length-1)cr=r;}
  var rd=bracket.rounds[cr],names=['32\u5f3a','16\u5f3a','8\u5f3a','\u534a\u51b3\u8d5b','\u51b3\u8d5b'];
  return'<section class="screen voting-screen"><div class="vote-head"><button class="btn ghost sm" data-act="logout">\u9000\u51fa</button><span class="vote-user">'+esc(user.email)+(hasVoted?' \u00b7 \u5df2\u6295\u8fc7\uff0c\u4fee\u6539\u540e\u8986\u76d6':'')+'</span><div class="vote-rounds">'+bracket.rounds.map(function(_,i){return'<span class="vr-dot'+(picks[i].every(function(p){return p!==null;})?' done':i===cr?' active':'')+'">'+names[i]+'</span>';}).join('')+'</div></div><div class="duel-wrap"><div class="phase-head"><span class="pill grad">'+names[cr]+' \u00b7 '+(cr===4?'FINAL':'KNOCKOUT')+'</span><h2>'+(cr===4?'\u51a0\u519b\u4e4b\u6218':'')+'</h2><p class="sub">\u70b9\u51fb\u652f\u6301\u7684\u90a3\u4e00\u90e8'+(cr===0?'\uff0c\u53ef\u5199\u7b80\u8bc4':'')+'</p></div><div class="match-nav"><button class="mn-btn" id="prevMatch" data-act="prev-match" disabled>\u2190</button><span class="mn-info" id="matchInfo">1/'+rd.length+'</span><button class="mn-btn" id="nextMatch" data-act="next-match">\u2192</button></div><div class="duel" id="duelContainer"></div>'+(cr===0?'<div class="comment-dual" id="commentDual"><div class="cmt-side"><label id="cmtLabelA"></label><textarea id="cmtA" placeholder="\u7b80\u8bc4\uff08\u53ef\u9009\uff09..."></textarea></div><div class="cmt-side"><label id="cmtLabelB"></label><textarea id="cmtB" placeholder="\u7b80\u8bc4\uff08\u53ef\u9009\uff09..."></textarea></div></div>':'')+'<div class="cta-bar pair-cta" style="position:static;background:none;padding-top:20px;display:'+(picks[cr].every(function(p){return p!==null;})?'flex':'none')+'"><button class="btn primary" data-act="'+(cr<4?'next-round':'submit-all')+'">'+(cr<4?'\u63d0\u4ea4\u672c\u8f6e \u2192 '+names[cr+1]:hasVoted?'\u91cd\u65b0\u63d0\u4ea4\u5168\u90e8\u6295\u7968':'\u63d0\u4ea4\u5168\u90e8\u6295\u7968')+'</button></div></div></section>';
}
function syncPicks(){if(!bracket||!bracket.rounds||!bracket.rounds.length)return;var cr=getCurrentRound();if(!bracket.rounds[cr]||!bracket.rounds[cr].length)return;if(matchIdx>=bracket.rounds[cr].length)matchIdx=0;renderMatch(cr,matchIdx);}
function getCurrentRound(){for(var r=0;r<bracket.rounds.length;r++)if(!picks[r].every(function(p){return p!==null;}))return r;return bracket.rounds.length-1;}
function saveComments(){var ca=document.getElementById('cmtA'),cb=document.getElementById('cmtB');if(ca&&ca.dataset.aid)comments[+ca.dataset.aid]=ca.value;if(cb&&cb.dataset.aid)comments[+cb.dataset.aid]=cb.value;}
function renderMatch(r,mi){
  saveComments();
  var m=bracket.rounds[r][mi],container=$('#duelContainer');if(!container)return;
  var card=function(id,side){var an=animes.find(function(x){return x.id===id;});var won=picks[r][mi]===id;return'<div class="dcard'+(won?' winner':'')+'" data-act="pick" data-side="'+side+'" data-r="'+r+'" data-mi="'+mi+'" data-id="'+id+'"><div class="art">'+(an&&an.image_url?'<img src="'+esc(an.image_url)+'" alt="">':'<div class="noart">'+AC.icons.film+'</div>')+'</div><div class="meta"><div class="tname">'+esc((an&&an.name_cn||an&&an.name)||'\u2014')+'</div></div></div>';};
  container.innerHTML=card(m.a,'a')+'<div class="vs-badge"><b>VS</b></div>'+card(m.b,'b');
  if(r===0){var aA=animes.find(function(x){return x.id===m.a;}),aB=animes.find(function(x){return x.id===m.b;});var la=document.getElementById('cmtLabelA'),lb=document.getElementById('cmtLabelB');var ca=document.getElementById('cmtA'),cb=document.getElementById('cmtB');if(la)la.textContent=esc((aA&&aA.name_cn||aA&&aA.name)||'');if(lb)lb.textContent=esc((aB&&aB.name_cn||aB&&aB.name)||'');if(ca){ca.dataset.aid=m.a;ca.value=comments[m.a]||'';}if(cb){cb.dataset.aid=m.b;cb.value=comments[m.b]||'';}}
  updateNav(r);document.getElementById('matchInfo').textContent=(mi+1)+'/'+bracket.rounds[r].length;
}
function updateNav(r){var p=$('#prevMatch'),n=$('#nextMatch');if(p)p.disabled=matchIdx===0;if(n)n.disabled=matchIdx>=bracket.rounds[r].length-1;}
function doPick(id,r,mi){picks[r][mi]=id;var duel=$('#duelContainer');if(duel)duel.querySelectorAll('.dcard').forEach(function(c){c.classList.toggle('winner',+c.dataset.id===id);c.classList.toggle('loser',+c.dataset.id!==id);});var allDone=picks[r].every(function(p){return p!==null;});var cta=document.querySelector('.pair-cta');if(cta)cta.style.display=allDone?'flex':'none';if(cta&&allDone){var btn=cta.querySelector('button');var names=['32\u5f3a','16\u5f3a','8\u5f3a','\u534a\u51b3\u8d5b','\u51b3\u8d5b'];var isLast=r>=bracket.rounds.length-1;btn.dataset.act=isLast?'submit-all':'next-round';btn.textContent=isLast?(hasVoted?'\u91cd\u65b0\u63d0\u4ea4\u5168\u90e8\u6295\u7968':'\u63d0\u4ea4\u5168\u90e8\u6295\u7968'):'\u63d0\u4ea4\u672c\u8f6e \u2192 '+names[r+1];}document.querySelectorAll('.vr-dot').forEach(function(d,i){d.classList.toggle('done',picks[i]&&picks[i].every(function(p){return p!==null;}));d.classList.toggle('active',i===r&&!allDone);});}
function doNextRound(){saveComments();var cr=getCurrentRound();if(cr>0){var nr=bracket.rounds[cr],prev=picks[cr-1];for(var mi=0;mi<nr.length;mi++){nr[mi].a=prev[mi*2];nr[mi].b=prev[mi*2+1];}}matchIdx=0;render();}
function goMatch(dir){var cr=getCurrentRound();matchIdx=Math.max(0,Math.min(bracket.rounds[cr].length-1,matchIdx+dir));renderMatch(cr,matchIdx);}
async function doSubmitAll(){saveComments();try{AC.toast('\u63d0\u4ea4\u4e2d...');await submitVotes();view='done';render();AC.toast(hasVoted?'\u6295\u7968\u5df2\u66f4\u65b0\uff01':'\u6295\u7968\u6210\u529f\uff01');}catch(e){AC.toast('\u5931\u8d25: '+e.message);}}
function tplDone(){return'<section class="screen done-screen"><div class="hero" style="margin-top:20vh"><div class="champ-crown">'+AC.icons.trophy+'</div><h1 style="font-size:32px;font-weight:900;margin:16px 0">\u6295\u7968\u6210\u529f\uff01</h1><p class="tagline">\u4f60\u7684\u9009\u62e9\u5df2\u8bb0\u5f55</p></div><div style="display:flex;flex-direction:column;gap:12px;margin-top:40px;align-items:center"><button class="btn primary" data-act="go-vote">\u4fee\u6539\u6295\u7968</button><button class="btn primary" data-act="show-results">\u67e5\u770b\u5b9e\u65f6\u6392\u540d</button><button class="btn ghost" data-act="logout">\u9000\u51fa</button></div></section>';}
async function tplResults(){
  var h='<section class="screen results-screen"><div class="phase-head"><span class="pill grad">\u5b9e\u65f6\u6392\u540d</span><h2>\u52a8\u6f2b\u79ef\u5206\u699c</h2><p class="sub">\u51a0\u519b+4 / \u4e9a\u519b+3 / \u56db\u5f3a+2 / \u516b\u5f3a+1</p></div>';
  try{
    var rankings=await loadResults();
    var vd=await sbGet('/rest/v1/votes?select=user_id');var vs=new Set();(vd||[]).forEach(function(v){vs.add(v.user_id);});
    h+='<p class="result-count">\u5df2\u6709 <b>'+vs.size+'</b> \u4eba\u53c2\u4e0e</p><div class="rank-list">';
    var medals=['\u{1f947}','\u{1f948}','\u{1f949}'];
    rankings.forEach(function(r,i){if(!r.pts)return;var a=animes.find(function(x){return x.id===r.id;});
      h+='<div class="rank-item" style="animation-delay:'+Math.min(i*40,600)+'ms"><span class="rank-no">'+(i<3?medals[i]:'#'+(i+1))+'</span>'+(a&&a.image_url?'<img src="'+esc(a.image_url)+'" class="rank-img" alt="">':'<div class="noart rank-img">?</div>')+'<span class="rank-name">'+esc((a&&a.name_cn||a&&a.name)||'?')+'</span><span class="rank-pts">'+r.pts+'\u5206</span><span class="rank-bar" style="width:'+Math.max(4,r.pts/Math.max(1,rankings[0].pts)*100)+'%"></span></div>';});
    if(rankings.every(function(r){return r.pts===0;}))h+='<p class="roster-empty">\u6682\u65e0\u6295\u7968\u6570\u636e</p>';
    h+='</div>';
  }catch(e){h+='<p class="roster-empty">'+e.message+'</p>';}
  h+='<div style="display:flex;gap:12px;justify-content:center;margin-top:24px">'+(user?'<button class="btn primary" data-act="go-vote">\u53bb\u6295\u7968</button>':'')+'<button class="btn ghost" data-act="go-login">'+(user?'\u9000\u51fa':'\u8fd4\u56de')+'</button></div></section>';
  return h;
}

document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;var act=t.dataset.act;
  switch(act){
    case'auth-tab':authMode=t.dataset.tab;document.querySelectorAll('.auth-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===authMode);});$('#authForm')&&($('#authForm').innerHTML=tplAuthForm(authMode));break;
    case'login':case'register':{var email=(document.getElementById('authEmail')?document.getElementById('authEmail').value:'').trim(),pw=document.getElementById('authPass')?document.getElementById('authPass').value:'',err=document.getElementById('authError');if(!validEmail(email)){if(err){err.hidden=false;err.textContent='\u8bf7\u8f93\u5165\u6b63\u786e\u7684\u90ae\u7bb1\u5730\u5740';}return;}if(pw.length<6){if(err){err.hidden=false;err.textContent='\u5bc6\u7801\u81f3\u5c116\u4f4d';}return;}if(err)err.hidden=true;(async function(){try{if(act==='login'){user=await doLogin(email,pw);}else{var u=await doRegister(email,pw);if(u){user=u;AC.toast('\u6ce8\u518c\u6210\u529f\uff01');}else{AC.toast('\u6ce8\u518c\u6210\u529f\uff01\u8bf7\u767b\u5f55');authMode='login';render();return;}}await loadAnimes();buildBracket();await loadMyVotes();view='voting';matchIdx=0;render();}catch(e){if(e.message==='need_32')AC.toast('\u540e\u53f0\u8fd8\u672a\u8bbe\u7f6e32\u5f3a\u52a8\u6f2b');else if(err){err.hidden=false;err.textContent=e.message;}}})();break;}
    case'pick':doPick(+t.dataset.id,+t.dataset.r,+t.dataset.mi);break;
    case'prev-match':goMatch(-1);break;
    case'next-match':goMatch(1);break;
    case'next-round':doNextRound();break;
    case'submit-all':doSubmitAll();break;
    case'logout':doLogout();break;
    case'show-results':view='results';render();break;
    case'go-vote':view='voting';matchIdx=0;render();break;
    case'go-login':doLogout();break;
  }
});
document.addEventListener('input',function(e){if(e.target.id==='cmtA'&&e.target.dataset.aid)comments[+e.target.dataset.aid]=e.target.value;if(e.target.id==='cmtB'&&e.target.dataset.aid)comments[+e.target.dataset.aid]=e.target.value;});

(async function(){var u=await sbRestore();if(u){user=u;try{await loadAnimes();buildBracket();await loadMyVotes();view='voting';}catch(e){view='login';if(e.message==='need_32')AC.toast('\u540e\u53f0\u8fd8\u672a\u8bbe\u7f6e32\u5f3a\u52a8\u6f2b');}}render();})();
