import { randomUUID } from 'node:crypto';

export interface CorrelatedRequest {
  correlationId?: string;
}

export interface CorrelationResponse {
  setHeader(name: string, value: string): void;
}

export function resolveCorrelationId(
  request: CorrelatedRequest,
  response: CorrelationResponse,
): string {
  const correlationId = request.correlationId ?? randomUUID();
  request.correlationId = correlationId;
  response.setHeader('X-Correlation-ID', correlationId);
  return correlationId;
}
