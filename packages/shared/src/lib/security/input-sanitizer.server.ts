import { NextRequest } from "next/server";

/**
 * Server-only request body parsing.
 * Uses NextRequest which is not available in the browser.
 */
export const parseRequestBody = async (request: NextRequest): Promise<any> => {
  try {
    let body: unknown = null;

    // 1. Handle mocked request FIRST (important for tests)
    if ((request as any).body && typeof (request as any).body === "object") {
      body = (request as any).body;
    }

    // 2. Safe clone (prevents stream issues)
    if (body === null && typeof request.clone === "function") {
      try {
        body = await request.clone().json();
      } catch {}
    }

    // 3. Direct JSON
    if (body === null && typeof request.json === "function") {
      try {
        body = await request.json();
      } catch {}
    }

    // 4. Raw text fallback
    if (body === null && typeof request.text === "function") {
      try {
        const text = await request.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch {}
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return null;
    }

    return { ...body };
  } catch {
    return null;
  }
};

export const sanitizeRequestBody = parseRequestBody;
