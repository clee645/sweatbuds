// Caller check for functions only the database (triggers / pg_cron) may invoke.
// No Deno or Supabase imports so vitest can exercise it (auth.test.ts).
//
// An exact match against SUPABASE_SERVICE_ROLE_KEY isn't reliable: the key the
// runtime injects doesn't necessarily equal the legacy service_role JWT stored
// in Vault, even when both are valid for the project. Instead we read the JWT's
// `role` claim. That's only safe because the Supabase gateway has already
// verified the signature — so every function using this MUST stay deployed with
// JWT verification on (the default; never pass --no-verify-jwt).

export function isServiceRoleRequest(req: Request, serviceRoleKey?: string): boolean {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return false;
  const token = header.slice('Bearer '.length).trim();
  if (serviceRoleKey && token === serviceRoleKey) return true;
  return jwtRole(token) === 'service_role';
}

function jwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}
