# Troubleshooting Guide

## Common Issues and Solutions

### ENOENT: Missing manifest files (pages-manifest.json, app-paths-manifest.json, next-font-manifest.json)

**Symptoms:**

- `ENOENT: no such file or directory, open '.../.next/server/pages-manifest.json'`
- `ENOENT: no such file or directory, open '.../.next/server/app-paths-manifest.json'`
- `ENOENT: no such file or directory, open '.../.next/server/next-font-manifest.json'`
- Requests return 500 after the first 200

**Cause:**
The dev server is reading `.next` while it is still being written (or was removed). This can happen when many concurrent requests hit the app during compilation, or when Fast Refresh triggers a full reload and file writes race with reads.

**Solution:**

1. **Stop the dev server** (Ctrl+C in the terminal where `npm run dev` is running).
2. **Clean and restart** (use one of these):

   ```bash
   # Option A: Fresh .next only (use when you already stopped the server)
   npm run dev:fresh

   # Option B: Kill any stray Next processes, clear caches, then start dev
   npm run dev:clean
   ```

3. Wait for "Ready" and the first compilation to finish before opening the app in the browser.

**Prevention:**

- Avoid refreshing or opening many tabs to the same route while the first compile is in progress.
- Use a single dev server; don’t run `npm run dev` in multiple terminals for the same project.
- After `npm run dev:fresh`, wait for the route compile, then 2–3 seconds before opening the page.

**Stable local run:** To avoid ENOENT/500 races in dev, use `npm run build && npm run start` (no Hot Reload).

### Webpack Chunk Loading Errors (404s, MIME Type Errors)

**Symptoms:**

- `GET http://localhost:3000/_next/static/chunks/XXXX.js net::ERR_ABORTED 404`
- `Refused to apply style from '...' because its MIME type ('text/html') is not a supported stylesheet MIME type`
- `Refused to execute script from '...' because its MIME type ('text/html') is not executable`

**Cause:**
Corrupted Next.js build cache or dev server out of sync with build artifacts.

**Solution:**

```bash
# Quick fix - clean and restart
npm run clean:all
npm run dev

# Or use the combined command
npm run dev:clean
```

**Prevention:**

- Always stop the dev server (Ctrl+C) before restarting
- If you see these errors, immediately run `npm run clean:all` before restarting
- Don't manually edit files in `.next/` directory

### Build Cache Issues

**If you encounter persistent build errors:**

```bash
# Full cleanup (kills processes + clears all caches)
npm run clean:all

# Then rebuild
npm run build
npm run dev
```

**Build fails with ENOENT (e.g. `route.js.nft.json` or `next-font-manifest.json`):**  
Stale or partial `.next` / webpack cache. Use a clean build:

```bash
npm run build:fresh
```

Then `npm run start`. For a one-off production run: `npm run build:fresh && npm run start`.

### Available Cleanup Commands

- `npm run clean` - Clears build caches only
- `npm run clean:all` - Kills processes + clears all caches
- `npm run dev:clean` - Full cleanup + starts dev server
- `npm run dev:fresh` - Removes `.next` and starts dev (run only after stopping the current dev server)
- `npm run build:fresh` - Removes `.next` and `node_modules/.cache` then runs production build (use when build fails with ENOENT)

### When to Clean Caches

Clean caches when you experience:

- Webpack chunk loading errors
- MIME type errors for static assets
- "Module not found" errors for files that exist
- Build errors that don't make sense
- After major dependency updates
- After changing Next.js configuration

### Many GET requests to /admin/dashboard (or /owner/dashboard, /customer/dashboard) in dev

**Symptoms:**

- Terminal shows many repeated `GET /admin/dashboard 200` (or similar) when staying on one dashboard.
- Fewer or no repeated requests in production (`next build && next start`).

**Cause:**
Root layout is dynamic (session/cookies), so the app is dynamic. In development, the client can refetch RSC payloads more often; shared layout + pathname-dependent UI can contribute to this.

**What we do:**

- Session is provided once via root layout script; no client `/api/auth/session` when session exists.
- `experimental.staleTimes` in `next.config.js` caches dynamic segments in the client router (e.g. 30s) to reduce refetches.
- Production should be measured with `next build && next start`; expect 1–3 GETs per dashboard load there.

### Best Practices

1. **Always stop dev server properly**: Use Ctrl+C, don't force kill unless necessary
2. **Clean before major changes**: Run `npm run clean` before updating dependencies
3. **Monitor terminal output**: Watch for webpack warnings that might indicate cache issues
4. **Use dev:clean for fresh starts**: When in doubt, use `npm run dev:clean` instead of `npm run dev`
