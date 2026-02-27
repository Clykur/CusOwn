'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

/** Swagger UI CSS – bundled from package (same-origin, CSP-safe). */
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[50vh] items-center justify-center text-neutral-500">
      Loading API docs…
    </div>
  ),
});

/**
 * API docs (Swagger UI). Share /docs with coworkers to view the OpenAPI spec.
 * Uses bundled swagger-ui-react (no external scripts) so CSP is satisfied.
 */
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="p-4 text-sm text-neutral-600">
        <Link href="/" className="hover:underline">
          ← Back to app
        </Link>
        {' · '}
        Share this link with coworkers: <strong>/docs</strong>
      </div>
      <SwaggerUI url="/api/openapi" />
    </div>
  );
}
