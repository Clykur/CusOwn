# CusOwn

Command guide for local development, security checks, testing, and production-grade validation.

## Prerequisites

- Node.js `22.x` recommended (project supports `>=20 <23`)
- npm `10+`

## Setup (macOS/Linux)

```bash
# from project root
node -v
npm -v

# if you use nvm
nvm install 22
nvm use 22

npm ci
```

## Setup (Windows PowerShell)

```powershell
# from project root
node -v
npm -v

# if you use nvm-windows
nvm install 22.22.0
nvm use 22.22.0

npm ci
```

## Core Commands (all platforms)

```bash
# start development
npm run dev

# clean caches/artifacts
npm run clean
npm run clean:all

# clean + start dev
npm run dev:clean
npm run dev:fresh

# production build
npm run build
npm run build:strict
npm run build:fresh

# run production server
npm run start
```

## Quality, Security, and Tests

```bash
# lint and type safety
npm run lint
npm run lint:strict
npm run typecheck

# unit tests
npm run test:unit

# security scans
npm run security-check
npm run security:audit
npm run security:deps
npm run security:gitleaks
npm run security:gitleaks:staged
npm run security:custom:repo
npm run security:custom:staged
```

## One-Command Enterprise Guard

```bash
# runs strict lint + typecheck + secrets + security + unit tests + strict build
npm run guard:all
```

## Git Hook Commands (used by Husky)

```bash
npm run precommit:strict
npm run prepush:strict
```

## Notes

- Dev `console.log/debug/trace` is allowed only when intentionally marked for dev workflows.
- Production bundles strip `console.log/debug/trace` automatically (warn/error remain).
- Strict builds run in isolated output directory (`.next-build`) to avoid conflicts with dev artifacts.
