import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Serves the OpenAPI spec for Swagger UI at /docs.
 * Spec source: docs/openapi.yaml
 */
export async function GET() {
  const specPath = join(process.cwd(), 'docs', 'openapi.yaml');
  const body = readFileSync(specPath, 'utf8');
  return new Response(body, {
    headers: {
      'Content-Type': 'application/yaml',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
