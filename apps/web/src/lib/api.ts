import createClient from 'openapi-fetch'
import type { components, paths } from '../generated/openapi'

export type User = components['schemas']['User']
export type AdminUser = components['schemas']['AdminUser']
export type AssignableRole = components['schemas']['AssignableRole']
export type Catalog = components['schemas']['Catalog']
export type Term = components['schemas']['Term']
export type Artifact = components['schemas']['Artifact']
export type ArtifactPage = components['schemas']['ArtifactPage']

type ApiResult<T> = {
  data?: { data?: T; meta?: components['schemas']['Meta'] }
  error?: unknown
  response: Response
}

const client = createClient<paths>({
  baseUrl: '/api',
  credentials: 'include',
})

client.use({
  onRequest({ request }) {
    request.headers.set('X-Correlation-ID', crypto.randomUUID())
    return request
  },
})

export class ApiError extends Error {
  readonly status: number
  readonly code: components['schemas']['ApiErrorCode']
  readonly correlationId?: string

  constructor(
    message: string,
    status: number,
    code: components['schemas']['ApiErrorCode'] = 'REQUEST_ERROR',
    correlationId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.correlationId = correlationId
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function errorFrom(value: unknown, status: number): ApiError {
  if (isRecord(value) && isRecord(value.error)) {
    const error = value.error
    return new ApiError(
      typeof error.message === 'string' ? error.message : `Yêu cầu thất bại (${status})`,
      status,
      isApiErrorCode(error.code) ? error.code : 'REQUEST_ERROR',
      typeof error.correlationId === 'string' ? error.correlationId : undefined,
    )
  }
  return new ApiError(`Yêu cầu thất bại (${status})`, status)
}

function isApiErrorCode(value: unknown): value is components['schemas']['ApiErrorCode'] {
  return typeof value === 'string' && [
    'VALIDATION_ERROR',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'CONCURRENCY_CONFLICT',
    'RATE_LIMITED',
    'REQUEST_ERROR',
    'INTERNAL_ERROR',
  ].includes(value)
}

async function unwrap<T>(pending: Promise<ApiResult<T>>): Promise<T> {
  const result = await pending
  if (!result.response.ok) throw errorFrom(result.error, result.response.status)
  if (!result.data || result.data.data === undefined) {
    throw new ApiError('Phản hồi API không đúng contract', result.response.status, 'REQUEST_ERROR')
  }
  return result.data.data
}

async function ensureSuccess(pending: Promise<{ error?: unknown; response: Response }>): Promise<void> {
  const result = await pending
  if (!result.response.ok) throw errorFrom(result.error, result.response.status)
}

export const api = {
  auth: {
    me: () => unwrap<User>(client.GET('/auth/me')),
    login: (body: components['schemas']['LoginRequest']) =>
      unwrap<User>(client.POST('/auth/login', { body })),
    logout: () => ensureSuccess(client.POST('/auth/logout')),
  },
  catalogs: {
    list: () => unwrap<Catalog[]>(client.GET('/catalogs')),
    create: (body: components['schemas']['CreateCatalogRequest']) =>
      unwrap<Catalog>(client.POST('/catalogs', { body })),
    terms: (catalogId: string) =>
      unwrap<Term[]>(client.GET('/catalogs/{catalogId}/terms', { params: { path: { catalogId } } })),
    createTerm: (catalogId: string, body: components['schemas']['CreateTermRequest']) =>
      unwrap<Term>(client.POST('/catalogs/{catalogId}/terms', { params: { path: { catalogId } }, body })),
  },
  terms: {
    update: (termId: string, body: components['schemas']['UpdateTermRequest']) =>
      unwrap<Term>(client.PATCH('/terms/{termId}', { params: { path: { termId } }, body })),
    archive: (termId: string, body: components['schemas']['VersionRequest']) =>
      unwrap<components['schemas']['ArchiveResult']>(
        client.DELETE('/terms/{termId}', { params: { path: { termId } }, body }),
      ),
  },
  artifacts: {
    list: (query: { search?: string; limit?: number; offset?: number }) =>
      unwrap<ArtifactPage>(client.GET('/artifacts', { params: { query } })),
    get: (artifactId: string) =>
      unwrap<Artifact>(client.GET('/artifacts/{artifactId}', { params: { path: { artifactId } } })),
    create: (body: components['schemas']['CreateArtifactRequest']) =>
      unwrap<Artifact>(client.POST('/artifacts', { body })),
    update: (artifactId: string, body: components['schemas']['UpdateArtifactRequest']) =>
      unwrap<Artifact>(client.PATCH('/artifacts/{artifactId}', { params: { path: { artifactId } }, body })),
    archive: (artifactId: string, body: components['schemas']['VersionRequest']) =>
      unwrap<components['schemas']['ArchiveResult']>(
        client.DELETE('/artifacts/{artifactId}', { params: { path: { artifactId } }, body }),
      ),
  },
  users: {
    list: () => unwrap<AdminUser[]>(client.GET('/users')),
    roles: () => unwrap<AssignableRole[]>(client.GET('/users/roles')),
    create: (body: components['schemas']['CreateUserRequest']) =>
      unwrap<AdminUser>(client.POST('/users', { body })),
    update: (userId: string, body: components['schemas']['UpdateUserRequest']) =>
      unwrap<AdminUser>(client.PATCH('/users/{userId}', { params: { path: { userId } }, body })),
  },
}
