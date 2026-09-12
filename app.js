const KEY = 'fluid-log-data-v1';
// Visual fallback only; existing per-day goals and the storage schema stay intact.
const DEFAULT_GOAL_OZ = 150;
const DAY_START_HOUR = 6;
const initial = [['Water',16.9,'08:22'],['Powerade',20,'09:01'],['Water',16.9,'10:32'],['Gatorade Zero',20,'11:58'],['Water',16.9,'13:07'],['Water',16.9,'14:08'],['Powerade',20,'14:47'],['Water',16.9,'16:26'],['Water',16.9,'21:10']].map((x,i)=>({id:i+1,type:x[0],amount:x[1],time:x[2]}));
let data;
try { data = JSON.parse(localStorage.getItem(KEY)); } catch {}
if (!data) data = {days:{'2026-08-28':initial},goals:{},nextId:10};
const $ = s => document.querySelector(s), day = $('#day');
function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function trackingDay(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < DAY_START_HOUR) d.setDate(d.getDate()-1);
  return dateKey(d);
}
function nextSix(now = new Date()) {
  const d = new Date(now);
  d.setHours(DAY_START_HOUR,0,0,0);
  if (d <= now) d.setDate(d.getDate()+1);
  return d;
}
let activeDay = trackingDay();
day.value = activeDay;
$('#time').value = new Date().toTimeString().slice(0,5);
$('#goal').placeholder = DEFAULT_GOAL_OZ;
$('#default-goal').textContent = DEFAULT_GOAL_OZ;
function checkDay() {
  const current = trackingDay();
  if (current !== activeDay) {
    activeDay = current;
    day.value = current;
    $('#time').value = new Date().toTimeString().slice(0,5);
    render();
  }
}
function scheduleDaySwitch() {
  clearTimeout(scheduleDaySwitch.timer);
  scheduleDaySwitch.timer = setTimeout(() => {checkDay(); scheduleDaySwitch();}, Math.max(1000,nextSix()-new Date()+250));
}
function announce(message) {
  clearTimeout(announce.timer);
  $('#status').textContent = message;
  announce.timer = setTimeout(() => {$('#status').textContent='';},2500);
}
function save() {
  try {localStorage.setItem(KEY,JSON.stringify(data));}
  catch {announce('Couldn’t save on this device. Please download a backup.');}
}
function entries() {return data.days[day.value] || (data.days[day.value]=[]);}
function clean(n) {n=Math.round(n*10)/10;return Number.isInteger(n)?String(n):n.toFixed(1);}
function fmt(t) {const [h,m]=t.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
function escapeHtml(s) {return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function render() {
  const es = [...entries()].sort((a,b)=>a.time.localeCompare(b.time));
  const total = es.reduce((s,e)=>s+e.amount,0);
  const goal = Number(data.goals[day.value]) > 0 ? Number(data.goals[day.value]) : DEFAULT_GOAL_OZ;
  const fraction = Math.max(0,Math.min(1,total/goal));
  $('#total').textContent = clean(total);
  $('#percentage').textContent = Math.round(total/goal*100)+'%';
  $('#goal').value = data.goals[day.value] || '';
  $('#goal-display').textContent = clean(goal);
  $('#remaining').textContent = total >= goal ? 'Goal reached' : clean(goal-total)+' oz to go';
  $('#liquid').setAttribute('transform',`translate(0 ${324-fraction*279})`);
  $('#liquid').style.visibility = total > 0 ? 'visible' : 'hidden';
  $('#bottle').setAttribute('aria-valuemax',goal);
  $('#bottle').setAttribute('aria-valuenow',Math.min(total,goal));
  $('#bottle').setAttribute('aria-valuetext',`${clean(total)} of ${clean(goal)} ounces, ${Math.round(total/goal*100)} percent`);
  const isToday = day.value === trackingDay();
  $('#day-label').textContent = isToday ? 'TODAY’S INTAKE' : 'DAILY INTAKE';
  $('#log-title').textContent = isToday ? 'Today’s log' : 'Daily log';
  $('#today').hidden = isToday;
  $('#count').textContent = es.length+(es.length===1?' drink':' drinks');
  $('#entries').innerHTML = es.length ? es.map(e=>`<div class="entry"><div><b>${escapeHtml(e.type)}</b><small>${fmt(e.time)}</small></div><span class="oz">${clean(e.amount)} oz</span><button class="delete" data-id="${e.id}" aria-label="Delete ${escapeHtml(e.type)}, ${clean(e.amount)} ounces at ${fmt(e.time)}">×</button></div>`).join('') : '<div class="empty">No drinks yet. Tap a drink to start filling up.</div>';
  save();
}
function add(type,amount,time) {
  checkDay();
  const oz = Math.round(Number(amount)*10)/10;
  if (!type.trim() || !Number.isFinite(oz) || oz<=0 || oz>500 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return;
  entries().push({id:data.nextId++,type:type.trim(),amount:oz,time});
  render();
  announce(`Added ${clean(oz)} oz ${type.trim()}`);
}
$('#form').addEventListener('submit',e=>{e.preventDefault();add($('#type').value,$('#amount').value,$('#time').value);});
document.querySelectorAll('[data-oz]').forEach(b=>b.onclick=()=>{
  const t=new Date().toTimeString().slice(0,5);
  $('#time').value=t;
  add(b.dataset.type,b.dataset.oz,t);
});
$('#entries').onclick=e=>{
  const button=e.target.closest('[data-id]');
  if(!button)return;
  data.days[day.value]=entries().filter(x=>String(x.id)!==button.dataset.id);
  render();
  announce('Drink removed');
};
day.onchange=()=>{if(day.value)render();};
$('#today').onclick=()=>{day.value=trackingDay();render();};
$('#goal').onchange=e=>{
  if(!e.target.checkValidity())return;
  const v=Number(e.target.value);
  if(v>0)data.goals[day.value]=v;
  else delete data.goals[day.value];
  render();
};
$('#export').onclick=()=>{
  const rows=['Date,Type,Amount (fl oz),Finished At'];
  Object.keys(data.days).sort().forEach(d=>data.days[d].forEach(e=>rows.push([d,'"'+e.type.replaceAll('"','""')+'"',e.amount,fmt(e.time)].join(','))));
  download('fluid-log.csv',rows.join('\n'),'text/csv');
};
$('#backup').onclick=()=>download('fluid-log-backup.json',JSON.stringify(data,null,2),'application/json');
$('#restore').onchange=async e=>{
  const file=e.target.files[0];
  if(!file)return;
  try {
    const v=JSON.parse(await file.text());
    if(!v.days || typeof v.days!=='object' || Array.isArray(v.days))throw Error();
    let maxId=0;
    for(const [date,es] of Object.entries(v.days)) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(es))throw Error();
      for(const entry of es) {
        if(!Number.isInteger(entry.id) || typeof entry.type!=='string' || !Number.isFinite(entry.amount) || entry.amount<=0 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))throw Error();
        maxId=Math.max(maxId,entry.id);
      }
    }
    if(v.goals && (typeof v.goals!=='object' || Array.isArray(v.goals) || Object.values(v.goals).some(g=>!Number.isFinite(Number(g)) || Number(g)<=0)))throw Error();
    v.goals=v.goals||{};
    v.nextId=Math.max(Number.isInteger(v.nextId)?v.nextId:1,maxId+1);
    data=v;
    render();
    announce('Backup restored');
  } catch {alert('That backup file could not be restored.');}
  e.target.value='';
};
function download(name,body,type) {
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([body],{type}));a.download=name;a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkDay();scheduleDaySwitch();}});
window.addEventListener('focus',()=>{checkDay();scheduleDaySwitch();});
scheduleDaySwitch();
render();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
