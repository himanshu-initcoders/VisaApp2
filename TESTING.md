# 🧪 Testing Guide

Quick guide to test the authentication system.

---

## Prerequisites

✅ Development server running at http://localhost:3000  
✅ Database connection configured in `.env`  
✅ Migrations applied to database

---

## Test Authentication Flow

### 1. Test Registration

**URL**: http://localhost:3000/register

**Steps**:
1. Fill in the form:
   - Name: "Test User"
   - Email: "test@example.com"
   - Phone (optional): "9876543210"
   - Password: "Test@123456"
   - Confirm Password: "Test@123456"

2. Watch the password strength indicator change as you type

3. Check the Terms of Service checkbox

4. Click "Create account"

**Expected Result**:
- ✅ Redirected to `/login?registered=true`
- ✅ Success message shown
- ✅ User created in database with hashed password

**To Verify in Database**:
```bash
npm run db:studio
```
Check `users` table for the new user.

---

### 2. Test Login

**URL**: http://localhost:3000/login

**Steps**:
1. Enter credentials:
   - Email: "test@example.com"
   - Password: "Test@123456"

2. Optionally check "Remember me"

3. Click "Sign in"

**Expected Result**:
- ✅ Redirected to `/dashboard`
- ✅ See personalized welcome message
- ✅ Session cookie created
- ✅ Navigation bar shows user email/name

---

### 3. Test Dashboard

**URL**: http://localhost:3000/dashboard (automatically after login)

**Expected Features**:
- ✅ Welcome message with user's first name in gradient
- ✅ Two quick action cards (Visa & Passport)
- ✅ Stats overview (currently showing 0 applications)
- ✅ Navigation links (Dashboard, Applications, Documents, Profile)
- ✅ Sign out button

**Try Clicking**:
- "Start visa application" → Should go to `/applications/visa/new`
- "Start passport service" → Should go to `/applications/passport/new`
- (These pages don't exist yet - will show 404)

---

### 4. Test Route Protection

**Test A: Protected Route Without Auth**

1. Sign out (click "Sign out" button)
2. Try to visit: http://localhost:3000/dashboard
3. **Expected**: Redirected to `/login?callbackUrl=/dashboard`

**Test B: Auth Page While Logged In**

1. Sign in again
2. Try to visit: http://localhost:3000/login
3. **Expected**: Redirected to `/dashboard`

---

### 5. Test Validation

**Registration Validation**:

Try these invalid inputs:

| Field | Invalid Input | Expected Error |
|-------|--------------|----------------|
| Name | "A" | "Name must be at least 2 characters" |
| Email | "notanemail" | "Invalid email address" |
| Phone | "123" | "Invalid Indian phone number" |
| Password | "weak" | "Password must be at least 8 characters" |
| Password | "nouppercaseornumber" | Multiple requirements shown |
| Confirm Password | "different" | "Passwords don't match" |

**Login Validation**:

| Input | Expected Result |
|-------|----------------|
| Wrong email | "Invalid email or password" |
| Wrong password | "Invalid email or password" |
| Empty fields | Validation errors |

---

### 6. Test Password Strength Indicator

**URL**: http://localhost:3000/register

Type these passwords and watch the indicator:

| Password | Expected Strength | Color |
|----------|------------------|-------|
| "abc" | Weak | Red |
| "password" | Weak | Red |
| "Password" | Fair | Yellow |
| "Password1" | Good | Blue |
| "Password1!" | Strong | Green |

The indicator should update in real-time as you type.

---

### 7. Test Session Persistence

1. Sign in to dashboard
2. Refresh the page (F5)
3. **Expected**: Still logged in, dashboard shows

4. Close browser and reopen
5. Visit http://localhost:3000/dashboard
6. **Expected**: Still logged in (if "Remember me" was checked)

---

### 8. Test Sign Out

**From Dashboard**:

1. Click "Sign out" button
2. **Expected**: 
   - Redirected to `/login`
   - Session cleared
   - Can't access dashboard without signing in again

---

## Database Verification

### Check User Creation

```bash
# Open Drizzle Studio
npm run db:studio
```

Visit: https://local.drizzle.studio

**Verify**:
1. User exists in `users` table
2. Password is hashed (starts with `$2b$`)
3. `emailVerified` is `false`
4. `role` is `user`
5. `createdAt` and `updatedAt` are set

---

## Common Issues

### Issue: "DATABASE_URL environment variable is not set"

**Fix**: Make sure `.env` file exists with valid `DATABASE_URL`

```bash
# Check if .env exists
ls -la .env

# If not, copy from example
cp .env.example .env

# Edit with your database credentials
```

### Issue: "Cannot find module 'next-auth'"

**Fix**: Install dependencies

```bash
npm install
```

### Issue: Database connection error

**Fix**: Make sure PostgreSQL is running

```bash
# Check if database exists
psql -U postgres -c "\l"

# Create database if needed
psql -U postgres -c "CREATE DATABASE visa_db;"
```

### Issue: Migrations not applied

**Fix**: Run migrations

```bash
npm run db:generate
npm run db:migrate
```

### Issue: Port 3000 already in use

**Fix**: Kill the process or use different port

```bash
# Kill process on port 3000 (Windows)
taskkill /F /IM node.exe

# Or use different port
npm run dev -- -p 3001
```

---

## Next Steps After Testing

Once authentication is working:

1. ✅ Test all authentication flows
2. ⬜ Implement email verification
3. ⬜ Add password reset functionality
4. ⬜ Create profile management page
5. ⬜ Build visa application flow
6. ⬜ Build passport services flow

---

## API Testing (Optional)

### Test Registration API

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test User",
    "email": "apitest@example.com",
    "password": "Test@123456",
    "confirmPassword": "Test@123456"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "apitest@example.com",
    "name": "API Test User"
  },
  "message": "Account created successfully..."
}
```

---

## Design System Verification

Visit the pages and verify Portrait design system:

**Landing Page** (http://localhost:3000):
- ✅ Display headline with gradient word
- ✅ Switzer font for body text
- ✅ Basier Circle for headlines
- ✅ Primary button with Portrait Ink border

**Login/Register Pages**:
- ✅ Centered layout
- ✅ Elevated card with 24px radius
- ✅ Gradient accent on headline
- ✅ Input fields with 16px radius
- ✅ Error messages in red
- ✅ Helper text in slate-helper color

**Dashboard**:
- ✅ Navigation bar with Portrait design
- ✅ White background with canvas body
- ✅ Card shadows (elevated)
- ✅ Rainbow gradient on personalized name

---

## Security Checklist

Test these security features:

- ✅ Passwords are hashed (check in database)
- ✅ Protected routes redirect to login
- ✅ Can't access other users' data
- ✅ Session expires after sign out
- ✅ Validation on client and server
- ✅ Error messages don't leak sensitive info
- ✅ CSRF protection (Next.js built-in)

---

**Happy Testing! 🚀**

Need help? Check:
- [README.md](./README.md)
- [SETUP.md](./SETUP.md)
- [CLAUDE.md](./CLAUDE.md)
- [Obsidian vault](./obsidian-vault/)
