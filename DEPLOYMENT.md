# GRIND VPS Deployment

This app is a static PWA. There is no build step and no Node server.

## What the current app expects

- Deploy at the domain root, for example `https://grind.example.com/`
- Serve over HTTPS
- Keep these files together in the same directory:
  - `index.html`
  - `config.js`
  - `app.js`
  - `sw.js`
  - `manifest.json`
  - `icons/`

Important: the app currently uses root-relative URLs such as `/sw.js`, `/manifest.json`, and `/icons/...`.
For a first production version, do not deploy it under a subpath like `/grind/`.

## Runtime config

Production config now lives in `config.js`:

```js
window.GRIND_CONFIG = {
  webhookUrl: "https://your-n8n-host.example.com/webhook/grind",
  dryRun: false,
};
```

If you do not want sync yet, leave:

```js
window.GRIND_CONFIG = {
  webhookUrl: "YOUR_N8N_WEBHOOK_URL",
  dryRun: true,
};
```

## Recommended VPS setup

- OS: Ubuntu 22.04 or 24.04
- Web server: Nginx
- TLS: Let's Encrypt
- Deploy path: `/var/www/grind/current`

An example Nginx config is in [deploy/nginx.grind.conf.example](/Users/tomerliran/Development/Playground/grind/deploy/nginx.grind.conf.example).

## Deploy files to the VPS

From your local machine:

```bash
rsync -av --delete \
  /Users/tomerliran/Development/Playground/grind/ \
  user@your-vps:/var/www/grind/current/ \
  --exclude ".git" \
  --exclude ".DS_Store"
```

## Nginx install and site enable

On the VPS:

```bash
sudo mkdir -p /var/www/grind/current
sudo mkdir -p /var/www/certbot
sudo cp /var/www/grind/current/deploy/nginx.grind.conf.example /etc/nginx/sites-available/grind.conf
```

Copy the example config into place and replace:

- `grind.example.com`
- certificate paths
- root path if needed

Then:

```bash
sudo ln -s /etc/nginx/sites-available/grind.conf /etc/nginx/sites-enabled/grind.conf
sudo nginx -t
sudo systemctl reload nginx
```

## TLS

If you use Certbot with Nginx:

```bash
sudo certbot --nginx -d grind.example.com
```

If you already manage certificates another way, just update the SSL paths in the Nginx config.

## Production checklist

- `config.js` has the correct `webhookUrl`
- `config.js` has `dryRun: false` if sync should be live
- the n8n endpoint accepts browser requests from your app origin
- the site opens at `https://your-domain/`
- the manifest loads
- the service worker registers
- install prompt / Add to Home Screen works

## Things to verify after first deploy

1. Open the site in a fresh browser session.
2. Confirm the app loads without 404s for:
   - `/config.js`
   - `/app.js`
   - `/sw.js`
   - `/manifest.json`
   - `/icons/icon-192.png`
3. In DevTools, confirm the service worker is active.
4. Complete one workout.
5. If sync is enabled, confirm the webhook request succeeds.
6. Reload and confirm history, weekly completion, and session resume still work.

## Known deployment constraints

- This version is root-path only.
- Service worker updates depend on `sw.js` changing; bump the cache name in `sw.js` when you want to invalidate old cached assets aggressively.
- Google Fonts are loaded from Google at runtime, so the VPS must allow outbound browser access to those font hosts.
