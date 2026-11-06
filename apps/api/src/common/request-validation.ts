import { BadRequestException } from '@nestjs/common';

export type RequestBody = Record<string, unknown>;

export function asRequestBody(value: unknown): RequestBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Request body must be an object');
  }
  return value as RequestBody;
}

export function assertAllowedKeys(
  body: RequestBody,
  allowedKeys: readonly string[],
): void {
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(body).find((key) => !allowed.has(key));
  if (unexpected) {
    throw new BadRequestException(`Unexpected field: ${unexpected}`);
  }
}

export function requiredString(
  body: RequestBody,
  key: string,
  minLength = 1,
  maxLength = 200,
): string {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new BadRequestException(`${key} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new BadRequestException(
      `${key} must be between ${minLength} and ${maxLength} characters`,
    );
  }
  return normalized;
}

export function optionalString(
  body: RequestBody,
  key: string,
  maxLength = 2000,
): string | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new BadRequestException(`${key} must be a string no longer than ${maxLength} characters`);
  }
  return value.trim();
}

export function requiredVersion(body: RequestBody): number {
  const value = body.expectedVersion;
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new BadRequestException('expectedVersion must be a positive integer');
  }
  return Number(value);
}

export function optionalUuid(body: RequestBody, key: string): string | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string' || !isUuid(value)) {
    throw new BadRequestException(`${key} must be a UUID or null`);
  }
  return value;
}

export function requiredUuid(value: string, field: string): string {
  if (!isUuid(value)) {
    throw new BadRequestException(`${field} must be a UUID`);
  }
  return value;
}

export function optionalUuidArray(body: RequestBody, key: string): string[] | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length > 50 ||
    value.some((item) => typeof item !== 'string' || !isUuid(item)) ||
    new Set(value).size !== value.length
  ) {
    throw new BadRequestException(`${key} must be an array of up to 50 unique UUIDs`);
  }
  return value;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
