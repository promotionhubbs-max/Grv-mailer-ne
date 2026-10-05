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
  for (const byte of bytes) binary += String.fromCharCode(byte);

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

  if (!sessionId) return null;

  const data = await env.GRV_KV.get(
    `session:${sessionId}`
  );

  if (!data) return null;

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

  params.set("client_id", env.GOOGLE_CLIENT_ID);
  params.set("client_secret", env.GOOGLE_CLIENT_SECRET);
  params.set("refresh_token", session.refresh_token);
  params.set("grant_type", "refresh_token");

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

body{
  margin:0;
  font-family:Arial,system-ui,sans-serif;
  background:#f5f7fb;
  color:#172033;
}

.container{
  max-width:760px;
  margin:30px auto;
  padding:20px;
}

.card{
  background:white;
  border-radius:18px;
  padding:24px;
  box-shadow:0 8px 30px rgba(0,0,0,.08);
}

h1{
  margin:0 0 6px;
}

.subtitle{
  color:#667085;
  margin-bottom:25px;
}

.field{
  margin-bottom:16px;
}

label{
  display:block;
  font-weight:600;
  margin-bottom:7px;
}

input,
textarea{
  width:100%;
  padding:12px;
  border:1px solid #d0d5dd;
  border-radius:10px;
  font-size:15px;
}

textarea{
  min-height:150px;
  resize:vertical;
}

button,
.google{
  display:inline-block;
  border:none;
  border-radius:10px;
  padding:12px 18px;
  font-weight:700;
  cursor:pointer;
  text-decoration:none;
}

.google{
  background:white;
  color:#111827;
  border:1px solid #d0d5dd;
}

.primary{
  background:#111827;
  color:white;
}

.secondary{
  background:#e5e7eb;
  color:#111827;
  margin-left:8px;
}

.hidden{
  display:none;
}

.status{
  margin-top:18px;
  white-space:pre-wrap;
  word-break:break-word;
}

.note{
  font-size:13px;
  color:#667085;
  line-height:1.5;
}

</style>
</head>

<body>

<div class="container">

<div class="card">

<h1>Grv Mailer</h1>

<div class="subtitle">
Gmail OAuth Email Sender
</div>

<div id="loginBox">

<p>
Connect your Gmail account to send emails.
</p>

<a
class="google"
href="/auth/google"
>
Continue with Google
</a>

</div>

<div id="appBox" class="hidden">

<div class="field">

<label>
Connected Gmail
</label>

<input
id="email"
readonly
>

</div>

<div class="field">

<label>
Recipients
</label>

<textarea
id="recipients"
placeholder="one@example.com
two@example.com"
></textarea>

</div>

<div class="field">

<label>
Sender Name
</label>

<input
id="senderName"
placeholder="Your Name"
>

</div>

<div class="field">

<label>
Reply-To
</label>

<input
id="replyTo"
type="email"
placeholder="reply@example.com"
>

</div>

<div class="field">

<label>
Subject
</label>

<input
id="subject"
placeholder="Your subject"
>

</div>

<div class="field">

<label>
Message
</label>

<textarea
id="body"
placeholder="Write your message..."
></textarea>

</div>

<div class="note">

<label>
<input
type="checkbox"
id="consent"
>
I confirm that I have permission or a legitimate basis to contact these recipients and will honor unsubscribe/opt-out requests.
</label>

</div>

<br>

<button
class="primary"
id="sendButton"
>
Send Individually
</button>

<button
class="secondary"
id="logoutButton"
>
Disconnect
</button>

<div
class="status"
id="status"
></div>

</div>

</div>

</div>

<script>

const $ = (id) =>
  document.getElementById(id);

async function loadAccount(){

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

    $("email").value =
      data.email || "";

  }

}

$("sendButton").onclick =
  async function(){

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

    $("status").textContent =
      "Sending...";

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

  };

$("logoutButton").onclick =
  async function(){

    await fetch(
      "/logout",
      {
        method:"POST"
      }
    );

    location.reload();

  };

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