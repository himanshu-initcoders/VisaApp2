// Load environment variables from .env file
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../.env') });

import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';

/**
 * Database Seeding Script
 *
 * Creates the initial superadmin user
 * Run with: npm run db:seed
 */

async function seed() {
  console.log('🌱 Seeding database...');

  const superadminEmail = process.env.SUPERADMIN_EMAIL || 'admin@visapass.com';
  const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'Admin@123456';
  const superadminName = process.env.SUPERADMIN_NAME || 'Super Admin';

  try {
    // Check if superadmin already exists
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.email, superadminEmail))
      .limit(1);

    if (existingAdmin) {
      console.log('✅ Superadmin already exists:', superadminEmail);
      console.log('   Role:', existingAdmin.role);
      return;
    }

    // Hash password
    const passwordHash = await hash(superadminPassword, 12);

    // Create superadmin user
    const [admin] = await db
      .insert(users)
      .values({
        email: superadminEmail,
        passwordHash,
        name: superadminName,
        role: 'admin',
        emailVerified: new Date(), // Auto-verify superadmin
      })
      .returning();

    console.log('✅ Superadmin created successfully!');
    console.log('   Email:', admin.email);
    console.log('   Name:', admin.name);
    console.log('   Role:', admin.role);
    console.log('');
    console.log('🔐 Login credentials:');
    console.log('   Email:', superadminEmail);
    console.log('   Password:', superadminPassword);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seed()
  .then(() => {
    console.log('🎉 Seeding completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
