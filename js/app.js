/* ПДД Тренажёр — офлайн-приложение для заучивания 811 вопросов */
(function () {
"use strict";

const Q = window.PDD_QUESTIONS || [];
const byId = {};
Q.forEach(q => { byId[q.id] = q; });
const LETTERS = ['A','B','C','D','E','F','H','I','J','K','L','M'];
const MEDIA = 'https://media.pddtest.kz/';
const T = {
  ru:{learn:'Учить',exam:'Экзамен',review:'Повторение',show:'Показать ответ',expl:'Объяснение',
      videoQ:'Видео-ситуация',videoE:'Видео-объяснение',next:'Следующий →',prev:'← Предыдущий',
      correct:'Верно!',wrong:'Ошибка',of:'из'},
  kz:{learn:'Үйрену',exam:'Емтихан',review:'Қайталау',show:'Жауапты көрсету',expl:'Түсіндірме',
      videoQ:'Видео-жағдай',videoE:'Видео-түсіндірме',next:'Келесі →',prev:'← Алдыңғы',
      correct:'Дұрыс!',wrong:'Қате',of:'/'},
  en:{learn:'Learn',exam:'Exam',review:'Review',show:'Show answer',expl:'Explanation',
      videoQ:'Video situation',videoE:'Video explanation',next:'Next →',prev:'← Previous',
      correct:'Correct!',wrong:'Wrong',of:'of'}
};
const SRS_DAYS = [0, 1, 2, 4, 8, 16, 32]; // Leitner box → days until due

/* ---------- persistence ---------- */
const LS = {
  get(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch(e){ return d; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
let lang = LS.get('pdd_lang', 'ru');
let progress = LS.get('pdd_progress', {});  // id -> {seen,correct,wrong,box,due,last}
let favs = new Set(LS.get('pdd_fav', []));
let settings = LS.get('pdd_settings', { showVideo:true, examSize:20 });

function saveProgress(){ LS.set('pdd_progress', progress); }
function saveFav(){ LS.set('pdd_fav', [...favs]); }
function saveSettings(){ LS.set('pdd_settings', settings); }

function rec(id){ return progress[id] || (progress[id] = {seen:0,correct:0,wrong:0,box:0,due:0,last:null}); }

function answerQuestion(id, ok){
  const r = rec(id);
  r.seen++;
  if(ok){ r.correct++; r.box = Math.min(r.box+1, SRS_DAYS.length-1); r.last='correct'; }
  else { r.wrong++; r.box = 0; r.last='wrong'; }
  r.due = Date.now() + SRS_DAYS[r.box]*86400000;
  saveProgress();
}

/* ---------- stats ---------- */
function stats(){
  let learned=0, answered=0, totC=0, totW=0, mistakes=0;
  Q.forEach(q=>{
    const r=progress[q.id];
    if(!r) return;
    if(r.seen>0) answered++;
    if(r.last==='correct') learned++;
    if(r.last==='wrong') mistakes++;
    totC+=r.correct; totW+=r.wrong;
  });
  const acc = (totC+totW)?Math.round(totC/(totC+totW)*100):0;
  return {total:Q.length, learned, answered, acc, mistakes, due:dueList().length};
}
function dueList(){
  const now=Date.now();
  return Q.filter(q=>{ const r=progress[q.id]; return r && r.last!==null && r.due<=now; }).map(q=>q.id);
}

/* ---------- helpers ---------- */
const $ = sel => document.querySelector(sel);
const el = (html)=>{ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; };
function esc(s){ return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];} return a; }
function txt(o){ return (o && (o[lang] || o.ru || o.en)) || ''; }
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),1400); }

/* ---------- shared question card ---------- */
// opts: {showFav, onAnswered, autoReveal} -> returns element
function questionCard(q, opts){
  opts = opts || {};
  const r = progress[q.id] || {};
  const answers = opts.shuffle ? shuffle(q.a) : q.a;
  const node = el(`<div class="card">
    <div class="qhead">
      <span class="pill">№ ${q.id}</span>
      ${opts.counter ? `<span class="pill">${opts.counter}</span>`:''}
      ${opts.showFav ? `<button class="fav ${favs.has(q.id)?'on':''}" title="В избранное">★</button>`:''}
    </div>
    <video class="qmedia ${settings.showVideo && q.qf?'show':''}" autoplay muted loop playsinline></video>
    <div class="qtext">${esc(txt(q.q))}</div>
    <div class="answers"></div>
    <div class="explain">
      <h3>${TL().expl}</h3>
      <div class="exptext">${esc(txt(q.e))}</div>
      <video class="expvid" controls muted playsinline style="display:none"></video>
    </div>
  </div>`);

  // lazy-load videos only if enabled
  if(settings.showVideo && q.qf){
    const v=node.querySelector('.qmedia'); v.src=MEDIA+q.qf+'.mp4#t=0.5';
    v.onerror=()=>{ v.style.display='none'; };
  }

  const ansWrap = node.querySelector('.answers');
  const explain = node.querySelector('.explain');
  let locked = false;

  answers.forEach((a,i)=>{
    const b = el(`<button class="ans"><span class="ltr">${LETTERS[i]}</span><span>${esc(txt(a.t))}</span></button>`);
    b.onclick = ()=>{
      if(locked) return;
      locked = true;
      const ok = !!a.c;
      // mark all
      [...ansWrap.children].forEach((node2,idx)=>{
        node2.classList.add('locked');
        if(answers[idx].c) node2.classList.add('correct');
      });
      if(!ok) b.classList.add('wrong');
      explain.classList.add('show');
      const ev = explain.querySelector('.expvid');
      if(settings.showVideo && q.ef){ ev.src=MEDIA+q.ef+'.mp4#t=0.5'; ev.style.display='block'; ev.onerror=()=>ev.style.display='none'; }
      answerQuestion(q.id, ok);
      toast(ok ? TL().correct : TL().wrong);
      if(opts.onAnswered) opts.onAnswered(ok);
    };
    ansWrap.appendChild(b);
  });

  // already answered before? show state immediately in learn mode
  if(opts.autoReveal && r.last){
    [...ansWrap.children].forEach((node2,idx)=>{
      node2.classList.add('locked');
      if(answers[idx].c) node2.classList.add('correct');
    });
    explain.classList.add('show');
    locked=true;
  }

  if(opts.showFav){
    const fb=node.querySelector('.fav');
    fb.onclick=()=>{ if(favs.has(q.id)){favs.delete(q.id);fb.classList.remove('on');} else {favs.add(q.id);fb.classList.add('on');} saveFav(); };
  }
  return node;
}

function TL(){ return T[lang]; }

/* ================= VIEWS ================= */
const App = window.App = {};
let view='home', learnState=null, examState=null, reviewState=null;

App.setLang = function(l){
  lang=l; LS.set('pdd_lang',l);
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('active', b.dataset.lang===l));
  render();
};
App.go = function(v){ view=v; render(); window.scrollTo(0,0); };

function setActiveTab(){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
}

/* ---------- HOME ---------- */
function viewHome(){
  const s=stats();
  const pct=Math.round(s.learned/s.total*100);
  const c=el(`<div class="grid" style="gap:18px">
    <div class="card">
      <div class="row spread">
        <div><h1>Прогресс заучивания</h1><div class="muted">${s.learned} ${TL().of} ${s.total} вопросов изучено</div></div>
        <div style="font-size:34px;font-weight:800;color:var(--accent)">${pct}%</div>
      </div>
      <div class="bar" style="margin-top:14px"><i style="width:${pct}%"></i></div>
    </div>
    <div class="grid cols-4">
      <div class="card stat"><div class="big">${s.total}</div><div class="lbl">Всего вопросов</div></div>
      <div class="card stat ok"><div class="big">${s.learned}</div><div class="lbl">Изучено</div></div>
      <div class="card stat bad"><div class="big">${s.mistakes}</div><div class="lbl">С ошибками</div></div>
      <div class="card stat acc"><div class="big">${s.acc}%</div><div class="lbl">Точность</div></div>
    </div>
    <div class="grid cols-3">
      <div class="card">
        <h2>📚 ${TL().learn}</h2>
        <p class="muted">Проходи все вопросы по порядку с ответами и объяснениями.</p>
        <button class="btn" id="goLearn">Продолжить учить</button>
      </div>
      <div class="card">
        <h2>🔁 ${TL().review}</h2>
        <p class="muted">Интервальное повторение. К повторению готово: <b style="color:var(--warn)">${s.due}</b></p>
        <button class="btn ${s.due?'':'ghost'}" id="goReview" ${s.due?'':'disabled'}>Повторять (${s.due})</button>
      </div>
      <div class="card">
        <h2>📝 ${TL().exam}</h2>
        <p class="muted">Пробный экзамен из случайных вопросов, как на настоящем тесте.</p>
        <button class="btn" id="goExam">Начать экзамен</button>
      </div>
    </div>
    <div class="card">
      <div class="row spread">
        <div class="muted">Данные и прогресс хранятся в этом браузере. Видео загружаются из интернета.</div>
        <button class="btn ghost sm" id="reset">Сбросить прогресс</button>
      </div>
    </div>
  </div>`);
  c.querySelector('#goLearn').onclick=()=>App.go('learn');
  c.querySelector('#goExam').onclick=()=>App.go('exam');
  const gr=c.querySelector('#goReview'); if(gr&&!gr.disabled) gr.onclick=()=>App.go('review');
  c.querySelector('#reset').onclick=()=>{
    if(confirm('Сбросить весь прогресс и избранное?')){ progress={}; favs=new Set(); saveProgress(); saveFav(); render(); }
  };
  return c;
}

/* ---------- LEARN ---------- */
function buildLearnList(){
  let ids = Q.map(q=>q.id);
  const f = learnState.filter;
  if(f==='new') ids = ids.filter(id=>!progress[id] || !progress[id].last);
  else if(f==='err') ids = ids.filter(id=>progress[id]&&progress[id].last==='wrong');
  else if(f==='fav') ids = ids.filter(id=>favs.has(id));
  else if(f==='done') ids = ids.filter(id=>progress[id]&&progress[id].last==='correct');
  const s=(learnState.search||'').trim().toLowerCase();
  if(s){
    if(/^\d+$/.test(s)) ids=ids.filter(id=>String(id).includes(s));
    else ids=ids.filter(id=>txt(byId[id].q).toLowerCase().includes(s)||byId[id].a.some(a=>txt(a.t).toLowerCase().includes(s)));
  }
  return ids;
}

function viewLearn(){
  if(!learnState) learnState={filter:'all',search:'',idx:0};
  const list=buildLearnList();
  if(learnState.idx>=list.length) learnState.idx=0;

  const wrap=el(`<div class="grid" style="gap:16px">
    <div class="card">
      <div class="toolbar">
        <select id="flt">
          <option value="all">Все вопросы</option>
          <option value="new">Новые</option>
          <option value="err">С ошибками</option>
          <option value="done">Изученные</option>
          <option value="fav">Избранные ★</option>
        </select>
        <input type="text" id="search" placeholder="Поиск по тексту или № вопроса">
        <span class="muted" id="lcount"></span>
      </div>
      <div class="numgrid" id="numgrid"></div>
    </div>
    <div id="qhost"></div>
  </div>`);

  const flt=wrap.querySelector('#flt'); flt.value=learnState.filter;
  flt.onchange=()=>{ learnState.filter=flt.value; learnState.idx=0; render(); };
  const search=wrap.querySelector('#search'); search.value=learnState.search;
  search.oninput=()=>{ learnState.search=search.value; learnState.idx=0; renderLearnBody(wrap,buildLearnList()); };

  renderLearnBody(wrap,list);
  // keyboard nav
  document.onkeydown=(e)=>{
    if(view!=='learn') return;
    if(e.key==='ArrowRight'){ learnNav(1); }
    if(e.key==='ArrowLeft'){ learnNav(-1); }
  };
  return wrap;
}

function renderLearnBody(wrap,list){
  const host=wrap.querySelector('#qhost');
  const numgrid=wrap.querySelector('#numgrid');
  wrap.querySelector('#lcount').textContent=`${list.length} вопросов`;
  numgrid.innerHTML='';
  if(!list.length){ host.innerHTML='<div class="card empty">Нет вопросов по этому фильтру.</div>'; return; }
  if(learnState.idx>=list.length) learnState.idx=list.length-1;

  list.forEach((id,i)=>{
    const r=progress[id]||{};
    const b=el(`<button class="${r.last==='correct'?'done':r.last==='wrong'?'err':''} ${i===learnState.idx?'cur':''}">${id}</button>`);
    b.onclick=()=>{ learnState.idx=i; renderLearnBody(wrap,list); };
    numgrid.appendChild(b);
  });
  numgrid.querySelector('.cur')?.scrollIntoView({block:'nearest'});

  const id=list[learnState.idx];
  const q=byId[id];
  host.innerHTML='';
  const card=questionCard(q,{showFav:true,autoReveal:true,counter:`${learnState.idx+1} / ${list.length}`,
    onAnswered:()=>{ // refresh numgrid status after answering
      const btn=numgrid.children[learnState.idx];
      const r=progress[id];
      btn.classList.remove('done','err');
      if(r.last==='correct')btn.classList.add('done'); else if(r.last==='wrong')btn.classList.add('err');
    }});
  host.appendChild(card);
  const nav=el(`<div class="navrow">
    <button class="btn ghost" ${learnState.idx<=0?'disabled':''} id="pv">${TL().prev}</button>
    <button class="btn" ${learnState.idx>=list.length-1?'disabled':''} id="nx">${TL().next}</button>
  </div>`);
  nav.querySelector('#pv').onclick=()=>learnNav(-1);
  nav.querySelector('#nx').onclick=()=>learnNav(1);
  host.appendChild(nav);
}
function learnNav(d){
  const list=buildLearnList();
  const ni=learnState.idx+d;
  if(ni<0||ni>=list.length) return;
  learnState.idx=ni; render(); window.scrollTo(0,0);
}

/* ---------- EXAM ---------- */
function viewExam(){
  if(!examState){
    const sizes=[10,20,40,811];
    const opts=sizes.map(n=>`<option value="${n}" ${settings.examSize==n?'selected':''}>${n===811?'Все 811':n}</option>`).join('');
    const node=el(`<div class="card" id="examSetup">
      <h1>📝 Пробный экзамен</h1>
      <p class="muted">Случайные вопросы с перемешанными ответами. Допустимо ошибок: 10%.</p>
      <div class="row" style="margin:16px 0">
        <label class="muted">Количество вопросов:&nbsp;</label>
        <select id="esize">${opts}</select>
      </div>
      <button class="btn" id="startExam">Начать</button>
    </div>`);
    node.querySelector('#startExam').onclick=()=>{
      const n=parseInt(node.querySelector('#esize').value,10);
      settings.examSize=n; saveSettings();
      const ids=shuffle(Q.map(q=>q.id)).slice(0,n);
      examState={ids,idx:0,ans:[],done:false,allowed:Math.floor(n*0.1)};
      render(); window.scrollTo(0,0);
    };
    return node;
  }
  return examState.done ? examResult() : examQuestion();
}
function examQuestion(){
  const id=examState.ids[examState.idx];
  const q=byId[id];
  const wrap=el(`<div class="grid" style="gap:14px">
    <div class="card" style="padding:14px 18px">
      <div class="row spread">
        <span class="examqn">Вопрос ${examState.idx+1} / ${examState.ids.length}</span>
        <span class="examqn">Ошибок: ${examState.ans.filter(a=>!a).length} / допустимо ${examState.allowed}</span>
      </div>
      <div class="bar" style="margin-top:8px"><i style="width:${(examState.idx)/examState.ids.length*100}%"></i></div>
    </div>
    <div id="ehost"></div>
  </div>`);
  const host=wrap.querySelector('#ehost');
  const card=questionCard(q,{shuffle:true,counter:null,onAnswered:(ok)=>{
    examState.ans[examState.idx]=ok;
    const nb=el(`<div class="navrow"><span></span><button class="btn" id="enx">${examState.idx>=examState.ids.length-1?'Завершить':TL().next}</button></div>`);
    nb.querySelector('#enx').onclick=()=>{
      if(examState.idx>=examState.ids.length-1){ examState.done=true; }
      else examState.idx++;
      render(); window.scrollTo(0,0);
    };
    host.appendChild(nb);
  }});
  host.appendChild(card);
  return wrap;
}
function examResult(){
  const correct=examState.ans.filter(a=>a).length;
  const total=examState.ids.length;
  const wrong=total-correct;
  const pass=wrong<=examState.allowed;
  const wrongIds=examState.ids.filter((id,i)=>!examState.ans[i]);
  const wrap=el(`<div class="grid" style="gap:16px">
    <div class="card">
      <div class="result-big ${pass?'pass':'fail'}">${pass?'СДАНО':'НЕ СДАНО'}</div>
      <div style="text-align:center;font-size:20px;margin-top:8px">${correct} / ${total} верно</div>
      <div class="row" style="justify-content:center;margin-top:18px;gap:10px">
        <button class="btn" id="again">Ещё раз</button>
        <button class="btn ghost" id="home2">На главную</button>
      </div>
    </div>
    ${wrongIds.length?`<div class="card"><h2>Разбор ошибок (${wrongIds.length})</h2><div id="mhost"></div></div>`:''}
  </div>`);
  wrap.querySelector('#again').onclick=()=>{ examState=null; render(); };
  wrap.querySelector('#home2').onclick=()=>{ examState=null; App.go('home'); };
  if(wrongIds.length){
    const mhost=wrap.querySelector('#mhost');
    wrongIds.forEach(id=>mhost.appendChild(questionCard(byId[id],{autoReveal:true})));
  }
  return wrap;
}

/* ---------- REVIEW (SRS) ---------- */
function viewReview(){
  if(!reviewState){ reviewState={queue:dueList(),idx:0}; }
  const queue=reviewState.queue;
  if(!queue.length || reviewState.idx>=queue.length){
    const s=stats();
    const w=el(`<div class="card empty">
      <h1>🎉 На сегодня всё!</h1>
      <p class="muted">Нет карточек к повторению. Возвращайся позже — интервалы рассчитаны по системе Лейтнера.</p>
      <div class="row" style="justify-content:center;margin-top:14px;gap:10px">
        <button class="btn" id="learnMore">Учить новые</button>
        <button class="btn ghost" id="home3">На главную</button>
      </div>
    </div>`);
    w.querySelector('#learnMore').onclick=()=>{reviewState=null;App.go('learn');};
    w.querySelector('#home3').onclick=()=>{reviewState=null;App.go('home');};
    return w;
  }
  const id=queue[reviewState.idx];
  const wrap=el(`<div class="grid" style="gap:14px">
    <div class="card" style="padding:14px 18px">
      <div class="row spread"><span class="examqn">🔁 Повторение ${reviewState.idx+1} / ${queue.length}</span></div>
      <div class="bar" style="margin-top:8px"><i style="width:${reviewState.idx/queue.length*100}%"></i></div>
    </div>
    <div id="rhost"></div>
  </div>`);
  const host=wrap.querySelector('#rhost');
  const card=questionCard(byId[id],{shuffle:true,onAnswered:()=>{
    const nb=el(`<div class="navrow"><span></span><button class="btn" id="rnx">${TL().next}</button></div>`);
    nb.querySelector('#rnx').onclick=()=>{ reviewState.idx++; render(); window.scrollTo(0,0); };
    host.appendChild(nb);
  }});
  host.appendChild(card);
  return wrap;
}

/* ---------- render ---------- */
function render(){
  document.querySelectorAll('.lang button').forEach(b=>b.classList.toggle('active', b.dataset.lang===lang));
  setActiveTab();
  const app=$('#app');
  app.innerHTML='';
  let node;
  if(view==='learn') node=viewLearn();
  else if(view==='exam'){ examState=examState||null; node=viewExam(); }
  else if(view==='review') node=viewReview();
  else node=viewHome();
  if(node) app.appendChild(node);
}

// reset transient state when switching mode
const _go=App.go;
App.go=function(v){ if(v==='exam') examState=null; if(v==='review') reviewState=null; _go(v); };

render();
})();
