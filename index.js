const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_SEND =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

const REDIRECT_PATH = "/oauth/google/callback";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function html(data, status = 200) {
  return new Response(data, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8"
    }
  });
}

function randomString(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));

  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64Url(bytes) {
  let binary = "";

  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createCodeChallenge(verifier) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier)
  );

  return base64Url(hash);
}

function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";

  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return null;
}

function sessionCookie(id) {
  return (
    "grv_session=" +
    encodeURIComponent(id) +
    "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800"
  );
}

function clearSessionCookie() {
  return "grv_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function getRecipients(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\n,;]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  ];
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function encodeMessage(text) {
  return btoa(
    unescape(
      encodeURIComponent(text)
    )
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createRawEmail({
  to,
  subject,
  body,
  senderName,
  senderEmail,
  replyTo
}) {
  const cleanName = String(senderName || "")
    .replace(/[\r\n"]/g, "");

  const cleanSubject = String(subject || "")
    .replace(/[\r\n]/g, " ");

  const headers = [
    `From: ${
      cleanName
        ? `"${cleanName}" <${senderEmail}>`
        : `<${senderEmail}>`
    }`,
    `To: <${to}>`,
    `Subject: ${cleanSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit"
  ];

  if (replyTo && validEmail(replyTo)) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  return headers.join("\r\n") + "\r\n\r\n" + String(body || "");
}

async function getSession(request, env) {
  const sessionId = getCookie(request, "grv_session");

  if (!sessionId) {
    return null;
  }

  const data = await env.GRV_KV.get(
    `session:${sessionId}`
  );

  if (!data) {
    return null;
  }

  return {
    id: sessionId,
    ...JSON.parse(data)
  };
}

async function refreshToken(env, session) {
  if (
    session.expires_at &&
    Date.now() < session.expires_at - 60000
  ) {
    return session;
  }

  if (!session.refresh_token) {
    throw new Error(
      "Google refresh token is missing. Please connect Google again."
    );
  }

  const params = new URLSearchParams();

  params.set(
    "client_id",
    env.GOOGLE_CLIENT_ID
  );

  params.set(
    "client_secret",
    env.GOOGLE_CLIENT_SECRET
  );

  params.set(
    "refresh_token",
    session.refresh_token
  );

  params.set(
    "grant_type",
    "refresh_token"
  );

  const response = await fetch(
    GOOGLE_TOKEN,
    {
      method: "POST",
      headers: {
        "content-type":
          "application/x-www-form-urlencoded"
      },
      body: params
    }
  );

  if (!response.ok) {
    throw new Error(
      "Google token refresh failed: " +
        (await response.text())
    );
  }

  const data = await response.json();

  return {
    ...session,
    access_token: data.access_token,
    expires_at:
      Date.now() +
      Number(data.expires_in || 3600) * 1000
  };
}

const APP_HTML = `<!DOCTYPE html>
<html>
<head>

<meta name="viewport" content="width=device-width,initial-scale=1">

<title>Grv Mailer</title>

<style>

*{
  box-sizing:border-box;
}

html{
  scroll-behavior:smooth;
}

body{
  margin:0;
  font-family:Inter,Arial,system-ui,sans-serif;
  background:
    radial-gradient(
      circle at top left,
      #e9d5ff 0,
      #f5f7ff 35%,
      #eef7ff 100%
    );
  color:#172033;
  min-height:100vh;
}

button,
input,
textarea{
  font:inherit;
}

button{
  cursor:pointer;
}

.app{
  max-width:1200px;
  margin:auto;
  padding:20px;
}

/* TOP BAR */

.topbar{
  background:
    linear-gradient(
      135deg,
      #2563eb,
      #4f46e5,
      #7c3aed,
      #db2777
    );

  border-radius:22px;

  padding:17px 20px;

  color:white;

  display:flex;
  align-items:center;
  justify-content:space-between;

  gap:15px;

  box-shadow:
    0 15px 40px rgba(79,70,229,.25);

  margin-bottom:22px;
}

.brand{
  display:flex;
  align-items:center;
  gap:12px;
}

.brand-icon{
  width:48px;
  height:48px;

  border-radius:15px;

  background:
    rgba(255,255,255,.18);

  display:flex;
  align-items:center;
  justify-content:center;

  font-size:25px;

  box-shadow:
    inset 0 0 0 1px rgba(255,255,255,.15);
}

.brand h1{
  margin:0;
  font-size:24px;
  letter-spacing:-.4px;
}

.brand small{
  opacity:.86;
  font-size:12px;
}

.account{
  display:flex;
  align-items:center;
  gap:10px;
}

.connected{
  background:
    rgba(255,255,255,.16);

  border:
    1px solid rgba(255,255,255,.25);

  padding:9px 13px;

  border-radius:12px;

  font-size:13px;

  backdrop-filter:blur(8px);
}

.dot{
  display:inline-block;

  width:8px;
  height:8px;

  background:#4ade80;

  border-radius:50%;

  margin-right:6px;

  box-shadow:
    0 0 8px rgba(74,222,128,.8);
}

.disconnect-top{
  border:0;

  background:white;

  color:#dc2626;

  padding:9px 14px;

  border-radius:11px;

  font-weight:750;
}

/* LOGIN */

.login-card{
  max-width:650px;

  margin:70px auto;

  background:
    rgba(255,255,255,.96);

  border-radius:25px;

  padding:45px 30px;

  text-align:center;

  box-shadow:
    0 20px 55px rgba(31,41,55,.12);
}

.login-icon{
  width:78px;
  height:78px;

  margin:auto;

  border-radius:23px;

  background:
    linear-gradient(
      135deg,
      #2563eb,
      #7c3aed,
      #db2777
    );

  display:flex;
  align-items:center;
  justify-content:center;

  color:white;

  font-size:38px;

  box-shadow:
    0 12px 30px rgba(124,58,237,.28);
}

.login-card h2{
  margin:20px 0 8px;

  font-size:28px;
}

.login-card p{
  color:#667085;

  line-height:1.6;

  margin-bottom:28px;
}

.google-btn{
  display:inline-flex;

  align-items:center;
  justify-content:center;

  gap:10px;

  text-decoration:none;

  background:white;

  color:#202124;

  border:
    1px solid #d0d5dd;

  padding:13px 22px;

  border-radius:13px;

  font-weight:700;

  box-shadow:
    0 5px 15px rgba(0,0,0,.06);

  transition:.2s;
}

.google-btn:hover{
  transform:translateY(-1px);

  box-shadow:
    0 8px 20px rgba(0,0,0,.10);
}

/* DASHBOARD */

.dashboard{
  display:grid;

  grid-template-columns:
    minmax(0,1fr) 320px;

  gap:22px;
}

.card{
  background:
    rgba(255,255,255,.94);

  border:
    1px solid rgba(255,255,255,.85);

  border-radius:22px;

  padding:24px;

  box-shadow:
    0 15px 40px rgba(31,41,55,.08);
}

/* COMPOSE */

.compose-title{
  display:flex;

  align-items:center;

  gap:12px;

  margin-bottom:22px;
}

.compose-icon{
  width:46px;
  height:46px;

  border-radius:14px;

  background:
    linear-gradient(
      135deg,
      #2563eb,
      #7c3aed
    );

  color:white;

  display:flex;

  align-items:center;
  justify-content:center;

  font-size:22px;

  box-shadow:
    0 8px 20px rgba(79,70,229,.22);
}

.compose-title h2{
  margin:0;

  font-size:22px;
}

.compose-title p{
  margin:3px 0 0;

  color:#667085;

  font-size:13px;
}

/* EMAIL */

.email-box{
  background:
    linear-gradient(
      135deg,
      #eef2ff,
      #faf5ff
    );

  border:
    1px solid #ddd6fe;

  padding:13px 15px;

  border-radius:13px;

  display:flex;

  align-items:center;

  gap:10px;

  color:#4338ca;

  font-weight:650;

  margin-bottom:20px;
}

.email-circle{
  width:36px;
  height:36px;

  border-radius:50%;

  background:white;

  display:flex;

  align-items:center;
  justify-content:center;

  box-shadow:
    0 3px 8px rgba(0,0,0,.06);
}

/* FIELDS */

.field{
  margin-bottom:18px;
}

label{
  display:block;

  font-size:14px;

  font-weight:750;

  margin-bottom:7px;
}

input,
textarea{
  width:100%;

  border:
    1px solid #d8dee9;

  background:#fbfcff;

  border-radius:12px;

  padding:13px 14px;

  outline:none;

  color:#172033;

  transition:.2s;
}

input:focus,
textarea:focus{
  border-color:#7c3aed;

  box-shadow:
    0 0 0 4px rgba(124,58,237,.10);

  background:white;
}

textarea{
  min-height:135px;

  resize:vertical;
}

#body{
  min-height:210px;
}

/* HELP TEXT */

.info{
  color:#667085;

  font-size:12px;

  line-height:1.6;

  margin-top:6px;
}

/* CONSENT */

.consent{
  background:
    linear-gradient(
      135deg,
      #f0fdf4,
      #ecfeff
    );

  border:
    1px solid #bbf7d0;

  border-radius:13px;

  padding:13px;

  color:#166534;

  font-size:13px;

  line-height:1.5;
}

.consent label{
  display:flex;

  align-items:flex-start;

  gap:9px;

  margin:0;

  font-weight:500;
}

.consent input{
  width:auto;

  margin-top:3px;
}

/* BUTTONS */

.actions{
  display:flex;

  gap:12px;

  margin-top:22px;
}

.send-btn{
  flex:1;

  padding:14px 18px;

  border-radius:13px;

  color:white;

  font-weight:800;

  background:
    linear-gradient(
      135deg,
      #2563eb,
      #7c3aed,
      #db2777
    );

  box-shadow:
    0 9px 22px rgba(124,58,237,.25);

  border:0;

  transition:.2s;
}

.send-btn:hover{
  transform:translateY(-1px);

  box-shadow:
    0 12px 28px rgba(124,58,237,.32);
}

.send-btn:disabled{
  opacity:.7;

  cursor:not-allowed;

  transform:none;
}

.logout-btn{
  padding:14px 18px;

  border-radius:13px;

  background:#fef2f2;

  color:#dc2626;

  font-weight:750;

  border:1px solid #fee2e2;
}

/* SIDEBAR */

.side-card{
  margin-bottom:18px;
}

.side-title{
  font-size:17px;

  font-weight:800;

  margin-bottom:15px;
}

.status-card{
  background:
    linear-gradient(
      135deg,
      #ecfdf5,
      #eff6ff
    );

  border-radius:15px;

  padding:16px;

  border:
    1px solid #dbeafe;
}

.status-row{
  display:flex;

  align-items:center;

  gap:10px;

  margin-bottom:8px;
}

.status-row:last-child{
  margin-bottom:0;
}

.status-dot{
  width:10px;
  height:10px;

  border-radius:50%;

  background:#22c55e;

  box-shadow:
    0 0 8px rgba(34,197,94,.5);
}

.status-text{
  font-weight:700;
}

/* TIPS */

.tip{
  display:flex;

  gap:10px;

  padding:10px 0;

  border-bottom:
    1px solid #eef0f4;

  font-size:13px;

  line-height:1.4;
}

.tip:last-child{
  border-bottom:0;
}

.tip-icon{
  flex:none;
}

/* STATUS */

.status{
  margin-top:18px;

  padding:13px;

  border-radius:12px;

  background:#f8fafc;

  color:#344054;

  white-space:pre-wrap;

  word-break:break-word;

  font-size:13px;

  min-height:20px;
}

/* FOOTER */

.footer{
  text-align:center;

  color:#98a2b3;

  font-size:12px;

  padding:20px 0 5px;
}

.hidden{
  display:none!important;
}

/* MOBILE */

@media(max-width:850px){

  .app{
    padding:12px;
  }

  .topbar{
    border-radius:17px;

    padding:15px;

    align-items:flex-start;
  }

  .brand h1{
    font-size:20px;
  }

  .account{
    display:none;
  }

  .dashboard{
    grid-template-columns:1fr;
  }

  .card{
    padding:18px;

    border-radius:18px;
  }

  .login-card{
    margin:35px auto;

    padding:35px 20px;
  }

  .actions{
    flex-direction:column;
  }

  .logout-btn{
    width:100%;
  }
}

@media(max-width:480px){

  .brand-icon{
    width:40px;
    height:40px;

    font-size:21px;
  }

  .brand h1{
    font-size:18px;
  }

  .compose-title h2{
    font-size:19px;
  }

  input,
  textarea{
    font-size:14px;
  }

  .login-card h2{
    font-size:24px;
  }
}

</style>

</head>

<body>

<div class="app">

<!-- LOGIN -->

<div
  id="loginBox"
  class="login-card"
>

  <div class="login-icon">
    ✉
  </div>

  <h2>
    Welcome to Grv Mailer
  </h2>

  <p>
    Connect your Gmail account securely with Google OAuth
    and send emails individually.
  </p>

  <a
    class="google-btn"
    href="/auth/google"
  >
    🔐 Continue with Google
  </a>

</div>


<!-- APPLICATION -->

<div
  id="appBox"
  class="hidden"
>

  <!-- HEADER -->

  <div class="topbar">

    <div class="brand">

      <div class="brand-icon">
        ✈
      </div>

      <div>

        <h1>
          Grv Mailer
        </h1>

        <small>
          Professional Email Sender
        </small>

      </div>

    </div>


    <div class="account">

      <div class="connected">

        <span class="dot"></span>

        Connected

      </div>

      <button
        class="disconnect-top"
        id="topLogout"
      >
        Disconnect
      </button>

    </div>

  </div>


  <!-- DASHBOARD -->

  <div class="dashboard">


    <!-- COMPOSE -->

    <div class="card">

      <div class="compose-title">

        <div class="compose-icon">
          ✈
        </div>

        <div>

          <h2>
            Compose Email
          </h2>

          <p>
            Send your message individually to each recipient
          </p>

        </div>

      </div>


      <!-- CONNECTED EMAIL -->

      <div class="email-box">

        <div class="email-circle">
          📧
        </div>

        <div>

          <div
            style="
              font-size:11px;
              color:#667085;
              margin-bottom:2px;
            "
          >
            Connected Gmail
          </div>

          <div id="email">
            Loading...
          </div>

        </div>

      </div>


      <!-- RECIPIENTS -->

      <div class="field">

        <label>
          👥 Recipients
        </label>

        <textarea
          id="recipients"
          placeholder="one@example.com
two@example.com
three@example.com"
        ></textarea>

        <div class="info">
          Enter one email per line. Each recipient receives a separate email.
        </div>

      </div>


      <!-- SENDER NAME -->

      <div class="field">

        <label>
          👤 Sender Name
        </label>

        <input
          id="senderName"
          placeholder="Your Name"
        >

      </div>


      <!-- REPLY TO -->

      <div class="field">

        <label>
          ↩️ Reply-To
        </label>

        <input
          id="replyTo"
          type="email"
          placeholder="reply@example.com"
        >

      </div>


      <!-- SUBJECT -->

      <div class="field">

        <label>
          🏷️ Subject
        </label>

        <input
          id="subject"
          placeholder="Enter your email subject..."
        >

      </div>


      <!-- MESSAGE -->

      <div class="field">

        <label>
          📝 Message
        </label>

        <textarea
          id="body"
          placeholder="Write your professional email message here..."
        ></textarea>

      </div>


      <!-- CONSENT -->

      <div class="consent">

        <label>

          <input
            type="checkbox"
            id="consent"
          >

          <span>
            I confirm that I have permission or a legitimate basis
            to contact these recipients and will honor unsubscribe
            or opt-out requests.
          </span>

        </label>

      </div>


      <!-- ACTIONS -->

      <div class="actions">

        <button
          class="send-btn"
          id="sendButton"
        >
          🚀 Send Individually
        </button>

        <button
          class="logout-btn"
          id="logoutButton"
        >
          Disconnect
        </button>

      </div>


      <!-- STATUS -->

      <div
        class="status"
        id="status"
      ></div>

    </div>


    <!-- SIDEBAR -->

    <div>


      <!-- ACCOUNT STATUS -->

      <div class="card side-card">

        <div class="side-title">
          🟢 Account Status
        </div>

        <div class="status-card">

          <div class="status-row">

            <span class="status-dot"></span>

            <span class="status-text">
              Gmail Connected
            </span>

          </div>

          <div
            id="sideEmail"
            class="info"
          >
            Loading account...
          </div>

        </div>

      </div>


      <!-- DELIVERY TIPS -->

      <div class="card side-card">

        <div class="side-title">
          💡 Better Email Delivery
        </div>

        <div class="tip">

          <span class="tip-icon">
            ✅
          </span>

          <span>
            Use a clear and relevant subject.
          </span>

        </div>

        <div class="tip">

          <span class="tip-icon">
            ✅
          </span>

          <span>
            Keep your message useful and relevant.
          </span>

        </div>

        <div class="tip">

          <span class="tip-icon">
            ✅
          </span>

          <span>
            Only contact recipients you have a legitimate basis to contact.
          </span>

        </div>

        <div class="tip">

          <span class="tip-icon">
            ✅
          </span>

          <span>
            Honor unsubscribe and opt-out requests.
          </span>

        </div>

        <div class="tip">

          <span class="tip-icon">
            ✅
          </span>

          <span>
            Avoid misleading subjects and excessive links.
          </span>

        </div>

      </div>


      <!-- SECURITY -->

      <div class="card side-card">

        <div class="side-title">
          🔒 Secure Sending
        </div>

        <div class="info">

          Your Gmail connection uses Google OAuth.
          Your Google password is never stored in Grv Mailer.

        </div>

      </div>

    </div>

  </div>


  <div class="footer">
    Grv Mailer • Gmail OAuth Email Sender
  </div>

</div>

</div>


<script>

const $ = (id) =>
  document.getElementById(id);


async function loadAccount(){

  try{

    const response =
      await fetch("/api/me");

    if(!response.ok){
      return;
    }

    const data =
      await response.json();

    if(data.connected){

      $("loginBox")
        .classList
        .add("hidden");

      $("appBox")
        .classList
        .remove("hidden");

      $("email").textContent =
        data.email || "";

      $("sideEmail").textContent =
        data.email || "";

    }

  }catch(error){

    console.error(error);

  }

}


async function logout(){

  await fetch(
    "/logout",
    {
      method:"POST"
    }
  );

  location.reload();

}


$("sendButton").onclick =
async function(){

  if(!$("consent").checked){

    $("status").textContent =
      "Please confirm the recipient consent/opt-out responsibility.";

    return;

  }


  const payload = {

    recipients:
      $("recipients").value,

    senderName:
      $("senderName").value,

    replyTo:
      $("replyTo").value,

    subject:
      $("subject").value,

    body:
      $("body").value,

    consent:
      $("consent").checked

  };


  $("sendButton").disabled = true;

  $("sendButton").textContent =
    "⏳ Sending...";

  $("status").textContent =
    "Sending emails...";


  try{

    const response =
      await fetch(
        "/api/send",
        {
          method:"POST",

          headers:{
            "content-type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );


    const data =
      await response
        .json()
        .catch(
          () => ({
            error:
              "Unexpected server response"
          })
        );


    $("status").textContent =
      JSON.stringify(
        data,
        null,
        2
      );


  }catch(error){

    $("status").textContent =
      "Request failed: " +
      error.message;

  }


  $("sendButton").disabled = false;

  $("sendButton").textContent =
    "🚀 Send Individually";

};


$("logoutButton").onclick =
  logout;


$("topLogout").onclick =
  logout;


loadAccount();

</script>

</body>
</html>`;


export default {

  async fetch(request, env){

    const url =
      new URL(request.url);


    const missing = [];


    if(!env.GOOGLE_CLIENT_ID){

      missing.push(
        "GOOGLE_CLIENT_ID"
      );

    }


    if(!env.GOOGLE_CLIENT_SECRET){

      missing.push(
        "GOOGLE_CLIENT_SECRET"
      );

    }


    if(!env.GRV_KV){

      missing.push(
        "GRV_KV"
      );

    }


    if(missing.length){

      return new Response(
        "Server OAuth configuration is incomplete. Missing: " +
        missing.join(", "),
        {
          status:500
        }
      );

    }


    /* GOOGLE LOGIN */

    if(
      url.pathname ===
      "/auth/google"
    ){

      const state =
        randomString(32);

      const verifier =
        randomString(64);

      const challenge =
        await createCodeChallenge(
          verifier
        );


      await env.GRV_KV.put(
        `oauth:${state}`,

        JSON.stringify({

          verifier,

          created_at:
            Date.now()

        }),

        {
          expirationTtl:600
        }
      );


      const redirectUri =
        new URL(
          REDIRECT_PATH,
          url.origin
        ).toString();


      const params =
        new URLSearchParams();


      params.set(
        "client_id",
        env.GOOGLE_CLIENT_ID
      );


      params.set(
        "redirect_uri",
        redirectUri
      );


      params.set(
        "response_type",
        "code"
      );


      params.set(
        "scope",
        "openid email https://www.googleapis.com/auth/gmail.send"
      );


      params.set(
        "access_type",
        "offline"
      );


      params.set(
        "prompt",
        "consent"
      );


      params.set(
        "state",
        state
      );


      params.set(
        "code_challenge",
        challenge
      );


      params.set(
        "code_challenge_method",
        "S256"
      );


      return Response.redirect(
        GOOGLE_AUTH +
        "?" +
        params.toString(),
        302
      );

    }


    /* GOOGLE CALLBACK */

    if(
      url.pathname ===
      REDIRECT_PATH
    ){

      const code =
        url.searchParams.get(
          "code"
        );


      const state =
        url.searchParams.get(
          "state"
        );


      if(!code || !state){

        return new Response(
          "Google callback is missing code or state.",
          {
            status:400
          }
        );

      }


      const oauthData =
        await env.GRV_KV.get(
          `oauth:${state}`
        );


      if(!oauthData){

        return new Response(
          "OAuth session expired. Please try again.",
          {
            status:400
          }
        );

      }


      const {
        verifier
      } = JSON.parse(
        oauthData
      );


      await env.GRV_KV.delete(
        `oauth:${state}`
      );


      const params =
        new URLSearchParams();


      params.set(
        "code",
        code
      );


      params.set(
        "client_id",
        env.GOOGLE_CLIENT_ID
      );


      params.set(
        "client_secret",
        env.GOOGLE_CLIENT_SECRET
      );


      params.set(
        "redirect_uri",
        new URL(
          REDIRECT_PATH,
          url.origin
        ).toString()
      );


      params.set(
        "grant_type",
        "authorization_code"
      );


      params.set(
        "code_verifier",
        verifier
      );


      const tokenResponse =
        await fetch(
          GOOGLE_TOKEN,
          {
            method:"POST",

            headers:{
              "content-type":
                "application/x-www-form-urlencoded"
            },

            body:params
          }
        );


      if(!tokenResponse.ok){

        return new Response(
          "Google token exchange failed: " +
          await tokenResponse.text(),
          {
            status:400
          }
        );

      }


      const token =
        await tokenResponse.json();


      /* OPENID USER INFO */

      const userInfoResponse =
        await fetch(
          GOOGLE_USERINFO,
          {
            headers:{
              Authorization:
                `Bearer ${token.access_token}`
            }
          }
        );


      if(!userInfoResponse.ok){

        return new Response(
          "Google user info request failed: " +
          await userInfoResponse.text(),
          {
            status:400
          }
        );

      }


      const userInfo =
        await userInfoResponse.json();


      if(!userInfo.email){

        return new Response(
          "Google did not return an email address.",
          {
            status:400
          }
        );

      }


      const sessionId =
        randomString(32);


      await env.GRV_KV.put(

        `session:${sessionId}`,

        JSON.stringify({

          email:
            userInfo.email,

          access_token:
            token.access_token,

          refresh_token:
            token.refresh_token ||
            null,

          expires_at:
            Date.now() +
            Number(
              token.expires_in ||
              3600
            ) *
            1000

        }),

        {
          expirationTtl:
            604800
        }

      );


      return new Response(
        null,
        {
          status:302,

          headers:{
            Location:"/",

            "Set-Cookie":
              sessionCookie(
                sessionId
              )

          }
        }
      );

    }


    /* ACCOUNT */

    if(
      url.pathname ===
      "/api/me"
    ){

      const session =
        await getSession(
          request,
          env
        );


      if(!session){

        return json({
          connected:false
        });

      }


      return json({

        connected:true,

        email:
          session.email

      });

    }


    /* LOGOUT */

    if(
      url.pathname ===
      "/logout" &&
      request.method ===
      "POST"
    ){

      const sessionId =
        getCookie(
          request,
          "grv_session"
        );


      if(sessionId){

        await env.GRV_KV.delete(
          `session:${sessionId}`
        );

      }


      return new Response(
        null,
        {
          status:204,

          headers:{
            "Set-Cookie":
              clearSessionCookie()
          }

        }
      );

    }


    /* SEND */

    if(
      url.pathname ===
      "/api/send" &&
      request.method ===
      "POST"
    ){

      const session =
        await getSession(
          request,
          env
        );


      if(!session){

        return json(
          {
            error:
              "Please connect Google first."
          },
          401
        );

      }


      let payload;


      try{

        payload =
          await request.json();

      }catch{

        return json(
          {
            error:
              "Invalid request data."
          },
          400
        );

      }


      if(!payload.consent){

        return json(
          {
            error:
              "Please confirm recipient consent/opt-out responsibility."
          },
          400
        );

      }


      const recipients =
        getRecipients(
          payload.recipients
        );


      if(!recipients.length){

        return json(
          {
            error:
              "No recipients supplied."
          },
          400
        );

      }


      if(
        recipients.some(
          (email) =>
            !validEmail(email)
        )
      ){

        return json(
          {
            error:
              "One or more email addresses are invalid."
          },
          400
        );

      }


      if(
        !payload.subject ||
        !payload.body
      ){

        return json(
          {
            error:
              "Subject and message are required."
          },
          400
        );

      }


      let currentSession;


      try{

        currentSession =
          await refreshToken(
            env,
            session
          );

      }catch(error){

        return json(
          {
            error:
              error.message
          },
          401
        );

      }


      await env.GRV_KV.put(

        `session:${session.id}`,

        JSON.stringify(
          currentSession
        ),

        {
          expirationTtl:
            604800
        }

      );


      const results = [];


      for(
        const recipient
        of recipients
      ){

        const raw =
          createRawEmail({

            to:
              recipient,

            subject:
              payload.subject,

            body:
              payload.body,

            senderName:
              payload.senderName,

            senderEmail:
              session.email,

            replyTo:
              payload.replyTo

          });


        const response =
          await fetch(
            GMAIL_SEND,
            {
              method:"POST",

              headers:{
                Authorization:
                  `Bearer ${currentSession.access_token}`,

                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({

                  raw:
                    encodeMessage(raw)

                })

            }
          );


        if(response.ok){

          results.push({

            to:
              recipient,

            status:
              "sent"

          });

        }else{

          results.push({

            to:
              recipient,

            status:
              "failed",

            detail:
              (
                await response.text()
              ).slice(
                0,
                500
              )

          });

        }


        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              350
            )
        );

      }


      return json({

        total:
          recipients.length,

        results

      });

    }


    /* HOME */

    if(
      url.pathname === "/"
    ){

      return html(
        APP_HTML
      );

    }


    return new Response(
      "Not Found",
      {
        status:404
      }
    );

  }

};
