# XANVOR — Pinterest auto-posting setup (owner runbook)

The site can post product pins to Pinterest automatically — 3 fresh pins daily from the
newest designs in the catalogue. But first some one-time setup is needed, and a few steps
**you must do personally** (Pinterest account banane wala kaam). Follow in order.

---

## Step A — Create a Pinterest BUSINESS account (you do this, personally)

Normal personal account se API nahi chalega — **business account chahiye**.

1. Open **https://www.pinterest.com/business/create/** in your browser.
2. Sign up with the XANVOR/Zenko email (or log in and click **Convert to business**).
3. Fill the profile: Business name **XANVOR**, website **https://xanvor.com**,
   country India, language English.
4. Verify the email Pinterest sends you.
5. Profile settings me website claim kar lena (Settings → Claimed accounts →
   Claim website → follow the HTML-tag or DNS instructions). Claimed website =
   better ranking + your logo on every pin from xanvor.com.

## Step B — Create 5–8 keyword-named boards (manual, one time)

Board names are an SEO surface on Pinterest — keyword-wale names use karo, cute names nahi.
Suggested boards:

- **Brass Home Decor**
- **Indian Handicrafts**
- **Kansa & Copper Kitchen**
- **Metal Wall Art**
- **Festive Table Decor**
- **Serving Trays & Bowls**

Create each: profile → **+** → Board → name → keep it **Public**. Add a short keyword
description and pin 2–3 nice product images manually so the board doesn't look empty.

**Getting the board_id** (the pipeline needs ONE board id to post to):

- Easiest: after Step C/D gives you a token, run

  ```bash
  curl -s -H "Authorization: Bearer YOUR_TOKEN" https://api.pinterest.com/v5/boards
  ```

  (sandbox testing me `api-sandbox.pinterest.com` use karna). The JSON lists every board
  with its numeric `id` — copy the id of the board you want (e.g. Brass Home Decor).
- The board URL in the browser shows the board *name*, not the numeric id — the API call
  above is the reliable way.

## Step C — Developer app + access tiers (important — read the warning)

1. Go to **https://developers.pinterest.com/** → log in with the SAME business account.
2. **Connect app** → fill the request form (app name XANVOR, purpose: posting our own
   product pins). This gives **Trial access** — requests are reviewed each business day,
   answer email pe aata hai.
3. Your **App ID** and **App secret** appear on the **My apps** page
   (https://developers.pinterest.com/apps/). Inhe sambhal ke rakho — Netlify env vars
   me jayenge (Step E).

> **WARNING — Trial access pins are INVISIBLE to the public.**
> **Under Trial access, every pin the API creates is visible ONLY to your own account.
> Duniya ko kuch nahi dikhega. Real public pinning needs STANDARD access — apply
> EARLY.** The Standard upgrade (My apps → Upgrade) requires a **screen-recording
> video** of your app doing the OAuth flow + creating a pin, and reviews in 2026 were
> taking **2–4+ weeks**. So: submit the Standard request as soon as Trial is approved
> and the pipeline works — don't wait.

## Step D — Sandbox testing (optional but recommended first)

Pinterest has a full test environment at **https://api-sandbox.pinterest.com/v5/** —
pins yahan sirf test hote hain, kisi ko dikhte nahi, kuch bhi break nahi hota.

1. My apps → **Manage** → Configure → **Generate Access Token** → environment
   **Sandbox**. Token 30 din valid hai, no OAuth needed.
2. In Netlify env vars (Step E) set:
   - `PINTEREST_API_BASE` = `https://api-sandbox.pinterest.com/v5`
   - `PINTEREST_ACCESS_TOKEN` = the sandbox token
   - `PINTEREST_BOARD_ID` = a board id from the **sandbox** (create one with the API —
     sandbox boards are separate from real boards)
3. Test with the curl in Step F. When done, REMOVE `PINTEREST_API_BASE` and
   `PINTEREST_ACCESS_TOKEN` and switch to the production OAuth vars (Step E).

## Step E — Production OAuth (one-time token dance)

**1. Authorize URL** — open this in the browser while logged in as the XANVOR business
account (replace `YOUR_APP_ID` and use the redirect URI you registered on the app):

```
https://www.pinterest.com/oauth/?client_id=YOUR_APP_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=pins:read,pins:write,boards:read,boards:write&state=xanvor123
```

Approve it → browser redirects to `YOUR_REDIRECT_URI?code=XXXX` — copy the `code`.

**2. Exchange code → tokens** (do this within a few minutes, code expires):

```bash
curl -s -X POST https://api.pinterest.com/v5/oauth/token \
  -H "Authorization: Basic $(printf 'YOUR_APP_ID:YOUR_APP_SECRET' | base64)" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=PASTE_CODE_HERE&redirect_uri=YOUR_REDIRECT_URI&continuous_refresh=true"
```

The JSON reply has `access_token` and — the one we need — **`refresh_token`**.
(`continuous_refresh=true` is important: it gives the modern 60-day rotating refresh
token that the pipeline keeps renewing forever automatically.)

**3. Netlify environment variables** — Netlify dashboard → your site →
**Site configuration → Environment variables** → add:

| Variable | Value |
|---|---|
| `PINTEREST_APP_ID` | App ID from My apps |
| `PINTEREST_APP_SECRET` | App secret from My apps |
| `PINTEREST_REFRESH_TOKEN` | the `refresh_token` from step 2 (used ONCE to bootstrap; after that the pipeline stores rotating tokens itself) |
| `PINTEREST_BOARD_ID` | numeric id of the board to post to (Step B) |
| `PINTEREST_PINS_PER_DAY` | optional, 1–10, default 3 |

> **NOTE:** Netlify functions only see new env vars after a **fresh deploy** — after
> adding/changing vars, dashboard → Deploys → **Trigger deploy**. Bina redeploy ke
> kuch nahi chalega.

## Step F — How the pipeline works

- **Automatic:** a scheduled function (`pinterest-cron.mjs`) runs **daily** and posts the
  3 newest catalogue designs that haven't been pinned yet (live products with an image;
  drafts skip ho jate hain). Each pin links to its own product page with UTM tracking.
  Already-pinned products are remembered (Netlify Blobs) so nothing posts twice.
- **Manual — status check:**

  ```bash
  curl -s -H "x-admin-key: YOUR_ADMIN_KEY" https://xanvor.com/api/pinterest/post
  ```

  Shows configured/mode, how many products are pinned, the last 10 posted, and how many
  are still waiting in the queue.
- **Manual — post now:**

  ```bash
  curl -s -X POST -H "x-admin-key: YOUR_ADMIN_KEY" \
    -H "Content-Type: application/json" -d '{"count":3}' \
    https://xanvor.com/api/pinterest/post
  ```

  `count` = 1–10. Same admin key as `/admin.html` (`XANVOR_ADMIN_KEY`). An admin-panel
  button can call this too.

## Step G — Cadence & Pinterest SEO tips

- **3–5 fresh pins per day MAX on a new account** — consistency beats bursts. Zyada
  spam karne se new accounts flag ho jate hain. (Default 3/day is already set.)
- **Images 2:3 vertical** (1000×1500 px) perform best — Pinterest crops everything else.
  Product photos jitni lifestyle/styled setting me honi, utna better.
- **Titles: keyword FIRST.** Sirf pehle ~40 characters feed me dikhte hain — the pipeline
  already front-loads the product name + material keyword.
- **Descriptions: no hashtags** (2026 me unka ranking weight zero hai) — natural
  sentences with material/style keywords, which the pipeline writes automatically.
- Pin link ALWAYS goes to the matching product page (never the homepage) — pipeline
  does this. Product page ka image pin ke image se match karna chahiye.
- Trial access me results dikhne ka wait mat karo — **pins are private until Standard
  access is approved** (Step C warning). Serious daily posting Standard approval ke
  BAAD shuru karo; sandbox/Trial phase sirf testing ke liye hai.
