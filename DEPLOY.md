# Deploying the WAAPC Recruitment Portal

This gets you a live URL for the ~15 candidates, using free/cheap tiers:
**Supabase** (database) + **Render** (runs the Node server) + **GitHub** (source/deploy
trigger) + optionally **Cloudflare** (custom domain/HTTPS).

You'll need to create three accounts yourself (I can't create accounts or enter passwords on
your behalf) — each is free to start. Total time: ~20 minutes.

## 1. Create the database (Supabase)

1. Go to supabase.com and sign up / sign in.
2. **New project** — pick any name/region, set a database password (save it somewhere safe).
3. Once it's provisioned: **Project Settings → Database → Connection string → URI**.
4. Use the **Transaction pooler** version (port `6543`, not `5432`) — this works better with
   hosts like Render that open lots of short-lived connections. Copy that URI; it looks like:
   ```
   postgresql://postgres.xxxxxxxxxx:[YOUR-PASSWORD]@aws-0-xxxxx.pooler.supabase.com:6543/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the database password from step 2. Keep this string — it's
   your `DATABASE_URL`.

The app creates its own tables automatically on first boot — nothing to run manually in
Supabase's SQL editor.

## 2. Push the code to GitHub

You said you don't have GitHub yet:

1. Create a free account at github.com.
2. Create a new **empty** repository (no README/license — this project already has one),
   e.g. `waapc-recruitment-portal`. Keep it **private** — it will contain your HR admin setup
   and candidate flow logic.
3. Back in this project folder, connect and push:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/waapc-recruitment-portal.git
   git branch -M main
   git push -u origin main
   ```
   (GitHub will prompt you to sign in the first time you push — follow its prompts.)

## 3. Deploy the server (Render)

1. Go to render.com and sign up (you can sign up directly with your GitHub account, which also
   connects the two automatically).
2. **New → Web Service**, pick the `waapc-recruitment-portal` repo.
3. Settings:
   - **Runtime**: Node
   - **Build command**: `npm install`
   - **Start command**: `npm start`
   - **Instance type**: Free is fine for 15 candidates.
4. Under **Environment**, add these variables:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Supabase URI from step 1 |
   | `SESSION_SECRET` | any long random string (e.g. generate one at random.org) |
   | `ADMIN_USERNAME` | whatever you want your HR login username to be |
   | `ADMIN_PASSWORD` | a real password — this protects the roster/candidate responses |
   | `BASE_URL` | fill in *after* step 5 gives you the live URL, then redeploy |
5. Click **Create Web Service**. Render will build and start it — first request on the free
   tier can take ~30s to wake up if it's been idle, which is fine for this use case.
6. You'll get a URL like `https://waapc-recruitment-portal.onrender.com`. Set `BASE_URL` to
   that (step 4) and save — this makes the HR-generated candidate links point to the right
   place.

That's it — candidates and HR both use that Render URL. Test it exactly like we tested it
locally: open the URL, submit a test application, then sign in to the HR roster view from the
same URL and confirm it shows up.

## 4. Optional: custom domain via Cloudflare

Only needed if you want e.g. `apply.waapcschool.com` instead of the `onrender.com` address.

1. Add your domain to a free Cloudflare account (if it isn't already there).
2. In Render, under the service's **Settings → Custom Domain**, add your desired subdomain —
   Render will give you a CNAME target.
3. In Cloudflare DNS, add a CNAME record pointing your subdomain at that target, with the
   orange "Proxied" cloud enabled (this is what gives you Cloudflare's free SSL/CDN in front
   of Render).
4. Update `BASE_URL` in Render's environment to the new domain and redeploy.

## After the hiring round is done

Nothing needs to be "torn down" — Render's free tier and Supabase's free tier cost nothing
sitting idle. If you want to fully retire it: delete the Render service and the Supabase
project. Export any candidate data you want to keep first (roster CSV + per-candidate exports
from the HR view) — deleting the Supabase project deletes the data permanently.
