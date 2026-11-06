import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import { resolveCorrelationId } from './request-context.js';

@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ correlationId?: string }>();
    const response = http.getResponse<{ setHeader(name: string, value: string): void }>();
    const correlationId = resolveCorrelationId(request, response);

    return next.handle().pipe(
      map((data: unknown) => ({ data, meta: { correlationId } })),
    );
  }
}
