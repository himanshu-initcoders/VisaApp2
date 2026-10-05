import 'next-auth';

/**
 * Extend NextAuth types to include custom user fields
 */
declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    phone?: string | null;
    /** App uses boolean; NextAuth adapter default is Date | null */
    emailVerified?: boolean | Date | null;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name: string | null;
      role: string;
      phone?: string | null;
      emailVerified?: boolean | Date | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    phone?: string | null;
    emailVerified: boolean;
    /** Set when the account row has deactivatedAt. */
    deactivated?: boolean;
  }
}
