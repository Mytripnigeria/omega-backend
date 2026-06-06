import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

export interface RequestWithId extends Request {
  id?: string;
}

/** Correlation id for the current request (for log tracing). */
export function getRequestId(req: Request): string {
  return (req as RequestWithId).id ?? '-';
}

/**
 * Assigns a correlation id to every request — reusing an upstream
 * `x-request-id` (e.g. from a proxy/gateway) when present, otherwise generating
 * one. The id is echoed back in the `x-request-id` response header and used in
 * all server logs so a single request can be traced end-to-end.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.trim() ? incoming.trim() : randomUUID();
  (req as RequestWithId).id = id;
  res.setHeader('x-request-id', id);
  next();
}
