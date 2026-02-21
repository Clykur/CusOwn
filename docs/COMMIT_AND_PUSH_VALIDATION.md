# Commit and Push Validation

All lint, type-check, security, and build checks must pass locally before code can be committed or pushed. Git hooks enforce this.

---

## Setup (one-time)

Husky and lint-staged are devDependencies. After clone or when adding the project:

```bash
npm install
```

Husky is installed via the `prepare` script. Hooks live in `.husky/` and run automatically.

To reinstall or ensure hooks are executable:

```bash
npx husky install
chmod +x .husky/pre-commit .husky/pre-push
```

---

## Pre-commit (runs on `git commit`)

1. **lint-staged** (staged files only):
   - Prettier: format `*.{js,jsx,ts,tsx,json,css,md}`
   - ESLint: `eslint --fix` on `*.{js,jsx,ts,tsx}`
2. **TypeScript**: `npm run type-check` (tsc --noEmit) on the whole project.

If any step fails, the commit is **blocked**.

---

## Pre-push (runs on `git push`)

1. **Lint**: `npm run lint`
2. **Type check**: `npm run type-check`
3. **Security check**: `npm run security-check` (lockfile + dangerous-pattern scan)
4. **Security audit**: `npm run security` (npm audit --omit=dev)
5. **Build**: `npm run build`

If any step fails, the push is **blocked**.

---

## package.json scripts

| Script           | Command / purpose                                                          |
| ---------------- | -------------------------------------------------------------------------- |
| `lint`           | next lint                                                                  |
| `typecheck`      | tsc --noEmit                                                               |
| `type-check`     | same as typecheck                                                          |
| `security`       | npm audit --omit=dev                                                       |
| `security-check` | Lockfile + dangerous-pattern scan (see scripts/security-check-pre-push.js) |
| `validate`       | lint && type-check && build                                                |
| `format:check`   | Prettier --check (optional, not in hooks)                                  |

---

## Engines

`package.json` specifies `"engines": { "node": ">=20" }`. Use Node 20+ for consistent behavior with CI.

---

## Bypassing hooks (emergency only)

Avoid bypassing; fix the failure instead. If you must:

- Skip pre-commit: `git commit --no-verify`
- Skip pre-push: `git push --no-verify`

Use only for rare cases (e.g. WIP push to a backup branch). Never use for main/develop or PR branches.
