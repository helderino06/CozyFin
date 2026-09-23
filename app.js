const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY="cozyfin-v1";
const monthNames=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const palette=["#8fa58c","#c98263","#b89b72","#8a9db5","#a88eaa","#d0a56f","#759c91","#b97b79","#8e9671","#9b806c"];
const icons=["🏠","🛒","🍽️","🚗","⛽","💡","📱","🎬","❤️","💊","👕","🎁","✈️","🐶","📚","💻","💳","☕","🏋️","🎮"];
const defaultCats=[
 ["Vivienda","🏠",["Alquiler","Hipoteca","Comunidad","Reparaciones","Mobiliario"]],
 ["Alimentación","🛒",["Supermercado","Restaurantes","Delivery","Cafés"]],
 ["Transporte","🚗",["Combustible","Transporte público","Parking","Mantenimiento","Taxi/VTC"]],
 ["Hogar","💡",["Luz","Agua","Gas","Internet","Móvil","Limpieza"]],
 ["Ocio","🎬",["Cine","Conciertos","Videojuegos","Streaming","Viajes"]],
 ["Salud","❤️",["Farmacia","Médico","Dentista","Gimnasio"]],
 ["Compras","👕",["Ropa","Tecnología","Hogar","Regalos"]],
 ["Mascotas","🐶",["Comida","Veterinario","Accesorios"]],
 ["Educación","📚",["Cursos","Libros","Material"]],
 ["Otros","📦",["Varios"]]
];
let state=load();
let cursor=new Date(); cursor.setDate(1);
let selectedType="all", planTab="upcoming";

function seed(){
 return {transactions:[], budgets:[], recurring:[], categories:defaultCats.map(x=>({name:x[0],icon:x[1],subs:x[2]})),
 accounts:["Cuenta bancaria","Efectivo","Tarjeta"], currency:"EUR"};
}
function load(){try{let x=JSON.parse(localStorage.getItem(KEY));if(!x)x=seed();x.goals ||= [];x.cards ||= [];x.accountBalances ||= {};x.recurring ||= [];x.budgets ||= [];x.transactions ||= [];x.categories ||= defaultCats.map(x=>({name:x[0],icon:x[1],subs:x[2]}));x.accounts ||= ["Cuenta bancaria","Efectivo","Tarjeta"];x.dark ||= false;return x}catch{return seed()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function money(n){return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(n||0)}
function iso(d){return new Date(d).toISOString().slice(0,10)}
function parseDate(s){return new Date(s+"T12:00:00")}
function monthKey(d){let x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`}
function today(){let d=new Date();return iso(d)}
function dayLabel(){return new Date().toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}
function startOfWeek(d){let x=new Date(d);let day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(12,0,0,0);return x}
function weekTransactions(d=new Date()){let s=startOfWeek(d),e=new Date(s);e.setDate(e.getDate()+7);return state.transactions.filter(t=>{let x=parseDate(t.date);return x>=s&&x<e})}
function upcoming(days=30){let now=parseDate(today()),end=new Date(now);end.setDate(end.getDate()+days);return state.recurring.filter(r=>r.active!==false&&parseDate(r.nextDate)>=now&&parseDate(r.nextDate)<=end)}
function accountBalance(name){let opening=Number(state.accountBalances?.[name]||0);return opening+state.transactions.filter(t=>t.account===name).reduce((a,t)=>a+(t.type==="income"?Number(t.amount):-Number(t.amount)),0)}

function currentMonth(){return monthKey(cursor)}
function formatDate(s){return parseDate(s).toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}
function toast(t){let e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function catInfo(name){return state.categories.find(c=>c.name===name)||{name,icon:"📦",subs:[]}}
function transactionsForMonth(k=currentMonth()){return state.transactions.filter(t=>monthKey(parseDate(t.date))===k)}
function expenseSum(ts){return ts.filter(t=>t.type==="expense").reduce((a,t)=>a+Number(t.amount),0)}
function incomeSum(ts){return ts.filter(t=>t.type==="income").reduce((a,t)=>a+Number(t.amount),0)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}


function normalizeMerchant(s=''){
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function txHash(t){
  return [t.date, Number(t.amount).toFixed(2), normalizeMerchant(t.title), t.account||''].join('|');
}
function guessType(amount){
  return Number(amount) >= 0 ? 'income' : 'expense';
}
function applyImportRule(title, rules=state.importRules){
  const n=normalizeMerchant(title);
  const r=rules.find(x=>n.includes(normalizeMerchant(x.keyword)));
  return r ? {category:r.category||'',subcategory:r.subcategory||''} : {};
}
function parseCSV(text){
  const lines=text.replace(/\r/g,'').split('\n').filter(x=>x.trim());
  if(!lines.length) return [];
  const sep = (lines[0].match(/;/g)||[]).length > (lines[0].match(/,/g)||[]).length ? ';' : ',';
  const parseLine=(line)=>{
    const out=[]; let cur='', q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"' && line[i+1]==='"'){cur+='"';i++;continue}
      if(c==='"'){q=!q;continue}
      if(c===sep && !q){out.push(cur.trim());cur='';continue}
      cur+=c;
    }
    out.push(cur.trim()); return out;
  };
  const headers=parseLine(lines[0]).map(x=>normalizeMerchant(x));
  const idx=(names)=>{for(const n of names){const i=headers.findIndex(h=>h===n||h.includes(n));if(i>=0)return i}return -1};
  const dateI=idx(['fecha','date','valor','value date']);
  const descI=idx(['concepto','descripcion','description','merchant','comercio','detalle','memo']);
  const amtI=idx(['importe','amount','monto','cantidad']);
  const debitI=idx(['debe','debit','cargo']);
  const creditI=idx(['haber','credit','abono']);
  const accountI=idx(['cuenta','account']);
  if(dateI<0 || descI<0 || (amtI<0 && debitI<0 && creditI<0)) return [];
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const p=parseLine(lines[i]); if(p.length<2) continue;
    let raw = amtI>=0?p[amtI]:'';
    let amount=Number(String(raw).replace(/\s/g,'').replace(/\.(?=\d{3}(?:\\D|$))/g,'').replace(',','.'));
    if(!Number.isFinite(amount)){
      const d=debitI>=0?Number(String(p[debitI]).replace('.','').replace(',','.')):0;
      const c=creditI>=0?Number(String(p[creditI]).replace('.','').replace(',','.')):0;
      amount=(c||0)-(d||0);
    }
    if(!Number.isFinite(amount)) continue;
    let date=String(p[dateI]||'').trim();
    if(/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(date)){
      const [d,m,y]=date.split(/[\/-]/); date=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const title=String(p[descI]||'Movimiento importado').trim();
    const rule=applyImportRule(title);
    rows.push({type:guessType(amount),title,amount:Math.abs(amount),date,
      category:rule.category||'Otros',subcategory:rule.subcategory||'',
      account:accountI>=0?p[accountI]||'Cuenta bancaria':'Cuenta bancaria',
      notes:'Importado', _signed:amount});
  }
  return rows;
}
function importTransactions(rows){
  let added=0, skipped=0;
  for(const r of rows){
    const t={...r}; delete t._signed;
    if(r._signed<0)t.type='expense'; else t.type='income';
    const h=txHash(t);
    if(state.importedHashes.includes(h) || state.transactions.some(x=>txHash(x)===h)){skipped++;continue}
    state.transactions.push({id:crypto.randomUUID(),...t});
    state.importedHashes.push(h); added++;
  }
  save(); render();
  alert(`Importación completada: ${added} nuevos, ${skipped} duplicados.`);
}
function exportCSVTemplate(){
  const csv='fecha,descripcion,importe,cuenta\\n2026-09-23,Supermercado,42.50,Cuenta bancaria\\n';
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cozyfin-importacion.csv'; a.click();
}
function addRule(){
  const keyword=prompt('Palabra del comercio (ej. mercadona):'); if(!keyword)return;
  const category=prompt('Categoría (ej. Alimentación):','Alimentación')||'Otros';
  const subcategory=prompt('Subcategoría (opcional):','')||'';
  state.importRules.push({id:crypto.randomUUID(),keyword,category,subcategory}); save(); render();
}
function removeRule(i){state.importRules.splice(i,1);save();render();}
function openImport(){
  const input=document.createElement('input'); input.type='file'; input.accept='.csv,text/csv';
  input.onchange=async()=>{const f=input.files?.[0];if(!f)return;try{importTransactions(parseCSV(await f.text()))}catch(e){alert('No se pudo leer el CSV. Usa la plantilla de CozyFin.')}};
  input.click();
}

function render(){
 $("#monthLabel").textContent=`${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
 const ts=transactionsForMonth(), inc=incomeSum(ts), exp=expenseSum(ts), bal=inc-exp;
 $("#monthBalance").textContent=money(bal); $("#monthIncome").textContent=`↑ ${money(inc)}`; $("#monthExpense").textContent=`↓ ${money(exp)}`;
 const budgets=state.budgets.reduce((a,b)=>a+Number(b.limit),0);
 $("#budgetTotal").textContent=money(budgets);$("#spentTotal").textContent=money(exp);
 const planned=upcoming(30).reduce((a,r)=>a+Number(r.amount),0);
 $("#plannedTotal").textContent=money(planned);
 $("#savingRate").textContent=inc?`${Math.round(bal/inc*100)}%`:"0%";
 $("#todayLabel").textContent=dayLabel();
 const wt=weekTransactions(),wi=incomeSum(wt),we=expenseSum(wt);
 $("#weekSummary").textContent=`Semana: ${money(wi)} ingresos · ${money(we)} gastos`;
 const projected=bal-planned;
 $("#projectedBalance").textContent=money(projected);
 $("#todayList").innerHTML=transactionsForMonth().filter(t=>t.date===today()).sort((a,b)=>b.id.localeCompare(a.id)).map(movementHTML).join("")||`<div class="empty">Hoy todavía no hay movimientos.</div>`;
 drawTrend(ts); drawDonut(ts); renderRecent(); renderTransactions(); renderBudgets(); renderPlanning(); renderGoals(); renderAccounts(); renderCards();
}
function drawTrend(ts){
 const c=$("#trendChart"),ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=c.clientWidth,h=210;c.width=w*dpr;c.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
 const days=new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate(), vals=Array.from({length:days},()=>({i:0,e:0}));
 ts.forEach(t=>{let day=parseDate(t.date).getDate()-1;if(vals[day])vals[day][t.type==="income"?"i":"e"]+=Number(t.amount)});
 const max=Math.max(10,...vals.map(v=>Math.max(v.i,v.e)));ctx.strokeStyle="#eadfd2";ctx.lineWidth=1;
 for(let j=0;j<4;j++){let y=18+j*(h-40)/3;ctx.beginPath();ctx.moveTo(8,y);ctx.lineTo(w-8,y);ctx.stroke()}
 function line(key,dash){ctx.beginPath();ctx.setLineDash(dash?[4,5]:[]);ctx.strokeStyle=key==="i"?"#8fa58c":"#c98263";ctx.lineWidth=3;vals.forEach((v,i)=>{let x=10+i*(w-20)/(days-1),y=h-22-(v[key]/max)*(h-45);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.setLineDash([])}
 line("e",false);line("i",true);
 ctx.fillStyle="#9b8d81";ctx.font="10px DM Sans";[0,Math.floor((days-1)/2),days-1].forEach(i=>ctx.fillText(`${i+1}`,10+i*(w-20)/(days-1),h-5));
}
function drawDonut(ts){
 const c=$("#donutChart"),ctx=c.getContext("2d"),dpr=devicePixelRatio||1,w=220;c.width=w*dpr;c.height=w*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,w);
 let map={};ts.filter(t=>t.type==="expense").forEach(t=>map[t.category]=(map[t.category]||0)+Number(t.amount));let arr=Object.entries(map).sort((a,b)=>b[1]-a[1]);let total=arr.reduce((a,x)=>a+x[1],0);
 $("#categoryTotal").textContent=money(total);$("#donutCenter").innerHTML=`${money(total)}<small>gastos</small>`;
 let start=-Math.PI/2;arr.forEach(([n,v],i)=>{let end=start+v/total*Math.PI*2||start;ctx.beginPath();ctx.moveTo(110,110);ctx.arc(110,110,82,start,end);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();start=end});
 ctx.beginPath();ctx.arc(110,110,53,0,Math.PI*2);ctx.fillStyle="#fffdf9";ctx.fill();
 $("#categoryLegend").innerHTML=arr.slice(0,8).map(([n,v],i)=>`<div class="legend-item"><i class="dot" style="background:${palette[i%palette.length]}"></i><b>${esc(n)}</b><span>${money(v)}</span></div>`).join("")||`<div class="empty" style="grid-column:1/-1">Aún no hay gastos este mes.</div>`;
}
function movementHTML(t){
 const c=catInfo(t.category), sign=t.type==="income"?"+":"−";
 return `<div class="movement" data-id="${t.id}"><div class="movement-icon">${c.icon}</div><div class="movement-main"><b>${esc(t.title)}</b><small>${esc(t.category)}${t.subcategory?" · "+esc(t.subcategory):""} · ${formatDate(t.date)}</small></div><div class="amount ${t.type}">${sign}${money(t.amount)}</div></div>`;
}
function renderRecent(){let a=[...transactionsForMonth()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);$("#recentList").innerHTML=a.length?a.map(movementHTML).join(""):`<div class="empty">No hay movimientos. Pulsa ＋ para añadir el primero.</div>`}
function renderTransactions(){
 let a=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date));if(selectedType!=="all")a=a.filter(t=>t.type===selectedType);
 $("#transactionList").innerHTML=a.length?a.map(movementHTML).join(""):`<div class="empty">No hay movimientos.</div>`;
}
function renderBudgets(){
 const ts=transactionsForMonth();
 $("#budgetList").innerHTML=state.budgets.length?state.budgets.map((b,i)=>{let spent=expenseSum(ts.filter(t=>t.category===b.category)),pct=Math.min(100,spent/b.limit*100),over=spent>b.limit;return `<div class="budget-card"><div class="budget-head"><div class="emoji">${catInfo(b.category).icon}</div><div><b>${esc(b.category)}</b><small>${money(spent)} de ${money(b.limit)}</small></div><strong>${Math.round(spent/b.limit*100)}%</strong></div><div class="progress"><i class="${over?"over":""}" style="width:${pct}%"></i></div><div class="budget-foot"><span>${over?`Te has pasado ${money(spent-b.limit)}`:`Te quedan ${money(b.limit-spent)}`}</span><button class="text-btn" data-budget="${i}">Editar</button></div></div>`}).join(""):`<div class="empty">Crea límites por categoría para controlar tus gastos.</div>`;
}
function renderPlanning(){
 let arr=planTab==="recurring"?state.recurring:[...upcoming(90)].sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
 const total=arr.reduce((a,r)=>a+Number(r.amount),0);
 $("#planningList").innerHTML=`<div class="forecast-card"><div><small>Próximos 90 días</small><b>${money(total)}</b></div><span>Previsto</span></div>`+
 (arr.length?arr.map(r=>`<div class="plan-card"><div class="plan-date"><b>${parseDate(r.nextDate).getDate()}</b><small>${parseDate(r.nextDate).toLocaleDateString("es-ES",{month:"short"})}</small></div><div class="plan-main"><b>${esc(r.title)}</b><small>${esc(r.category)} · ${r.frequency==="monthly"?"Mensual":r.frequency==="weekly"?"Semanal":"Anual"} · ${money(r.amount)}</small></div><button class="text-btn" data-payplan="${state.recurring.indexOf(r)}">✓</button><button class="text-btn" data-plan="${state.recurring.indexOf(r)}">Editar</button></div>`).join(""):`<div class="empty">No hay movimientos programados.</div>`);
}
function renderGoals(){
 const box=$("#goalsList"); if(!box)return;
 box.innerHTML=state.goals.length?state.goals.map((g,i)=>{let pct=Math.min(100,Number(g.saved)/Number(g.target)*100);return `<div class="budget-card"><div class="budget-head"><div class="emoji">🎯</div><div><b>${esc(g.name)}</b><small>${money(g.saved)} de ${money(g.target)}</small></div><strong>${Math.round(pct)}%</strong></div><div class="progress"><i style="width:${pct}%"></i></div><div class="budget-foot"><span>Faltan ${money(Math.max(0,g.target-g.saved))}</span><button class="text-btn" data-goal="${i}">Editar</button></div></div>`}).join(""):`<div class="empty">Crea un objetivo para reservar dinero para algo concreto.</div>`;
}
function renderAccounts(){
 const box=$("#accountList"); if(!box)return;
 box.innerHTML=state.accounts.map((a,i)=>`<div class="account-card"><div class="account-icon">${i===0?"🏦":i===1?"💵":"💳"}</div><div><b>${esc(a)}</b><small>Saldo calculado</small></div><strong>${money(accountBalance(a))}</strong><button class="text-btn" data-account-edit="${i}">Editar</button></div>`).join("");
}
function renderCards(){
 const box=$("#cardList"); if(!box)return;
 box.innerHTML=state.cards.length?state.cards.map((c,i)=>`<div class="account-card"><div class="account-icon">💳</div><div><b>${esc(c.name)}</b><small>Cierre día ${c.closeDay} · pago día ${c.payDay}</small></div><button class="text-btn" data-card="${i}">Editar</button></div>`).join(""):`<div class="empty">Añade tus tarjetas para recordar cierre y pago.</div>`;
}

function goalModal(existing=null,index=-1){
 const g=existing||{name:"",target:"",saved:""};
 openModal(`<div class="modal-top"><h3>${existing?"Editar objetivo":"Nuevo objetivo"}</h3><button class="close">×</button></div><div class="form-grid">
 <div class="field"><label>Objetivo</label><input id="gName" value="${esc(g.name)}" placeholder="Ej. Viaje, fondo de emergencia..."></div>
 <div class="form-row"><div class="field"><label>Objetivo (€)</label><input id="gTarget" type="number" step="0.01" value="${g.target}"></div><div class="field"><label>Ahorrado (€)</label><input id="gSaved" type="number" step="0.01" value="${g.saved}"></div></div>
 <button class="primary" id="saveGoal">Guardar</button>${existing?`<button class="danger" id="deleteGoal">Eliminar</button>`:""}</div>`);
 $(".close").onclick=closeModal;$("#saveGoal").onclick=()=>{let obj={name:$("#gName").value.trim(),target:Number($("#gTarget").value),saved:Number($("#gSaved").value)};if(!obj.name||!obj.target){toast("Completa el objetivo");return}if(index>=0)state.goals[index]=obj;else state.goals.push(obj);save();closeModal();render();toast("Objetivo guardado")};if(existing)$("#deleteGoal").onclick=()=>{state.goals.splice(index,1);save();closeModal();render()};
}
function cardModal(existing=null,index=-1){
 const c=existing||{name:"",closeDay:1,payDay:1};
 openModal(`<div class="modal-top"><h3>${existing?"Editar tarjeta":"Nueva tarjeta"}</h3><button class="close">×</button></div><div class="form-grid">
 <div class="field"><label>Nombre</label><input id="cardName" value="${esc(c.name)}" placeholder="Ej. Visa principal"></div>
 <div class="form-row"><div class="field"><label>Día de cierre</label><input id="closeDay" type="number" min="1" max="31" value="${c.closeDay}"></div><div class="field"><label>Día de pago</label><input id="payDay" type="number" min="1" max="31" value="${c.payDay}"></div></div>
 <button class="primary" id="saveCard">Guardar</button>${existing?`<button class="danger" id="deleteCard">Eliminar</button>`:""}</div>`);
 $(".close").onclick=closeModal;$("#saveCard").onclick=()=>{let obj={name:$("#cardName").value.trim(),closeDay:+$("#closeDay").value,payDay:+$("#payDay").value};if(!obj.name){toast("Pon un nombre");return}if(index>=0)state.cards[index]=obj;else state.cards.push(obj);save();closeModal();render();toast("Tarjeta guardada")};if(existing)$("#deleteCard").onclick=()=>{state.cards.splice(index,1);save();closeModal();render()};
}
function dailyReport(){
 let wt=weekTransactions(),d=today(),td=state.transactions.filter(t=>t.date===d);
 openModal(`<div class="modal-top"><h3>Resumen de hoy</h3><button class="close">×</button></div>
 <div class="stats-grid"><div class="stat-card"><span>Ingresos</span><strong class="income">${money(incomeSum(td))}</strong></div><div class="stat-card"><span>Gastos</span><strong class="expense">${money(expenseSum(td))}</strong></div></div>
 <div class="section-head"><h2>Esta semana</h2><span>${formatDate(startOfWeek(new Date()).toISOString().slice(0,10))}</span></div>
 <div class="stats-grid"><div class="stat-card"><span>Ingresos</span><strong>${money(incomeSum(wt))}</strong></div><div class="stat-card"><span>Gastos</span><strong>${money(expenseSum(wt))}</strong></div></div>
 <button class="primary" id="dailyAdd">＋ Añadir movimiento de hoy</button>`);
 $(".close").onclick=closeModal;$("#dailyAdd").onclick=()=>{closeModal();addMovement({type:"expense",amount:"",title:"",date:today(),category:state.categories[0].name,subcategory:"",account:state.accounts[0],notes:""})};
}
function payRecurring(index){
 const r=state.recurring[index];if(!r)return;
 state.transactions.push({id:crypto.randomUUID(),type:r.type||"expense",title:r.title,amount:Number(r.amount),date:r.nextDate,category:r.category,subcategory:"",account:state.accounts[0],notes:"Generado desde planning"});
 let d=parseDate(r.nextDate);
 if(r.frequency==="weekly")d.setDate(d.getDate()+7);else if(r.frequency==="yearly")d.setFullYear(d.getFullYear()+1);else d.setMonth(d.getMonth()+1);
 r.nextDate=iso(d);save();render();toast("Movimiento añadido y próximo pago actualizado");
}
function categoriesModal(){
 openModal(`<div class="modal-top"><h3>Categorías</h3><button class="close">×</button></div><div id="cats"></div><button class="primary" id="newCat">＋ Crear categoría</button>`);
 $(".close").onclick=closeModal;
 const draw=()=>{$("#cats").innerHTML=state.categories.map((c,i)=>`<div class="cat-row"><div class="cat-icon">${c.icon}</div><div><b>${esc(c.name)}</b><small>${c.subs.length?c.subs.map(esc).join(" · "):"Sin subcategorías"}</small></div><button data-editcat="${i}">✎</button></div>`).join("")};draw();
 $("#cats").onclick=e=>{let i=e.target.dataset.editcat;if(i!==undefined)editCat(i,draw)};$("#newCat").onclick=()=>editCat(-1,draw);
}
function editCat(index,redraw){
 const c=index>=0?state.categories[index]:{name:"",icon:"🏷️",subs:[]};
 openModal(`<div class="modal-top"><h3>${index>=0?"Editar categoría":"Nueva categoría"}</h3><button class="close">×</button></div><div class="form-grid">
 <div class="form-row"><div class="field"><label>Nombre</label><input id="cName" value="${esc(c.name)}"></div><div class="field"><label>Icono</label><select id="cIcon">${icons.map(x=>`<option ${x===c.icon?"selected":""}>${x}</option>`).join("")}</select></div></div>
 <div class="field"><label>Subcategorías (separadas por comas)</label><input id="cSubs" value="${esc(c.subs.join(", "))}" placeholder="Ej. Netflix, Spotify"></div>
 <button class="primary" id="saveCat">Guardar</button></div>`);
 $(".close").onclick=()=>{closeModal();categoriesModal()};$("#saveCat").onclick=()=>{let name=$("#cName").value.trim();if(!name){toast("Pon un nombre");return}let obj={name,icon:$("#cIcon").value,subs:$("#cSubs").value.split(",").map(x=>x.trim()).filter(Boolean)};if(index>=0)state.categories[index]=obj;else state.categories.push(obj);save();closeModal();categoriesModal();render()};
}
function accountsModal(){
 openModal(`<div class="modal-top"><h3>Cuentas</h3><button class="close">×</button></div><div class="form-grid"><div class="chip-row">${state.accounts.map((a,i)=>`<span class="chip">${esc(a)} <button data-acc="${i}">×</button></span>`).join("")}</div><div class="field"><label>Nueva cuenta</label><input id="newAccount" placeholder="Ej. Revolut"></div><button class="primary" id="addAccount">Añadir cuenta</button></div>`);
 $(".close").onclick=closeModal;$("#addAccount").onclick=()=>{let a=$("#newAccount").value.trim();if(a&&!state.accounts.includes(a)){state.accounts.push(a);save();accountsModal();render()}};$$("[data-acc]").forEach(b=>b.onclick=()=>{if(state.accounts.length<=1){toast("Necesitas al menos una cuenta");return}state.accounts.splice(Number(b.dataset.acc),1);save();accountsModal()});
}
function navigate(name){$$(".view").forEach(v=>v.classList.remove("active"));$(`#view-${name}`).classList.add("active");$$(".tab").forEach(t=>t.classList.toggle("active",t.dataset.nav===name))}
function exportData(){let blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`cozyfin-${iso(new Date())}.json`;a.click();URL.revokeObjectURL(a.href);toast("Copia exportada")}
$("#importData").onchange=e=>{let f=e.target.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);if(!x.transactions||!x.categories)throw 0;state=x;save();render();toast("Datos restaurados")}catch{toast("Archivo no válido")}};r.readAsText(f)};

$$("[data-nav]").forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
$("#quickAdd").onclick=$("#tabAdd").onclick=()=>addMovement();
$("#prevMonth").onclick=()=>{cursor.setMonth(cursor.getMonth()-1);render()};
$("#nextMonth").onclick=()=>{cursor.setMonth(cursor.getMonth()+1);render()};
$("#typeSegment").onclick=e=>{if(e.target.dataset.type){selectedType=e.target.dataset.type;$$("#typeSegment button").forEach(x=>x.classList.toggle("active",x.dataset.type===selectedType));renderTransactions()}};
$("#addBudget").onclick=()=>budgetModal();$("#addRecurring").onclick=()=>recurringModal();
$("#darkToggle").onclick=()=>{state.dark=!state.dark;document.body.classList.toggle("dark",state.dark);save()};$("#manageCats").onclick=categoriesModal;$("#manageAccounts").onclick=accountsModal;$("#addGoal").onclick=()=>goalModal();$("#addCard").onclick=()=>cardModal();$("#dailyBtn").onclick=dailyReport;$("#exportData").onclick=exportData;
$$(".planning-tabs button").forEach(b=>b.onclick=()=>{planTab=b.dataset.plan;$$(".planning-tabs button").forEach(x=>x.classList.toggle("active",x===b));renderPlanning()});
document.addEventListener("click",e=>{let m=e.target.closest(".movement");if(m){let t=state.transactions.find(x=>x.id===m.dataset.id);if(t)addMovement(t)}
 let b=e.target.closest("[data-budget]");if(b){let i=+b.dataset.budget;budgetModal(state.budgets[i],i)}
 let p=e.target.closest("[data-plan]");if(p){let i=+p.dataset.plan;recurringModal(state.recurring[i],i)} let pp=e.target.closest("[data-payplan]");if(pp)payRecurring(+pp.dataset.payplan); let g=e.target.closest("[data-goal]");if(g)goalModal(state.goals[+g.dataset.goal],+g.dataset.goal); let c=e.target.closest("[data-card]");if(c)cardModal(state.cards[+c.dataset.card],+c.dataset.card);
});
$("#modalBackdrop").onclick=e=>{if(e.target===$("#modalBackdrop"))closeModal()};
document.body.classList.toggle("dark",!!state.dark);render();
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
