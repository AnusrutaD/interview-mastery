/**
 * Route handler plumbing: authentication, validation, error translation and
 * CORS in one place.
 *
 * Previously each of the six API routes repeated its own
 * `const session = await auth(); if (!session?.user?.id) return 401` block,
 * in two mutually inconsistent styles. Any fix had to be applied six times.
 */
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { resolveUserId } from "../auth/session";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
} as const;

/** Domain error carrying an HTTP status. Thrown by services, caught here. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, message);
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { ...CORS_HEADERS, ...init?.headers } });
}

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details !== undefined ? { details } : {}) },
    { status, headers: CORS_HEADERS }
  );
}

/** Standard CORS preflight response — the extension needs this. */
export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export interface RouteContext<TParams = Record<string, string>> {
  userId: string;
  request: Request;
  params: TParams;
}

type Handler<TParams, TResult> = (ctx: RouteContext<TParams>) => Promise<TResult>;

/** Next.js 15+ passes route params as a promise. */
type NextRouteArgs<TParams> = { params: Promise<TParams> };

function translateError(err: unknown) {
  if (err instanceof ApiError) return jsonError(err.status, err.message, err.details);
  if (err instanceof ZodError) {
    return jsonError(400, "Invalid request body", err.issues);
  }
  console.error("[api] unhandled error:", err);
  return jsonError(500, "Internal server error");
}

/**
 * Wrap a handler so it only runs for an authenticated caller. Accepts either an
 * NextAuth session cookie or the `x-api-key` header used by the extension.
 */
export function withAuth<TParams = Record<string, string>, TResult = unknown>(
  handler: Handler<TParams, TResult>
) {
  return async (request: Request, args?: NextRouteArgs<TParams>) => {
    try {
      const userId = await resolveUserId(request);
      if (!userId) return jsonError(401, "Unauthorized");
      const params = ((await args?.params) ?? {}) as TParams;
      return jsonOk(await handler({ userId, request, params }));
    } catch (err) {
      return translateError(err);
    }
  };
}

/** Parse and validate a JSON body, throwing ZodError on mismatch. */
export async function parseBody<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
  return schema.parse(raw);
}
