# Easy YouTube setup (5 steps)

You only need to do this once. We already built the upload tool for you.
This does **not** change how customers log in.

**Before you start:** we may already have opened this page for you:  
https://console.cloud.google.com/

If you see a Google sign-in screen, sign in with the Google account that owns
your NASH AI Markets YouTube channel.  
(Do not type your password into chat — only into Google’s own page.)

---

## Step 1 — Make a new project

1. At the top of the page, click the project picker (it may say “Select a project”).
2. Click **New project**.
3. Name it exactly: `NASH AI Markets Video Automation`
4. Click **Create**.
5. Wait a few seconds, then select that project at the top.

Suggested project id (if asked): `nash-ai-markets-video`

---

## Step 2 — Turn on YouTube upload

1. In the search bar at the top, type: `YouTube Data API v3`
2. Click the result that says **YouTube Data API v3**.
3. Click the blue **Enable** button.
4. Wait until it says enabled.

---

## Step 3 — Tell Google who the app is

1. In the search bar, type: `Google Auth Platform`
2. Open **Google Auth Platform**.
3. Go to **Branding** (left menu) and fill in:

| What it asks | What to type |
|---|---|
| App name | `NASH AI Markets` |
| Home page | `https://www.nashaimarkets.com` |
| Privacy policy | `https://www.nashaimarkets.com/privacy` |
| Terms of service | `https://www.nashaimarkets.com/terms` |
| Authorized domain | `nashaimarkets.com` |
| Developer contact | `hello@nashaimarkets.com` |

4. For **support email**, pick your own business Google inbox from the dropdown.
5. Click **Save**.

Then go to **Audience**:

1. Choose **External**.
2. Leave it in **Testing**.
3. Add **yourself** as a test user (your Google account).
4. Click **Save**.

Then go to **Data Access**:

1. Click **Add or remove scopes**.
2. Find and add **only**: `https://www.googleapis.com/auth/youtube.upload`
3. Save. Do not add any other scopes.

---

## Step 4 — Create the “Uploader” key

1. In Google Auth Platform, open **Clients**.
2. Click **Create client**.
3. Application type: **Web application**.
4. Name: `NASH AI Markets Uploader`
5. Under **Authorized redirect URIs**, add these three lines one by one:

```
http://localhost:8787/api/youtube/oauth/callback
http://127.0.0.1:8787/api/youtube/oauth/callback
https://www.nashaimarkets.com/api/youtube/oauth/callback
```

6. Click **Create**.
7. Click **Download JSON** (or copy Client ID and Client secret).
8. Put those values into the private file on your computer:  
   `tools/youtube-upload/.env.local`  
   (This file stays on your machine — we never put it in Git.)

---

## Step 5 — Connect once on your computer

Open Terminal in this project and run:

```sh
cd tools/youtube-upload
cp .env.example .env.local
# Put your Client ID and Client secret into .env.local, then:
npm install
npm run auth
```

A browser window will ask you to Allow access. Click **Allow**.

To upload a private test video later:

```sh
npm run upload -- --file ./video.mp4 --title "Test" --privacy private
```

---

## Safety (please keep)

- Never paste secrets into chat or email.
- Never commit `.env.local` or anything named `client_secret…`.
- Customer login (magic link / membership) stays separate — leave it alone.
