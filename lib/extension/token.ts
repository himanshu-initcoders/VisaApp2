import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'visa-app';
const AUDIENCE = 'formbridge-extension';
const TTL = '12h';

export type ExtensionStaff = {
  id: string;
  email: string;
  role: 'admin' | 'reviewer';
  name: string;
};

function secretKey() {
  const raw = process.env.NEXTAUTH_SECRET;
  if (!raw) {
    throw new Error('NEXTAUTH_SECRET is not set');
  }
  return new TextEncoder().encode(raw);
}

export async function signExtensionToken(user: ExtensionStaff): Promise<string> {
  return new SignJWT({
    email: user.email,
    role: user.role,
    name: user.name,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secretKey());
}

export async function readExtensionStaff(
  request: Request
): Promise<ExtensionStaff | null> {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], secretKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.role !== 'admin' && payload.role !== 'reviewer') return null;
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}
