export interface AuthPrincipal {
  id: string;
  sessionId: string;
  email: string;
  displayName: string;
  permissions: string[];
}

export interface AuthenticatedRequest {
  headers: { cookie?: string };
  user: AuthPrincipal;
}
