import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

/** Vite/Vitest resolve.alias — mirrors scripts/tsconfig.json paths for the monorepo. */
export const vitestAliases: Record<string, string> = {
  '@/app': path.join(root, 'apps/app/app'),
  '@/lib': path.join(root, 'packages/shared/src/lib'),
  '@/config': path.join(root, 'packages/config/src'),
  '@/services': path.join(root, 'packages/shared/src/services'),
  '@/repositories': path.join(root, 'packages/shared/src/repositories'),
  '@/types': path.join(root, 'packages/shared/src/types'),
  '@/proxy': path.join(root, 'apps/app/proxy.ts'),
};
