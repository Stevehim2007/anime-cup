var SUPABASE_URL='https://jnhetrqhizfuxwfnjcoh.supabase.co';
var SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaGV0cnFoaXpmdXh3Zm5qY29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODIwMDIsImV4cCI6MjEwMDM1ODAwMn0.Bj4g5R4MOCdvW8gZTHRehqLzaCE5Q8huCtHO7_WWmR0';
var ADMIN_EMAILS=['2933886037@qq.com','test@qq.com'];
var AC=window.AC,esc=AC.esc;

var accessToken='',refreshToken='';
function sbh(){var h={'apikey':SUPABASE_KEY,'Content-Type':'application/json'};if(accessToken)h['Authorization']='Bearer '+accessToken;return h;}
async function sbGet(path){var r=await fetch(SUPABASE_URL+path,{headers:sbh()});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}
async function sbPost(path,body){var r=await fetch(SUPABASE_URL+path,{method:'POST',headers:sbh(),body:JSON.stringify(body)});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}
async function sbPatch(path,body){var r=await fetch(SUPABASE_URL+path,{method:'PATCH',headers:sbh(),body:JSON.stringify(body)});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}
async function sbDelete(path){var r=await fetch(SUPABASE_URL+path,{method:'DELETE',headers:sbh()});if(!r.ok){var e=await r.text();throw new Error(e);}return r.json();}
async function sbLogin(e,p){var r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:e,password:p})});if(!r.ok){var d=await r.json();throw new Error(d.error_description||'Login failed');}var d=await r.json();accessToken=d.access_token;refreshToken=d.refresh_token;return d.user;}
async function sbLogout(){accessToken='';refreshToken='';}
async function sbRestore(){var s=localStorage.getItem('sb_admin_session');if(!s)return null;try{var t=JSON.parse(s);accessToken=t.access_token;refreshToken=t.refresh_token;var r=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{'apikey':SUPABASE_KEY,'Authorization':'Bearer '+accessToken}});if(!r.ok)return null;return await r.json();}catch(e){return null;}}
function sbSave(){if(accessToken)localStorage.setItem('sb_admin_session',JSON.stringify({access_token:accessToken,refresh_token:refreshToken}));}

var user=null,animes=[],searchResults=[];
var $=function(s){return document.querySelector(s);};

async function doLogin(e,p){var u=await sbLogin(e,p);sbSave();return u;}
async function doLogout(){await sbLogout();localStorage.removeItem('sb_admin_session');user=null;render();}
async function loadAnimes(){var d=await sbGet('/rest/v1/animes?select=*&order=seed');animes=d||[];}
async function addAnime(a){
  var ns=animes.length+1;if(ns>32){AC.toast('Max 32');return;}
  var imgUrl='';try{var d=await AC.api.getSubjectDetail(a.id);imgUrl=d.image||d.image_large||'';}catch(e){}
  var r=await sbPost('/rest/v1/animes',{name:a.name||'',name_cn:a.name_cn||a.name||'',image_url:imgUrl||a.image||a.image_large||'',seed:ns});
  AC.toast('Added');await loadAnimes();render();
}
async function removeAnime(id){
  await sbDelete('/rest/v1/animes?id=eq.'+id);AC.toast('Deleted');
  var d=await sbGet('/rest/v1/animes?select=*&order=seed');
  for(var i=0;i<(d||[]).length;i++){if(d[i].seed!==i+1)await sbPatch('/rest/v1/animes?id=eq.'+d[i].id,{seed:i+1});}
  await loadAnimes();render();
}
async function moveUp(id){var i=animes.findIndex(function(a){return a.id===id;});if(i<=0)return;var a=animes[i],b=animes[i-1];await sbPatch('/rest/v1/animes?id=eq.'+b.id,{seed:a.seed});await sbPatch('/rest/v1/animes?id=eq.'+a.id,{seed:b.seed});await loadAnimes();render();}
async function moveDown(id){var i=animes.findIndex(function(a){return a.id===id;});if(i<0||i>=animes.length-1)return;var a=animes[i],b=animes[i+1];await sbPatch('/rest/v1/animes?id=eq.'+b.id,{seed:a.seed});await sbPatch('/rest/v1/animes?id=eq.'+a.id,{seed:b.seed});await loadAnimes();render();}

var st;function doSearch(term){clearTimeout(st);st=setTimeout(async function(){try{searchResults=await AC.api.searchAnime(term,10);}catch(e){searchResults=[];}renderSug();},350);}
function renderSug(){var el=$('#sug');if(!el||!searchResults.length){if(el)el.innerHTML='';return;}var added=new Set(animes.map(function(a){return a.id;}));el.innerHTML=searchResults.map(function(a){var ok=added.has(a.id);return'<button class="sug-item" data-act="add-anime" data-id="'+a.id+'"'+(ok?' disabled':'')+'><span class="sug-meta"><span class="sug-name">'+esc(a.name_cn||a.name)+'</span><span class="sug-genre">'+esc(a.meta||'')+(ok?' (added)':'')+'</span></span>'+(ok?'<span class="sug-added">OK</span>':'')+'</button>';}).join('');}

function render(){
  var app=$('#app');if(!app)return;
  if(!user){app.innerHTML='<section class="screen login-screen"><div class="hero"><h1 style="font-size:28px;font-weight:900;text-align:center">Admin</h1><p class="tagline">Admin Login Only</p></div><div class="auth-box"><div class="auth-fields"><input id="authEmail" type="email" placeholder="Email"><input id="authPass" type="password" placeholder="Password"><button class="btn primary" id="loginBtn">Login</button></div><p class="auth-error" id="authError" hidden></p></div></section>';document.getElementById('loginBtn').onclick=async function(){var ee=(document.getElementById('authEmail')?document.getElementById('authEmail').value:'').trim(),pp=document.getElementById('authPass')?document.getElementById('authPass').value:'',err=document.getElementById('authError');if(!ee||!pp){if(err){err.hidden=false;err.textContent='Fill email and password';}return;}try{user=await doLogin(ee,pp);if(!ADMIN_EMAILS.includes(user.email)){await sbLogout();user=null;if(err){err.hidden=false;err.textContent='Not admin';}return;}await loadAnimes();render();}catch(e){if(err){err.hidden=false;err.textContent=e.message;}}};return;}
  var rows=animes.length===0?'<p class="roster-empty">No anime yet. Search and add.</p>':animes.map(function(a){return'<div class="roster-card"><div class="rart">'+(a.image_url?'<img src="'+esc(a.image_url)+'" alt="">':'<div class="noart">N</div>')+'</div><div class="rmeta"><div class="rname">#'+a.seed+' '+esc(a.name_cn||a.name)+'</div><div class="rinfo">'+esc(a.name||'')+'</div></div><button class="rremove" data-act="move-up" data-id="'+a.id+'" title="Up">^</button><button class="rremove" data-act="move-down" data-id="'+a.id+'" title="Down">v</button><button class="rremove" data-act="remove-anime" data-id="'+a.id+'" title="Del" style="color:#ff5555">X</button><button class="rremove" data-act="show-comments" data-id="'+a.id+'" title="Comments" style="color:var(--acc1);font-size:12px;width:auto;padding:0 8px">B</button></div>';}).join('');
  app.innerHTML='<section class="screen admin-screen"><div class="admin-head"><div><h2>Anime Manager</h2><span class="admin-user">'+esc(user.email)+' - <button class="link-btn" id="logoutBtn">Logout</button> - <button class="link-btn" id="statsBtn">Stats</button></span></div><span class="admin-count">'+animes.length+'/32</span></div><div class="searchbox" id="searchbox" style="margin:12px 0"><div class="search-field"><input id="q" type="search" placeholder="Search anime..."></div><div class="sug" id="sug"></div></div><div class="anime-list">'+rows+'</div></section>';
  document.getElementById('logoutBtn').onclick=doLogout;
  document.getElementById('statsBtn').onclick=showStats;
  var qEl=document.getElementById('q');if(qEl)qEl.oninput=function(){var t=qEl.value.trim();if(t.length<2){searchResults=[];renderSug();return;}doSearch(t);};
}

document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t){if(!e.target.closest('#searchbox')){searchResults=[];renderSug();}return;}
  var act=t.dataset.act,id=t.dataset.id?+t.dataset.id:null;
  switch(act){case'add-anime':{var a=searchResults.find(function(x){return x.id===id;});if(a)addAnime(a);break;}case'remove-anime':removeAnime(id);break;case'move-up':moveUp(id);break;case'move-down':moveDown(id);break;case'show-comments':showComments(id);break;}
});

async function showStats(){
  var modal=document.createElement('div');modal.className='modal';
  modal.innerHTML='<div class="modal-close" id="closeStats">X</div><div class="modal-body" style="background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:24px;max-width:500px;width:90vw;max-height:80vh;overflow-y:auto"><h3>Stats</h3><p id="statsLoading">Loading...</p><div id="statsContent"></div></div>';
  document.body.appendChild(modal);
  try{
    var votes=await sbGet('/rest/v1/votes?select=*');
    var voterSet=new Set();votes.forEach(function(v){voterSet.add(v.user_id);});
    var scores={};animes.forEach(function(a){scores[a.id]=0;});
    var bu={};votes.forEach(function(v){if(!bu[v.user_id])bu[v.user_id]=[];bu[v.user_id].push(v);});
    Object.values(bu).forEach(function(vs){
      vs.filter(function(v){return v.round===5;}).forEach(function(v){scores[v.winner_id]+=4;scores[v.anime_a_id===v.winner_id?v.anime_b_id:v.anime_a_id]+=3;});
      vs.filter(function(v){return v.round===4;}).forEach(function(v){scores[v.anime_a_id===v.winner_id?v.anime_b_id:v.anime_a_id]+=2;});
      vs.filter(function(v){return v.round===3;}).forEach(function(v){scores[v.anime_a_id===v.winner_id?v.anime_b_id:v.anime_a_id]+=1;});
    });
    var rankings=Object.entries(scores).map(function(e){return{id:+e[0],pts:e[1]};}).sort(function(a,b){return b.pts-a.pts;});
    document.getElementById('statsLoading').textContent=voterSet.size+' voters';
    var html='<div class="rank-list">';
    rankings.forEach(function(r,i){if(!r.pts)return;var a=animes.find(function(x){return x.id===r.id;});html+='<div class="rank-item"><span class="rank-no">'+(i<3?['1st','2nd','3rd'][i]:'#'+(i+1))+'</span>'+(a&&a.image_url?'<img src="'+esc(a.image_url)+'" class="rank-img">':'<div class="noart rank-img">N</div>')+'<span class="rank-name">'+esc((a&&a.name_cn||a&&a.name)||'?')+'</span><span class="rank-pts">'+r.pts+'pts</span></div>';});
    if(rankings.every(function(r){return r.pts===0;}))html+='<p>No data</p>';html+='</div>';
    document.getElementById('statsContent').innerHTML=html;
  }catch(e){document.getElementById('statsContent').innerHTML='Error: '+esc(e&&e.message||String(e));}
  document.getElementById('closeStats').onclick=function(){modal.remove();};modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
}
async function showComments(animeId){
  var modal=document.createElement('div');modal.className='modal';
  modal.innerHTML='<div class="modal-close" id="closeComments">X</div><div class="modal-body" style="background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:24px;max-width:500px;width:90vw;max-height:80vh;overflow-y:auto"><h3>Loading...</h3></div>';
  document.body.appendChild(modal);
  document.getElementById('closeComments').onclick=function(){modal.remove();};modal.addEventListener('click',function(e){if(e.target===modal)modal.remove();});
  var body=modal.querySelector('.modal-body');
  try{
    var data=await sbGet('/rest/v1/comments?select=*&anime_id=eq.'+animeId+'&comment=not.is.null');
    var a=animes.find(function(x){return x.id===animeId;});
    var items='';
    if(data&&data.length>0){items=data.map(function(v){return'<div style="padding:10px;border-bottom:1px solid var(--line-soft)"><span style="color:var(--dim);font-size:12px">'+esc(v.user_id||'anonymous')+'</span><p style="margin-top:4px;font-size:14px;white-space:pre-wrap">'+esc(v.comment||'')+'</p></div>';}).join('');}
    else{items='<p style="color:var(--dim);text-align:center;padding:20px">No comments</p>';}
    body.innerHTML='<h3>'+esc((a&&a.name_cn||a&&a.name)||'')+' Comments</h3><p style="color:var(--dim);margin-bottom:12px">Total '+data.length+'</p>'+items;
  }catch(e){body.innerHTML='<h3>Error</h3><p>'+esc(e&&e.message||String(e))+'</p>';}
}
(async function(){var u=await sbRestore();if(u&&ADMIN_EMAILS.includes(u.email)){user=u;await loadAnimes();}render();})();
