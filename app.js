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
function load(){try{return JSON.parse(localStorage.getItem(KEY))||seed()}catch{return seed()}}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function money(n){return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR"}).format(n||0)}
function iso(d){return new Date(d).toISOString().slice(0,10)}
function parseDate(s){return new Date(s+"T12:00:00")}
function monthKey(d){let x=new Date(d);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}`}
function currentMonth(){return monthKey(cursor)}
function formatDate(s){return parseDate(s).toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}
function toast(t){let e=$("#toast");e.textContent=t;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),1800)}
function catInfo(name){return state.categories.find(c=>c.name===name)||{name,icon:"📦",subs:[]}}
function transactionsForMonth(k=currentMonth()){return state.transactions.filter(t=>monthKey(parseDate(t.date))===k)}
function expenseSum(ts){return ts.filter(t=>t.type==="expense").reduce((a,t)=>a+Number(t.amount),0)}
function incomeSum(ts){return ts.filter(t=>t.type==="income").reduce((a,t)=>a+Number(t.amount),0)}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

function render(){
 $("#monthLabel").textContent=`${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
 const ts=transactionsForMonth(), inc=incomeSum(ts), exp=expenseSum(ts);
 $("#monthBalance").textContent=money(inc-exp); $("#monthIncome").textContent=`↑ ${money(inc)}`; $("#monthExpense").textContent=`↓ ${money(exp)}`;
 const budgets=state.budgets.reduce((a,b)=>a+Number(b.limit),0);
 $("#budgetTotal").textContent=money(budgets);$("#spentTotal").textContent=money(exp);
 const planned=state.recurring.filter(r=>r.active!==false).reduce((a,r)=>a+Number(r.amount),0);
 $("#plannedTotal").textContent=money(planned);$("#savingRate").textContent=inc?`${Math.round((inc-exp)/inc*100)}%`:"0%";
 drawTrend(ts); drawDonut(ts); renderRecent(); renderTransactions(); renderBudgets(); renderPlanning();
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
 let arr=planTab==="recurring"?state.recurring:[...state.recurring].filter(r=>r.active!==false).sort((a,b)=>a.nextDate.localeCompare(b.nextDate));
 $("#planningList").innerHTML=arr.length?arr.map((r,i)=>`<div class="plan-card"><div class="plan-date"><b>${parseDate(r.nextDate).getDate()}</b><small>${parseDate(r.nextDate).toLocaleDateString("es-ES",{month:"short"})}</small></div><div class="plan-main"><b>${esc(r.title)}</b><small>${esc(r.category)} · ${r.frequency==="monthly"?"Mensual":r.frequency==="weekly"?"Semanal":"Anual"} · ${money(r.amount)}</small></div><button class="text-btn" data-plan="${state.recurring.indexOf(r)}">Editar</button></div>`).join(""):`<div class="empty">Programa nóminas, alquileres, suscripciones, seguros y otros pagos futuros.</div>`;
}

function openModal(html){$("#modal").innerHTML=html;$("#modalBackdrop").classList.add("open")}
function closeModal(){$("#modalBackdrop").classList.remove("open")}
function addMovement(existing=null){
 const t=existing||{type:"expense",amount:"",title:"",date:iso(new Date()),category:state.categories[0].name,subcategory:"",account:state.accounts[0],notes:""};
 openModal(`<div class="modal-top"><h3>${existing?"Editar movimiento":"Nuevo movimiento"}</h3><button class="close" id="closeModal">×</button></div>
 <div class="form-grid">
 <div class="choice-row"><button class="choice ${t.type==="expense"?"active":""}" data-t="expense">Gasto</button><button class="choice ${t.type==="income"?"active":""}" data-t="income">Ingreso</button></div>
 <div class="field"><label>Concepto</label><input id="fTitle" value="${esc(t.title)}" placeholder="Ej. Nómina, supermercado..."></div>
 <div class="form-row"><div class="field"><label>Importe (€)</label><input id="fAmount" type="number" step="0.01" value="${t.amount}"></div><div class="field"><label>Fecha</label><input id="fDate" type="date" value="${t.date}"></div></div>
 <div class="form-row"><div class="field"><label>Categoría</label><select id="fCat">${state.categories.map(c=>`<option ${c.name===t.category?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div><div class="field"><label>Subcategoría</label><select id="fSub"></select></div></div>
 <div class="field"><label>Cuenta</label><select id="fAccount">${state.accounts.map(a=>`<option ${a===t.account?"selected":""}>${esc(a)}</option>`).join("")}</select></div>
 <div class="field"><label>Notas</label><textarea id="fNotes">${esc(t.notes||"")}</textarea></div>
 <button class="primary" id="saveMovement">Guardar movimiento</button>${existing?`<button class="danger" id="deleteMovement">Eliminar movimiento</button>`:""}
 </div>`);
 let typ=t.type; $$(".choice").forEach(b=>b.onclick=()=>{$$(".choice").forEach(x=>x.classList.remove("active"));b.classList.add("active");typ=b.dataset.t});
 function subs(){let c=state.categories.find(x=>x.name===$("#fCat").value);$("#fSub").innerHTML=`<option value="">Sin subcategoría</option>`+(c?.subs||[]).map(s=>`<option ${s===t.subcategory?"selected":""}>${esc(s)}</option>`).join("")}
 subs();$("#fCat").onchange=subs;$("#closeModal").onclick=closeModal;
 $("#saveMovement").onclick=()=>{let amount=Number($("#fAmount").value);if(!$("#fTitle").value.trim()||!amount||amount<0){toast("Completa concepto e importe");return}
 const obj={id:t.id||crypto.randomUUID(),type:typ,title:$("#fTitle").value.trim(),amount,date:$("#fDate").value,category:$("#fCat").value,subcategory:$("#fSub").value,account:$("#fAccount").value,notes:$("#fNotes").value};
 if(existing)state.transactions=state.transactions.map(x=>x.id===existing.id?obj:x);else state.transactions.push(obj);save();closeModal();render();toast("Movimiento guardado")};
 if(existing)$("#deleteMovement").onclick=()=>{state.transactions=state.transactions.filter(x=>x.id!==existing.id);save();closeModal();render();toast("Movimiento eliminado")};
}
function budgetModal(existing=null,index=-1){
 const b=existing||{category:state.categories[0].name,limit:""};
 openModal(`<div class="modal-top"><h3>${existing?"Editar presupuesto":"Nuevo presupuesto"}</h3><button class="close">×</button></div><div class="form-grid">
 <div class="field"><label>Categoría</label><select id="bCat">${state.categories.map(c=>`<option ${c.name===b.category?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
 <div class="field"><label>Límite mensual (€)</label><input id="bLimit" type="number" step="0.01" value="${b.limit}"></div>
 <button class="primary" id="saveBudget">Guardar límite</button>${existing?`<button class="danger" id="deleteBudget">Eliminar</button>`:""}</div>`);
 $(".close").onclick=closeModal;$("#saveBudget").onclick=()=>{let limit=Number($("#bLimit").value);if(!limit){toast("Introduce un límite");return}let obj={category:$("#bCat").value,limit};if(index>=0)state.budgets[index]=obj;else state.budgets.push(obj);save();closeModal();render();toast("Presupuesto guardado")};if(existing)$("#deleteBudget").onclick=()=>{state.budgets.splice(index,1);save();closeModal();render()};
}
function recurringModal(existing=null,index=-1){
 const r=existing||{title:"",amount:"",category:state.categories[0].name,nextDate:iso(new Date()),frequency:"monthly",active:true};
 openModal(`<div class="modal-top"><h3>${existing?"Editar planificación":"Programar movimiento"}</h3><button class="close">×</button></div><div class="form-grid">
 <div class="field"><label>Concepto</label><input id="rTitle" value="${esc(r.title)}" placeholder="Ej. Nómina"></div>
 <div class="form-row"><div class="field"><label>Importe (€)</label><input id="rAmount" type="number" step="0.01" value="${r.amount}"></div><div class="field"><label>Próxima fecha</label><input id="rDate" type="date" value="${r.nextDate}"></div></div>
 <div class="form-row"><div class="field"><label>Categoría</label><select id="rCat">${state.categories.map(c=>`<option ${c.name===r.category?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div><div class="field"><label>Frecuencia</label><select id="rFreq"><option value="monthly" ${r.frequency==="monthly"?"selected":""}>Mensual</option><option value="weekly" ${r.frequency==="weekly"?"selected":""}>Semanal</option><option value="yearly" ${r.frequency==="yearly"?"selected":""}>Anual</option></select></div></div>
 <button class="primary" id="saveRecurring">Guardar</button>${existing?`<button class="danger" id="deleteRecurring">Eliminar</button>`:""}</div>`);
 $(".close").onclick=closeModal;$("#saveRecurring").onclick=()=>{let obj={id:r.id||crypto.randomUUID(),title:$("#rTitle").value.trim(),amount:Number($("#rAmount").value),category:$("#rCat").value,nextDate:$("#rDate").value,frequency:$("#rFreq").value,active:true};if(!obj.title||!obj.amount){toast("Completa los datos");return}if(index>=0)state.recurring[index]=obj;else state.recurring.push(obj);save();closeModal();render();toast("Planificación guardada")};if(existing)$("#deleteRecurring").onclick=()=>{state.recurring.splice(index,1);save();closeModal();render()};
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
$("#manageCats").onclick=categoriesModal;$("#manageAccounts").onclick=accountsModal;$("#exportData").onclick=exportData;
$$(".planning-tabs button").forEach(b=>b.onclick=()=>{planTab=b.dataset.plan;$$(".planning-tabs button").forEach(x=>x.classList.toggle("active",x===b));renderPlanning()});
document.addEventListener("click",e=>{let m=e.target.closest(".movement");if(m){let t=state.transactions.find(x=>x.id===m.dataset.id);if(t)addMovement(t)}
 let b=e.target.closest("[data-budget]");if(b){let i=+b.dataset.budget;budgetModal(state.budgets[i],i)}
 let p=e.target.closest("[data-plan]");if(p){let i=+p.dataset.plan;recurringModal(state.recurring[i],i)}
});
$("#modalBackdrop").onclick=e=>{if(e.target===$("#modalBackdrop"))closeModal()};
render();
if("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
