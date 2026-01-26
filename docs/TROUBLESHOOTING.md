# Troubleshooting Guide

## Common Issues and Solutions

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

### Available Cleanup Commands

- `npm run clean` - Clears build caches only
- `npm run clean:all` - Kills processes + clears all caches
- `npm run dev:clean` - Full cleanup + starts dev server

### When to Clean Caches

Clean caches when you experience:
- Webpack chunk loading errors
- MIME type errors for static assets
- "Module not found" errors for files that exist
- Build errors that don't make sense
- After major dependency updates
- After changing Next.js configuration

### Best Practices

1. **Always stop dev server properly**: Use Ctrl+C, don't force kill unless necessary
2. **Clean before major changes**: Run `npm run clean` before updating dependencies
3. **Monitor terminal output**: Watch for webpack warnings that might indicate cache issues
4. **Use dev:clean for fresh starts**: When in doubt, use `npm run dev:clean` instead of `npm run dev`
