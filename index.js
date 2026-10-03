const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GMAIL_SEND = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const GMAIL_PROFILE = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const REDIRECT_PATH = "/oauth/google/callback";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

function b64url(input) {
  const bytes = typeof input === "string"
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomString(length = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return b64url(bytes);
}

async function sha256Base64Url(text) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  return b64url(digest);
}

function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function sessionCookie(sessionId) {
  return `grv_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

function clearSessionCookie() {
  return "grv_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

function splitEmails(value) {
  return [...new Set(
    String(value || "")
      .split(/[\n,;]+/)
      .map(x => x.trim())
      .filter(Boolean)
  )];
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function base64UrlFromUtf8(text) {
  return btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeRawMessage({ to, subject, body, fromName, fromEmail, replyTo }) {
  const headers = [
    `From: ${fromName ? `"${String(fromName).replaceAll('"', "")}" ` : ""}<${fromEmail}>`,
    `To: <${to}>`,
    `Subject: ${subject.replace(/[\r\n]/g, " ")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit"
  ];
  if (replyTo && validEmail(replyTo)) headers.push(`Reply-To: ${replyTo}`);
  return headers.join("\r\n") + "\r\n\r\n" + body;
}

async function refreshAccessToken(env, token) {
  if (!token.refresh_token) return token;
  if (token.expires_at && Date.now() < token.expires_at - 60000) return token;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token
  });

  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  return {
    ...token,
    access_token: data.access_token,
    expires_at: Date.now() + Number(data.expires_in || 3600) * 1000
  };
}

async function getSession(env, request) {
  const sid = cookieValue(request, "grv_session");
  if (!sid) return null;
  const raw = await env.GRV_KV.get(`session:${sid}`);
  if (!raw) return null;
  return { sid, ...JSON.parse(raw) };
}

const APP_HTML = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Grv Mailer</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#f5f7fb;margin:0;color:#172033}
main{max-width:760px;margin:30px auto;padding:18px}
.card{background:#fff;border:1px solid #e3e7ef;border-radius:18px;padding:22px;box-shadow:0 8px 30px rgba(0,0,0,.06)}
h1{margin:0 0 6px}.muted{color:#687386}.row{display:grid;gap:8px;margin:14px 0}
input,textarea{width:100%;box-sizing:border-box;padding:12px;border:1px solid #ccd3df;border-radius:10px;font:inherit}
textarea{min-height:170px;resize:vertical}
button,.google{display:inline-block;border:0;border-radius:10px;padding:12px 16px;font-weight:700;cursor:pointer;text-decoration:none}
button{background:#111827;color:white}.google{background:#fff;color:#111827;border:1px solid #ccd3df}
#status{margin-top:14px;white-space:pre-wrap}.hidden{display:none}
.small{font-size:13px;color:#687386}
</style>
</head>
<body>
<main><div class="card">
<h1>Grv Mailer</h1>
<p class="muted">Gmail OAuth email sending</p>
<div id="login">
<p>Connect the Gmail account you want to send from.</p>
<a class="google" href="/auth/google">Continue with Google</a>
</div>
<div id="app" class="hidden">
<div class="row"><label>Connected Gmail</label><input id="me" readonly></div>
<div class="row"><label>Recipients (one per line or comma separated)</label><textarea id="recipients" placeholder="person@example.com"></textarea></div>
<div class="row"><label>Sender name</label><input id="fromName" placeholder="Your Name"></div>
<div class="row"><label>Reply-To (optional)</label><input id="replyTo" type="email" placeholder="reply@example.com"></div>
<div class="row"><label>Subject</label><input id="subject" placeholder="Your subject"></div>
<div class="row"><label>Message</label><textarea id="body" placeholder="Write your message..."></textarea></div>
<label class="small"><input id="consent" type="checkbox"> I confirm these recipients are appropriate to contact and I will honor opt-outs/unsubscribes.</label>
<br><br>
<button id="send">Send individually</button>
<button id="logout" type="button">Disconnect</button>
<div id="status"></div>
</div>
</div></main>
<script>
const $ = id => document.getElementById(id);
async function load(){
  const r = await fetch('/api/me');
  if(!r.ok) return;
  const d = await r.json();
  if(d.connected){
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('me').value = d.email || '';
  }
}
$('send').onclick = async () => {
  const recipients = $('recipients').value;
  const payload = {
    recipients,
    fromName: $('fromName').value,
    replyTo: $('replyTo').value,
    subject: $('subject').value,
    body: $('body').value,
    consent: $('consent').checked
  };
  $('status').textContent = 'Sending...';
  const r = await fetch('/api/send', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const d = await r.json().catch(()=>({error:'Unexpected server response'}));
  $('status').textContent = JSON.stringify(d,null,2);
};
$('logout').onclick = async () => { await fetch('/logout',{method:'POST'}); location.reload(); };
load();
</script>
</body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GRV_KV) {
      return new Response("Server OAuth configuration is incomplete.", { status: 500 });
    }

    if (url.pathname === "/auth/google") {
      const state = randomString(32);
      const verifier = randomString(64);
      const challenge = await sha256Base64Url(verifier);

      await env.GRV_KV.put(
        `oauth:${state}`,
        JSON.stringify({ verifier, created_at: Date.now() }),
        { expirationTtl: 600 }
      );

      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: new URL(REDIRECT_PATH, url.origin).toString(),
        response_type: "code",
        scope: "openid email https://www.googleapis.com/auth/gmail.send",
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256"
      });

      return Response.redirect(`${GOOGLE_AUTH}?${params}`, 302);
    }

    if (url.pathname === REDIRECT_PATH) {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state) return new Response("Google OAuth callback is missing code/state.", { status: 400 });

      const rawState = await env.GRV_KV.get(`oauth:${state}`);
      if (!rawState) return new Response("OAuth session expired. Please try again.", { status: 400 });

      const { verifier } = JSON.parse(rawState);
      await env.GRV_KV.delete(`oauth:${state}`);

      const params = new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: new URL(REDIRECT_PATH, url.origin).toString(),
        grant_type: "authorization_code",
        code_verifier: verifier
      });

      const tokenResponse = await fetch(GOOGLE_TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: params
      });

      if (!tokenResponse.ok) {
        return new Response(`Google token exchange failed: ${await tokenResponse.text()}`, { status: 400 });
      }

      const token = await tokenResponse.json();

      const profileResponse = await fetch(GMAIL_PROFILE, {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });

      if (!profileResponse.ok) {
        return new Response(`Gmail profile request failed: ${await profileResponse.text()}`, { status: 400 });
      }

      const profile = await profileResponse.json();
      const sid = randomString(32);

      await env.GRV_KV.put(
        `session:${sid}`,
        JSON.stringify({
          access_token: token.access_token,
          refresh_token: token.refresh_token || null,
          expires_at: Date.now() + Number(token.expires_in || 3600) * 1000,
          email: profile.emailAddress
        }),
        { expirationTtl: 604800 }
      );

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": sessionCookie(sid)
        }
      });
    }

    if (url.pathname === "/api/me") {
      const session = await getSession(env, request);
      if (!session) return json({ connected: false });
      return json({ connected: true, email: session.email });
    }

    if (url.pathname === "/logout" && request.method === "POST") {
      const sid = cookieValue(request, "grv_session");
      if (sid) await env.GRV_KV.delete(`session:${sid}`);
      return new Response(null, {
        status: 204,
        headers: { "Set-Cookie": clearSessionCookie() }
      });
    }

    if (url.pathname === "/api/send" && request.method === "POST") {
      const session = await getSession(env, request);
      if (!session) return json({ error: "Not connected to Google." }, 401);

      let payload;
      try { payload = await request.json(); }
      catch { return json({ error: "Invalid JSON." }, 400); }

      if (!payload.consent) return json({ error: "Please confirm recipient consent/opt-out responsibility." }, 400);

      const recipients = splitEmails(payload.recipients);
      if (!recipients.length) return json({ error: "No recipients supplied." }, 400);
      if (recipients.some(x => !validEmail(x))) return json({ error: "One or more recipient emails are invalid." }, 400);
      if (!payload.subject || !payload.body) return json({ error: "Subject and message are required." }, 400);

      let token;
      try {
        token = await refreshAccessToken(env, session);
      } catch (e) {
        return json({ error: e.message }, 401);
      }

      await env.GRV_KV.put(
        `session:${session.sid}`,
        JSON.stringify({ ...session, ...token }),
        { expirationTtl: 604800 }
      );

      const results = [];
      for (const to of recipients) {
        const raw = makeRawMessage({
          to,
          subject: String(payload.subject),
          body: String(payload.body),
          fromName: String(payload.fromName || ""),
          fromEmail: session.email,
          replyTo: String(payload.replyTo || "")
        });

        const response = await fetch(GMAIL_SEND, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ raw: base64UrlFromUtf8(raw) })
        });

        if (response.ok) {
          results.push({ to, status: "sent" });
        } else {
          results.push({ to, status: "failed", detail: (await response.text()).slice(0, 300) });
        }

        // Small delay between individual messages.
        await new Promise(r => setTimeout(r, 350));
      }

      return json({ total: recipients.length, results });
    }

    if (url.pathname === "/") return html(APP_HTML);

    return new Response("Not Found", { status: 404 });
  }
};
