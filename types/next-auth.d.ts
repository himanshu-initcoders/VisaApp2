import 'next-auth';

/**
 * Extend NextAuth types to include custom user fields
 */
declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    /** App uses boolean; NextAuth adapter default is Date | null */
    emailVerified?: boolean | Date | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      emailVerified?: boolean | Date | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    emailVerified: boolean;
  }
}
