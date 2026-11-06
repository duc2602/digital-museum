import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveCorrelationId } from './request-context.js';
import { API_ERROR_CODES, type ApiErrorCode } from './api-error-codes.js';

@Catch()
export class PrismaExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<{ correlationId?: string }>();
    const response = http.getResponse<{
      setHeader(name: string, value: string): void;
      status(code: number): { json(body: unknown): void };
      json(body: unknown): void;
    }>();
    const correlationId = resolveCorrelationId(request, response);
    let status = 500;
    let code: ApiErrorCode = API_ERROR_CODES.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload: unknown = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        const rawMessage = body.message;
        if (typeof rawMessage === 'string') message = rawMessage;
        else if (Array.isArray(rawMessage)) {
          message = 'Request validation failed';
          details = rawMessage;
        }
      }
      code = this.codeForStatus(status);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002' || exception.code === 'P2003') {
        status = 409;
        code = API_ERROR_CODES.CONFLICT;
        message = exception.code === 'P2002'
          ? 'A record with this unique value already exists'
          : 'The requested change conflicts with related records';
      } else if (exception.code === 'P2025') {
        status = 404;
        code = API_ERROR_CODES.NOT_FOUND;
        message = 'Record not found';
      } else if (exception.code === 'P2034') {
        status = 409;
        code = API_ERROR_CODES.CONCURRENCY_CONFLICT;
        message = 'Concurrent update; reload and retry';
      } else {
        this.logger.error(`Unhandled Prisma request error correlationId=${correlationId}`);
      }
    } else {
      this.logger.error(`Unhandled API exception correlationId=${correlationId}`);
    }

    response.status(status).json({
      error: { code, message, details, correlationId },
    });
  }

  private codeForStatus(status: number): ApiErrorCode {
    if (status === 400) return API_ERROR_CODES.VALIDATION_ERROR;
    if (status === 401) return API_ERROR_CODES.UNAUTHORIZED;
    if (status === 403) return API_ERROR_CODES.FORBIDDEN;
    if (status === 404) return API_ERROR_CODES.NOT_FOUND;
    if (status === 409) return API_ERROR_CODES.CONFLICT;
    if (status === 429) return API_ERROR_CODES.RATE_LIMITED;
    return status >= 500
      ? API_ERROR_CODES.INTERNAL_ERROR
      : API_ERROR_CODES.REQUEST_ERROR;
  }
}
