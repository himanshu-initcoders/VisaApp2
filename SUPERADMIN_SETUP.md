# Superadmin Setup Guide

## Overview

The Visa & Passport Service Platform requires at least one superadmin user to manage applications. This guide explains how to create the initial superadmin account.

---

## Method 1: Database Seeding (Recommended)

### Step 1: Configure Environment Variables (Optional)

Create or update your `.env` file with custom superadmin credentials:

```bash
# Optional: Customize superadmin credentials
SUPERADMIN_EMAIL=admin@yourcompany.com
SUPERADMIN_PASSWORD=YourSecurePassword123!
SUPERADMIN_NAME=Your Name
```

**Default credentials** (if not specified):
- Email: `admin@visapass.com`
- Password: `Admin@123456`
- Name: `Super Admin`

### Step 2: Run Database Migrations

Ensure your database schema is up to date:

```bash
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations to database
```

### Step 3: Run Seed Script

Execute the seeding script to create the superadmin:

```bash
npm run db:seed
```

**Expected output:**
```
🌱 Seeding database...
✅ Superadmin created successfully!
   Email: admin@visapass.com
   Name: Super Admin
   Role: admin

🔐 Login credentials:
   Email: admin@visapass.com
   Password: Admin@123456

⚠️  IMPORTANT: Change the password after first login!
🎉 Seeding completed!
```

### Step 4: Login

1. Start the development server: `npm run dev`
2. Navigate to: `http://localhost:3000/login`
3. Login with the credentials shown in the seed output
4. Access admin panel at: `http://localhost:3000/admin`

### Step 5: Change Password (Security)

⚠️ **IMPORTANT**: Change the default password immediately after first login!

1. Go to Profile/Settings
2. Update password to a strong, unique password
3. Never commit credentials to version control

---

## Method 2: Manual Database Insertion

If you prefer to manually insert the superadmin via database client:

### Using PostgreSQL CLI (psql)

```sql
-- Connect to your database
psql -U your_username -d visa_db

-- Hash the password first (use bcrypt online tool or Node.js script)
-- Example: 'Admin@123456' hashed with bcrypt (12 rounds)

-- Insert superadmin user
INSERT INTO users (
  email,
  password_hash,
  name,
  role,
  email_verified,
  created_at,
  updated_at
) VALUES (
  'admin@yourcompany.com',
  '$2a$12$YOUR_BCRYPT_HASHED_PASSWORD_HERE',
  'Super Admin',
  'admin',
  NOW(),
  NOW(),
  NOW()
);
```

### Using Drizzle Studio

1. Start Drizzle Studio: `npm run db:studio`
2. Open in browser: `http://localhost:4983`
3. Navigate to `users` table
4. Click "Add Row"
5. Fill in fields:
   - `email`: Your admin email
   - `password_hash`: Bcrypt hashed password (12+ rounds)
   - `name`: Your name
   - `role`: `admin`
   - `email_verified`: Current timestamp
6. Save

---

## Method 3: Temporary Registration Override (Development Only)

For development environments, you can temporarily allow admin registration:

### Step 1: Modify Registration API

Edit `app/api/auth/register/route.ts`:

```typescript
// Add at the top
const ADMIN_REGISTRATION_CODE = process.env.ADMIN_REGISTRATION_CODE || 'ADMIN_SECRET_2026';

// In the registration logic, add:
const isAdminRegistration = formData.get('adminCode') === ADMIN_REGISTRATION_CODE;
const role = isAdminRegistration ? 'admin' : 'user';

// When creating user:
await db.insert(users).values({
  email,
  passwordHash,
  name,
  role, // Use the role variable
  // ... other fields
});
```

### Step 2: Add Admin Code Input to Registration Form

Add a hidden/conditional field to the registration form for the admin code.

### Step 3: Register with Admin Code

Register a new account and provide the `ADMIN_REGISTRATION_CODE`.

⚠️ **WARNING**: Remove this override in production! Never deploy with this code enabled.

---

## Method 4: Promote Existing User

If you already have a user account, promote it to admin:

### Using PostgreSQL

```sql
UPDATE users 
SET role = 'admin' 
WHERE email = 'your-existing-email@example.com';
```

### Using Drizzle Studio

1. Open Drizzle Studio: `npm run db:studio`
2. Find your user in the `users` table
3. Edit the `role` field to `admin`
4. Save changes

---

## User Roles Explained

The platform supports three roles:

1. **user** (default)
   - Can apply for visas and passports
   - Can view own applications
   - Can upload documents
   - Cannot access admin panel

2. **reviewer**
   - Can access admin panel
   - Can review applications
   - Can verify documents
   - Can update application statuses
   - Cannot manage users (admin-only)

3. **admin** (superadmin)
   - Full access to admin panel
   - Can review and manage all applications
   - Can verify documents
   - Can update application statuses
   - Can manage users
   - Can view audit logs

---

## Creating Additional Admin Users

Once you have a superadmin account:

1. Login as superadmin
2. Navigate to: `/admin/users`
3. Find the user you want to promote
4. Update their role to `admin` or `reviewer`

**Note**: User role management UI is planned for Phase 2. For now, use database updates.

---

## Security Best Practices

### Password Requirements
- Minimum 8 characters
- Include uppercase and lowercase letters
- Include numbers
- Include special characters
- Avoid common passwords

### Recommendations
1. **Change default credentials immediately**
2. **Use environment variables** for production superadmin setup
3. **Never commit** `.env` files with real credentials
4. **Enable 2FA** (planned for future release)
5. **Rotate passwords regularly** (every 90 days)
6. **Limit superadmin accounts** (only 1-2 per organization)
7. **Use reviewer role** for staff who don't need full admin access

---

## Troubleshooting

### "Superadmin already exists" message

If you see this message, a superadmin account already exists in the database. Use the existing credentials or reset the password via database.

### Cannot login with seeded credentials

1. **Check database connection**: Ensure `DATABASE_URL` in `.env` is correct
2. **Verify email**: Check `users` table to confirm user exists
3. **Check email_verified**: Must not be `NULL`
4. **Password hash**: Ensure bcrypt hash is correct (12 rounds)
5. **Role field**: Must be exactly `'admin'` (lowercase)

### "Unauthorized" error when accessing /admin

1. Verify user role is `'admin'` or `'reviewer'` in database
2. Clear browser cookies and re-login
3. Check middleware logs for role detection issues
4. Verify JWT token includes role claim

### Seed script errors

```bash
# If tsx is not installed
npm install -D tsx

# If database connection fails
# Check DATABASE_URL in .env
# Verify PostgreSQL is running
pg_isready -h localhost -p 5432

# Test database connection
npm run db:studio
```

---

## Example: Complete Setup Flow

```bash
# 1. Clone repository
git clone <repo-url>
cd visa-platform

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and other configs

# 4. Run database migrations
npm run db:generate
npm run db:migrate

# 5. Create superadmin
npm run db:seed

# 6. Start development server
npm run dev

# 7. Login at http://localhost:3000/login
# Use credentials from seed output

# 8. Access admin panel at http://localhost:3000/admin

# 9. Change password immediately!
```

---

## Production Deployment

For production environments:

1. **Use environment variables** for superadmin creation
2. **Never use default credentials**
3. **Run seed script on first deployment only**
4. **Set up proper backup and recovery**
5. **Enable audit logging** (already implemented)
6. **Monitor admin actions** via statusHistory table
7. **Consider IP whitelisting** for admin panel

### Example Production Seed

```bash
# Set environment variables on production server
export SUPERADMIN_EMAIL=admin@yourcompany.com
export SUPERADMIN_PASSWORD=$(openssl rand -base64 32)  # Generate secure password
export SUPERADMIN_NAME="Company Admin"
export DATABASE_URL=postgresql://...

# Run seed script once
npm run db:seed

# Save the generated password securely (password manager)
```

---

## Support

If you encounter issues with superadmin setup:

1. Check this documentation first
2. Review database logs
3. Check application logs (`console.log` output)
4. Open an issue on GitHub with error details

---

**Last Updated**: 2026-08-14  
**Version**: 1.0
