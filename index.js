const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const REDIRECT_PATH = "/oauth/google/callback";
const DAILY_LIMIT = 500;
const APP_NAME = "Grv Mailer";

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Grv Mailer</title>
<style>
:root{
  --bg:#020b18;--bg2:#041426;--panel:#061a30;--panel2:#081f38;
  --line:#0b67b9;--blue:#10a8ff;--blue2:#1479ff;--cyan:#35d7ff;
  --text:#f4f9ff;--muted:#8da9c6;--green:#21d69b;--red:#ff404d;
  --shadow:0 0 28px rgba(0,145,255,.16);
}
*{box-sizing:border-box}body{margin:0;background:
radial-gradient(circle at 6% 78%,rgba(0,112,255,.30),transparent 24%),
radial-gradient(circle at 80% 5%,rgba(0,102,255,.15),transparent 28%),
linear-gradient(135deg,#010812,#031526 55%,#020b17);color:var(--text);
font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:
radial-gradient(#8ad9ff 1px,transparent 1px);background-size:95px 95px;opacity:.05}
button,input,textarea{font:inherit}button{cursor:pointer}
.top{height:84px;border-bottom:1px solid rgba(0,148,255,.38);display:flex;align-items:center;padding:0 22px;gap:18px;background:rgba(1,10,23,.86);backdrop-filter:blur(18px);position:sticky;top:0;z-index:10}
.brand{display:flex;align-items:center;gap:13px;min-width:330px}.brandIcon{font-size:42px;color:#27baff;text-shadow:0 0 20px #008cff}.brand b{font-size:29px;letter-spacing:-1px}.brand b span{color:#21b9ff}.sub{font-size:13px;color:#a6c1dc}
.search{height:44px;flex:1;max-width:450px;border:1px solid #0b5d9f;border-radius:10px;background:#04182d;color:#a7c7e4;padding:0 15px;outline:none}
.search:focus{border-color:#13a8ff;box-shadow:0 0 0 3px rgba(0,168,255,.10)}
.account{margin-left:auto;display:flex;align-items:center;gap:10px}.gmailBox,.change{border:1px solid #126ab3;background:#06192d;border-radius:10px;color:white;height:48px;padding:0 15px}.gmailBox{display:flex;align-items:center;gap:9px}.gmailLogo{font-size:22px}.change{border-color:#078bdf;color:#fff}.avatar{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#0baeff,#0056e8);font-weight:800}
.layout{display:grid;grid-template-columns:225px 1fr;min-height:calc(100vh - 84px)}
.side{border-right:1px solid rgba(0,117,209,.22);padding:28px 0;background:rgba(1,12,25,.64)}.nav{display:flex;align-items:center;gap:16px;padding:15px 26px;color:#b9d1e8;font-size:15px;border-left:3px solid transparent}.nav:hover,.nav.active{color:#fff;background:linear-gradient(90deg,rgba(0,133,255,.27),transparent);border-left-color:#0baeff;box-shadow:inset 0 0 25px rgba(0,145,255,.08)}.nav i{width:25px;font-style:normal;font-size:19px}.credit{margin:260px 20px 0;border:1px solid #0b6db7;border-radius:12px;padding:18px 12px;text-align:center;background:rgba(3,23,43,.75)}.credit small{color:#b2c7dd}.credit strong{display:block;color:#22b9ff;font-size:19px;margin-top:4px}
.main{padding:20px 22px 28px;min-width:0}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{border:1px solid #075b9e;background:linear-gradient(145deg,rgba(7,30,54,.96),rgba(3,17,33,.92));border-radius:11px;box-shadow:var(--shadow);overflow:hidden}.stat{padding:16px;display:flex;align-items:center;gap:13px;min-height:122px}.statIcon{width:50px;height:50px;border-radius:10px;display:grid;place-items:center;font-size:24px;background:linear-gradient(145deg,#087fff,#05baff);box-shadow:0 0 22px rgba(0,151,255,.32)}.stat h4{margin:0;color:#c9dbed;font-size:14px;font-weight:500}.stat strong{font-size:30px;display:block;margin:4px 0}.up{color:#2ce19d;font-size:13px}.miniChart{margin-left:auto;color:#0caeff;font-size:29px;letter-spacing:2px}
.content{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(320px,1fr);gap:18px;margin-top:18px}.compose{padding:20px}.titleRow{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #0a4777;padding-bottom:14px;margin-bottom:16px}.title{font-size:27px;font-weight:750}.hint{color:#91aec8;font-size:14px;margin-top:2px}.outline{border:1px solid #078be0;background:#05213b;color:#fff;border-radius:9px;padding:10px 14px}
label{display:block;font-size:14px;font-weight:650;margin:12px 0 7px}.field,textarea{width:100%;border:1px solid #0b4e83;background:#03162a;color:#e9f5ff;border-radius:8px;outline:none}.field{height:42px;padding:0 13px}.field:focus,textarea:focus{border-color:#12a9ff;box-shadow:0 0 0 3px rgba(0,169,255,.08)}
.recipients{height:105px;resize:vertical;padding:11px 13px;line-height:1.55}.counts{text-align:right;color:#8ba6c1;font-size:12px;margin-top:-22px;margin-right:11px;position:relative}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}.editor{border:1px solid #0b4e83;border-radius:8px;overflow:hidden;background:#03162a}.toolbar{height:43px;display:flex;gap:15px;align-items:center;padding:0 12px;border-bottom:1px solid #0b4776;color:#cbe1f3}.toolbar span{font-weight:700}.message{height:145px;border:0;border-radius:0;resize:vertical;padding:13px;background:#03162a;color:#edf7ff}.scheduleBar{display:grid;grid-template-columns:auto 55px 1fr;align-items:center;gap:12px;margin-top:16px;border:1px solid #075a96;border-radius:9px;padding:10px 12px;background:#041a30}.toggle{width:48px;height:27px;border-radius:20px;background:#14314d;position:relative;border:1px solid #2a5a7f}.toggle:after{content:"";width:21px;height:21px;border-radius:50%;background:#fff;position:absolute;left:2px;top:2px;transition:.2s}.toggle.on{background:#057fe0}.toggle.on:after{left:23px}.datetime{height:39px;border:1px solid #0a5c96;border-radius:7px;background:#03162a;color:#fff;padding:0 10px;width:100%}.actions{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:12px;margin-top:16px}.btn{height:49px;border-radius:9px;border:1px solid #086eae;background:#041b32;color:#fff;font-weight:650}.btn.primary{background:linear-gradient(90deg,#087cf2,#06b9ff);box-shadow:0 0 24px rgba(0,159,255,.23)}.btn:disabled{opacity:.45;cursor:not-allowed}.btn.danger{background:linear-gradient(90deg,#e33a43,#ff4e57);border-color:#ff6068}
.right{display:flex;flex-direction:column;gap:12px}.panel{padding:14px;border:1px solid #075b9e;background:linear-gradient(145deg,rgba(6,27,48,.96),rgba(2,15,29,.92));border-radius:11px;box-shadow:var(--shadow)}.panel h3{margin:0 0 13px;font-size:16px}.limitTop{display:flex;align-items:center;gap:17px}.ring{width:105px;height:105px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#14c5ff 25.6%,#183650 25.6%);position:relative}.ring:after{content:"";position:absolute;inset:9px;border-radius:50%;background:#06182b}.ringText{position:relative;z-index:1;text-align:center;font-size:20px;font-weight:800}.ringText small{display:block;font-size:11px;color:#9bb3c9}.limitNums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex:1}.limitNums b{font-size:20px;display:block;margin-top:4px}.limitNums span{font-size:11px;color:#8da9c4}.bar{height:12px;background:#142d46;border-radius:99px;overflow:hidden;margin-top:10px}.bar i{display:block;height:100%;width:25.6%;background:linear-gradient(90deg,#08a4ff,#15cfff);border-radius:99px}.reset{margin-top:9px;color:#12c8ff;font-size:13px}.quick{display:grid;grid-template-columns:1fr 1fr;gap:9px}.quick button{height:47px;border:1px solid #075b9e;background:#061c33;color:#dcecff;border-radius:8px;text-align:left;padding:0 12px}.activity li{list-style:none;margin:0;padding:9px 0;border-bottom:1px solid rgba(33,96,145,.25);font-size:12px;display:flex;gap:9px;align-items:center}.activity ul{padding:0;margin:0}.badge{margin-left:auto;border-radius:6px;padding:4px 7px;font-size:10px;background:#0870d6}.badge.green{background:#0b9d70}.badge.red{background:#df3945}.perf{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.perf div{padding:10px;border:1px solid #0b3f69;border-radius:8px}.perf small{color:#91abc2}.perf b{display:block;font-size:18px;margin-top:4px}
.notice{margin-top:8px;color:#ff8790;font-size:12px;min-height:16px}.toast{position:fixed;right:18px;bottom:18px;padding:13px 16px;border:1px solid #078be0;border-radius:10px;background:#061d34;box-shadow:0 0 30px rgba(0,149,255,.25);display:none;z-index:30}
@media(max-width:1100px){.stats{grid-template-columns:repeat(2,1fr)}.content{grid-template-columns:1fr}.right{display:grid;grid-template-columns:1fr 1fr}.top .search{display:none}}
@media(max-width:760px){.top{height:auto;min-height:70px;padding:10px;gap:8px}.brand{min-width:0}.brand b{font-size:20px}.sub{display:none}.gmailBox{display:none}.layout{grid-template-columns:1fr}.side{display:none}.main{padding:10px}.stats{grid-template-columns:1fr 1fr;gap:8px}.stat{padding:10px;min-height:95px}.stat strong{font-size:23px}.miniChart{display:none}.right{display:block}.panel{margin-bottom:10px}.actions{grid-template-columns:1fr}.row{grid-template-columns:1fr}.scheduleBar{grid-template-columns:1fr auto}.datetime{grid-column:1/-1}.title{font-size:22px}}
</style>
</head>
<body>
<header class="top">
  <div class="brand"><div class="brandIcon">➤</div><div><b>Grv <span>Mailer</span></b><div class="sub">Gmail OAuth Email Sender</div></div></div>
  <input class="search" placeholder="⌕  Search emails, contacts, campaigns..." />
  <div class="account">
    <div class="gmailBox"><span class="gmailLogo">✉️</span><span><small style="color:#8da9c6">Connected Gmail</small><br><b id="emailTop">Not connected</b></span>⌄</div>
    <button class="change" id="changeBtn">Change Gmail</button>
    <span style="font-size:24px">♧</span><div class="avatar">GS</div><div><b>Grv Sahu</b><br><small style="color:#8da9c6">Owner</small></div>
  </div>
</header>

<div class="layout">
<aside class="side">
  <div class="nav active">⌂ <span>Dashboard</span></div><div class="nav">➤ <span>Compose Email</span></div>
  <div class="nav">▣ <span>Schedule</span></div><div class="nav">◇ <span>Campaigns</span></div>
  <div class="nav">✉ <span>Sent Emails</span></div><div class="nav">◉ <span>Open Tracking</span></div>
  <div class="nav">▤ <span>Templates</span></div><div class="nav">♧ <span>Contacts</span></div>
  <div class="nav">▥ <span>Analytics</span></div><div class="nav">⚙ <span>Settings</span></div>
  <div class="credit"><small>Designed by</small><strong>Grv Sahu</strong><div style="margin-top:12px;border-top:1px solid #0b4e83;padding-top:10px;color:#718ba5;font-size:12px">Grv Mailer v1.0.0</div></div>
</aside>

<main class="main">
<section class="stats">
  <div class="card stat"><div class="statIcon">✉</div><div><h4>Today Sent</h4><strong id="todaySent">0</strong><span class="up">▲ Live</span></div><div class="miniChart">⌁⌁</div></div>
  <div class="card stat"><div class="statIcon">➤</div><div><h4>Total Sent</h4><strong id="totalSent">0</strong><span class="up">▲ All time</span></div><div class="miniChart">▂▅▇</div></div>
  <div class="card stat"><div class="statIcon">◉</div><div><h4>Today Opens</h4><strong id="todayOpens">0</strong><span class="up">▲ Tracked</span></div><div class="miniChart">⌁⌁</div></div>
  <div class="card stat"><div class="statIcon">◉</div><div><h4>Total Opens</h4><strong id="totalOpens">0</strong><span class="up">▲ Tracked</span></div><div class="miniChart">▂▅▇</div></div>
</section>

<section class="content">
<div class="card compose">
  <div class="titleRow"><div><div class="title">➤ &nbsp;Compose Email</div><div class="hint">Send professional emails to your contacts</div></div><button class="outline">▤ &nbsp; View Templates</button></div>
  <label>♣ &nbsp; Recipients</label>
  <textarea id="recipients" class="recipients" placeholder="Paste or type email addresses (one per line, comma or semicolon separated)"></textarea>
  <div class="counts">Total: <b id="countTotal">0</b> &nbsp; | &nbsp; Unique: <b id="countUnique">0</b></div>
  <div class="row"><div><label>♟ &nbsp; Sender Name</label><input id="senderName" class="field" placeholder="Your Name"></div><div><label>↩ &nbsp; Reply-To <span style="color:#819bb5">(Optional)</span></label><input id="replyTo" class="field" placeholder="reply@example.com"></div></div>
  <label>◆ &nbsp; Subject</label><input id="subject" class="field" placeholder="Enter your email subject...">
  <label>▤ &nbsp; Message</label>
  <div class="editor"><div class="toolbar"><span>B</span><i>I</i><u>U</u><span>☷</span><span>≡</span><span>☰</span><span>↗</span><span>ↄ</span><span>▧</span><span>{ }</span></div><textarea id="message" class="message" placeholder="Write your professional email message here..."></textarea></div>
  <div class="scheduleBar"><b>▣ &nbsp; Schedule Email</b><button id="toggle" class="toggle" aria-label="Schedule toggle"></button><input id="scheduledAt" class="datetime" type="datetime-local" disabled></div>
  <div class="hint" id="scheduleHint" style="margin-top:6px">OFF = Send Now &nbsp; • &nbsp; ON = Schedule</div>
  <div class="actions"><button class="btn">◉ &nbsp; Preview Email</button><button class="btn">▤ &nbsp; Save as Template</button><button id="sendBtn" class="btn primary">➤ &nbsp; Send Email Now</button></div>
  <div id="notice" class="notice"></div>
</div>

<div class="right">
  <div class="panel"><h3>◷ &nbsp; Daily Email Limit</h3><div class="limitTop"><div class="ring"><div class="ringText"><span id="ringSent">0</span><small>/ 500</small></div></div><div class="limitNums"><div><span>Sent Today</span><b id="limitSent">0</b></div><div><span>Remaining</span><b id="remaining">500</b></div><div><span>Daily Limit</span><b>500</b></div></div></div><div class="bar"><i id="bar"></i></div><div class="reset">◷ &nbsp; Resets in: <b id="resetTimer">--</b></div></div>
  <div class="panel"><h3>⚡ &nbsp; Quick Actions</h3><div class="quick"><button>♣ &nbsp; Import Contacts &nbsp;›</button><button id="quickSchedule">▣ &nbsp; Schedule Email &nbsp;›</button><button>▤ &nbsp; View Templates &nbsp;›</button><button>⚙ &nbsp; Email Settings &nbsp;›</button></div></div>
  <div class="panel activity"><h3>〽 &nbsp; Recent Activity</h3><ul id="activity"><li>No activity yet.</li></ul></div>
  <div class="panel"><h3>◫ &nbsp; Campaign Performance</h3><div class="perf"><div><small>Emails Sent</small><b id="perfSent">0</b></div><div><small>Open Rate</small><b id="openRate">0%</b></div><div><small>Click Rate</small><b>—</b></div></div></div>
</div>
</section>
</main>
</div>
<div class="toast" id="toast"></div>

<script>
let scheduleOn=false, me=null, stats={todaySent:0,totalSent:0,todayOpens:0,totalOpens:0,limit:500};
const $=id=>document.getElementById(id);
function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3200)}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function parseRecipients(){
 const raw=$('recipients').value.split(/[\\s,;]+/).map(x=>x.trim()).filter(Boolean);
 const unique=[...new Map(raw.map(x=>[x.toLowerCase(),x])).values()];
 $('countTotal').textContent=raw.length;$('countUnique').textContent=unique.length;return unique;
}
$('recipients').addEventListener('input',parseRecipients);
$('toggle').onclick=()=>{scheduleOn=!scheduleOn;$('toggle').classList.toggle('on',scheduleOn);$('scheduledAt').disabled=!scheduleOn;$('sendBtn').textContent=scheduleOn?'▣  Schedule Email':'➤  Send Email Now';$('scheduleHint').textContent=scheduleOn?'ON = Schedule Email  •  OFF = Send Now':'OFF = Send Now  •  ON = Schedule';};
$('quickSchedule').onclick=()=>{if(!scheduleOn)$('toggle').click();$('scheduledAt').focus()};
$('changeBtn').onclick=()=>location.href='/oauth/google/start';

async function loadMe(){try{const r=await fetch('/api/me');const d=await r.json();if(d.connected){me=d; $('emailTop').textContent=d.email;$('senderName').value=d.name||''}else{$('emailTop').textContent='Not connected';toast('Connect Gmail to send emails')}}catch{}}
async function loadStats(){try{const r=await fetch('/api/stats');stats=await r.json();renderStats()}catch{}}
function renderStats(){
 const sent=Number(stats.todaySent||0), total=Number(stats.totalSent||0), opens=Number(stats.todayOpens||0), totalO=Number(stats.totalOpens||0), lim=Number(stats.limit||500), rem=Math.max(0,lim-sent);
 $('todaySent').textContent=sent;$('totalSent').textContent=total;$('todayOpens').textContent=opens;$('totalOpens').textContent=totalO;
 $('limitSent').textContent=sent;$('ringSent').textContent=sent;$('remaining').textContent=rem;$('perfSent').textContent=total;
 $('bar').style.width=Math.min(100,sent/lim*100)+'%';$('openRate').textContent=total?((totalO/total)*100).toFixed(1)+'%':'0%';
 $('sendBtn').disabled=sent>=lim;
 if(sent>=lim && !scheduleOn)$('sendBtn').title='Daily limit reached';
}
function resetCountdown(){
 const now=new Date(), next=new Date(now); next.setHours(24,0,0,0); let ms=next-now;
 const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);
 $('resetTimer').textContent=h+'h '+m+'m '+s+'s';
}
$('sendBtn').onclick=async()=>{
 const recipients=parseRecipients();if(!recipients.length)return toast('Add at least one recipient.');
 if(!me)return toast('Connect Gmail first.');
 if(!scheduleOn && stats.todaySent+recipients.length>stats.limit)return toast('Daily limit reached. Please wait for reset.');
 if(scheduleOn && !$('scheduledAt').value)return toast('Choose a schedule date and time.');
 const payload={recipients,senderName:$('senderName').value,replyTo:$('replyTo').value,subject:$('subject').value,message:$('message').value,scheduledAt:scheduleOn?new Date($('scheduledAt').value).toISOString():null};
 if(!payload.subject||!payload.message)return toast('Subject and message are required.');
 $('sendBtn').disabled=true;$('notice').textContent='Working...';
 try{const r=await fetch('/api/send',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');toast(scheduleOn?'Email campaign scheduled.':'Emails sent successfully.');$('notice').textContent=d.message||'';if(!scheduleOn){$('recipients').value='';$('subject').value='';$('message').value='';parseRecipients()}await loadStats()}catch(e){toast(e.message)}finally{renderStats()}
};
loadMe();loadStats();parseRecipients();resetCountdown();setInterval(resetCountdown,1000);setInterval(loadStats,30000);
</script>
</body>
</html>`;

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function randomString(n=32) {
  const a = crypto.getRandomValues(new Uint8Array(n));
  return b64url(a);
}
async function sha256(s) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
}
function htmlEscape(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function istKey(date=new Date()) {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}
function json(v,init={}){return new Response(JSON.stringify(v),{...init,headers:{"content-type":"application/json; charset=utf-8",...(init.headers||{})}})}
async function getAccount(env,email){return await env.GRV_KV.get("account:"+email,"json")}
async function saveAccount(env,account){await env.GRV_KV.put("account:"+account.email,JSON.stringify(account))}
async function refreshAccessToken(env,account){
  if(account.access_token && account.expires_at && Date.now()<account.expires_at-60000)return account.access_token;
  if(!account.refresh_token)throw new Error("Gmail session expired. Please connect Gmail again.");
  const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:account.refresh_token,grant_type:"refresh_token"});
  const r=await fetch(GOOGLE_TOKEN,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const d=await r.json();
  if(!r.ok)throw new Error(d.error_description||"Could not refresh Gmail access.");
  account.access_token=d.access_token;account.expires_at=Date.now()+Number(d.expires_in||3600)*1000;
  await saveAccount(env,account);return account.access_token;
}
async function gmailSend(env,account,{to,senderName,replyTo,subject,message,trackingUrl}){
  const token=await refreshAccessToken(env,account);
  const headers=[
    `From: ${senderName ? `${senderName} ` : ""}<${account.email}>`,
    `To: ${to}`,
    `Subject: ${subject.replace(/[\r\n]/g," ")}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`
  ];
  if(replyTo)headers.push(`Reply-To: ${replyTo}`);
  const pixel=trackingUrl?`<img src="${trackingUrl}" width="1" height="1" style="display:none!important" alt="">`:"";
  const html=String(message).replace(/\n/g,"<br>")+pixel;
  const raw=headers.join("\r\n")+"\r\n\r\n"+html;
  const r=await fetch(GMAIL_SEND,{method:"POST",headers:{Authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({raw:b64url(raw)})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error?.message||"Gmail send failed.");
  return d;
}
async function parseAndUnique(body){
  const raw=Array.isArray(body.recipients)?body.recipients.join("\n"):String(body.recipients||"");
  const parts=raw.split(/[\s,;]+/).map(x=>x.trim()).filter(Boolean);
  return [...new Map(parts.map(x=>[x.toLowerCase(),x])).values()].filter(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
}
async function getStats(env){
  const day=istKey();
  return {
    todaySent:Number(await env.GRV_KV.get("stat:sent:"+day)||0),
    totalSent:Number(await env.GRV_KV.get("stat:totalSent")||0),
    todayOpens:Number(await env.GRV_KV.get("stat:opens:"+day)||0),
    totalOpens:Number(await env.GRV_KV.get("stat:totalOpens")||0),
    limit:DAILY_LIMIT
  };
}
async function inc(env,key,n=1){
  const current=Number(await env.GRV_KV.get(key)||0);await env.GRV_KV.put(key,String(current+n));return current+n;
}
async function sendCampaign(env,account,payload,baseUrl){
  const recipients=await parseAndUnique(payload);
  if(!recipients.length)throw new Error("No valid recipients.");
  const day=istKey(), sent=Number(await env.GRV_KV.get("stat:sent:"+day)||0);
  if(sent+recipients.length>DAILY_LIMIT)throw new Error(`Daily limit reached. Remaining today: ${Math.max(0,DAILY_LIMIT-sent)}.`);
  let count=0;
  for(const to of recipients){
    const id=randomString(18);
    const trackingUrl=`${baseUrl}/t/open/${id}`;
    await env.GRV_KV.put("tracking:"+id,JSON.stringify({email:to,day,createdAt:Date.now()}),{expirationTtl:60*60*24*90});
    await gmailSend(env,account,{to,senderName:payload.senderName||"",replyTo:payload.replyTo||"",subject:payload.subject||"",message:payload.message||"",trackingUrl});
    await inc(env,"stat:sent:"+day);await inc(env,"stat:totalSent");count++;
  }
  return count;
}
function baseUrl(request){return new URL(request.url).origin}

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  try{
   if(url.pathname==="/")return new Response(APP_HTML,{headers:{"content-type":"text/html;charset=UTF-8"}});
   if(url.pathname==="/oauth/google/start"){
    const verifier=randomString(48), challenge=b64url(await sha256(verifier)), state=randomString(24);
    await env.GRV_KV.put("oauth:"+state,JSON.stringify({verifier,createdAt:Date.now()}),{expirationTtl:600});
    const p=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:baseUrl(request)+REDIRECT_PATH,response_type:"code",scope:"openid email https://www.googleapis.com/auth/gmail.send",access_type:"offline",prompt:"consent",include_granted_scopes:"true",code_challenge:challenge,code_challenge_method:"S256",state});
    return Response.redirect(GOOGLE_AUTH+"?"+p.toString(),302);
   }
   if(url.pathname===REDIRECT_PATH){
    const code=url.searchParams.get("code"),state=url.searchParams.get("state");if(!code||!state)return new Response("OAuth failed.",{status:400});
    const saved=await env.GRV_KV.get("oauth:"+state,"json");if(!saved)return new Response("OAuth state expired. Try again.",{status:400});
    await env.GRV_KV.delete("oauth:"+state);
    const body=new URLSearchParams({code,client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:baseUrl(request)+REDIRECT_PATH,grant_type:"authorization_code",code_verifier:saved.verifier});
    const tr=await fetch(GOOGLE_TOKEN,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});const td=await tr.json();
    if(!tr.ok)return new Response("Google token exchange failed: "+(td.error_description||"unknown error"),{status:400});
    const ur=await fetch(GOOGLE_USERINFO,{headers:{Authorization:`Bearer ${td.access_token}`}});const ud=await ur.json();
    if(!ur.ok||!ud.email)return new Response("Could not read Google account.",{status:400});
    const old=await getAccount(env,ud.email);
    const account={email:ud.email,name:ud.name||ud.email.split("@")[0],access_token:td.access_token,expires_at:Date.now()+Number(td.expires_in||3600)*1000,refresh_token:td.refresh_token||old?.refresh_token};
    await saveAccount(env,account);
    const cookie=`grv_session=${encodeURIComponent(account.email)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
    return new Response(null,{status:302,headers:{Location:"/", "Set-Cookie":cookie}});
   }
   if(url.pathname==="/api/me"){
    const cookie=request.headers.get("Cookie")||"",m=cookie.match(/(?:^|;\s*)grv_session=([^;]+)/);if(!m)return json({connected:false});
    const email=decodeURIComponent(m[1]),a=await getAccount(env,email);return json(a?{connected:true,email:a.email,name:a.name}:{connected:false});
   }
   if(url.pathname==="/logout"){return new Response(null,{status:302,headers:{Location:"/","Set-Cookie":"grv_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"}})}
   if(url.pathname==="/api/stats")return json(await getStats(env));
   if(url.pathname.startsWith("/t/open/") && url.pathname.split("/").length===4){
     const id=url.pathname.split("/").pop(),data=await env.GRV_KV.get("tracking:"+id,"json");
     if(data && !(await env.GRV_KV.get("opened:"+id))){await env.GRV_KV.put("opened:"+id,"1",{expirationTtl:60*60*24*90});await inc(env,"stat:opens:"+data.day);await inc(env,"stat:totalOpens")}
     const pixel=Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),c=>c.charCodeAt(0));
     return new Response(pixel,{headers:{"content-type":"image/png","cache-control":"no-store, no-cache, must-revalidate"}});
   }
   if(url.pathname==="/api/send"&&request.method==="POST"){
    const cookie=request.headers.get("Cookie")||"",m=cookie.match(/(?:^|;\s*)grv_session=([^;]+)/);if(!m)return json({error:"Connect Gmail first."},{status:401});
    const email=decodeURIComponent(m[1]),account=await getAccount(env,email);if(!account)return json({error:"Connect Gmail first."},{status:401});
    const payload=await request.json();const recipients=await parseAndUnique(payload);if(!recipients.length)return json({error:"No valid recipients."},{status:400});
    const stats=await getStats(env);if(stats.todaySent+recipients.length>DAILY_LIMIT)return json({error:`Daily limit reached. Remaining: ${Math.max(0,DAILY_LIMIT-stats.todaySent)}`},{status:429});
    if(payload.scheduledAt){
      const when=Date.parse(payload.scheduledAt);if(!Number.isFinite(when)||when<=Date.now())return json({error:"Choose a future schedule time."},{status:400});
      const id=randomString(18);await env.GRV_KV.put("schedule:"+id,JSON.stringify({id,accountEmail:email,payload:{...payload,recipients},scheduledAt:when,createdAt:Date.now()}),{expirationTtl:60*60*24*30});
      return json({ok:true,message:`Scheduled ${recipients.length} email${recipients.length===1?"":"s"} successfully.`});
    }
    const count=await sendCampaign(env,account,{...payload,recipients},baseUrl(request));return json({ok:true,message:`Sent ${count} email${count===1?"":"s"} individually.`});
   }
   return new Response("Not found",{status:404});
  }catch(e){return json({error:e.message||"Server error."},{status:500})}
 },
 async scheduled(event,env,ctx){
   ctx.waitUntil((async()=>{
    const list=await env.GRV_KV.list({prefix:"schedule:"});
    for(const key of list.keys){
      const item=await env.GRV_KV.get(key.name,"json");if(!item)continue;
      if(item.scheduledAt>Date.now())continue;
      try{
        const account=await getAccount(env,item.accountEmail);if(!account)throw new Error("Gmail account not found. Reconnect Gmail.");
        await sendCampaign(env,account,item.payload,env.WORKER_HOST||"");
        await env.GRV_KV.delete(key.name);
      }catch(err){
        await env.GRV_KV.put("schedule-error:"+item.id,JSON.stringify({error:err.message,at:Date.now()}),{expirationTtl:60*60*24*7});
        await env.GRV_KV.delete(key.name);
      }
    }
   })());
 }
};
