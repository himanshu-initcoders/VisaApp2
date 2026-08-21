import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { visaApplications, passportServices } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui';
import Link from 'next/link';

/**
 * Dashboard Page
 *
 * Features:
 * - Overview of user's applications
 * - Quick actions to start new applications
 * - Recent activity
 * - Application status cards
 */

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  // Fetch user's applications
  const [visaApps, passportApps] = await Promise.all([
    db
      .select()
      .from(visaApplications)
      .where(eq(visaApplications.userId, session.user.id))
      .orderBy(desc(visaApplications.createdAt))
      .limit(5),
    db
      .select()
      .from(passportServices)
      .where(eq(passportServices.userId, session.user.id))
      .orderBy(desc(passportServices.createdAt))
      .limit(5),
  ]);

  const totalApplications = visaApps.length + passportApps.length;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="font-basier text-display text-portrait-ink mb-2">
          Welcome back,{' '}
          <span className="italic bg-gradient-rainbow bg-clip-text text-transparent">
            {session.user.name?.split(' ')[0] || 'traveler'}
          </span>
        </h1>
        <p className="font-switzer text-lg text-slate-helper">
          Your travel document dashboard
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="elevated" className="hover:shadow-elevated-hover transition-shadow">
          <CardHeader>
            <CardTitle>Apply for Visa</CardTitle>
            <CardDescription>
              Get your visa for international travel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/applications/visa/new">
              <Button variant="primary" size="lg" className="w-full">
                Start visa application
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card variant="elevated" className="hover:shadow-elevated-hover transition-shadow">
          <CardHeader>
            <CardTitle>Passport Services</CardTitle>
            <CardDescription>
              Apply for new passport or renewal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/applications/passport/new">
              <Button variant="primary" size="lg" className="w-full">
                Start passport service
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-4xl font-basier">
              {totalApplications}
            </CardTitle>
            <CardDescription>Total Applications</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-4xl font-basier">
              {visaApps.filter((app) => app.status === 'approved').length}
            </CardTitle>
            <CardDescription>Approved Visas</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-4xl font-basier">
              {passportApps.filter((app) => app.status === 'completed').length}
            </CardTitle>
            <CardDescription>Completed Services</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Applications */}
      {totalApplications > 0 ? (
        <div>
          <h2 className="font-switzer text-xl font-semibold text-portrait-ink mb-4">
            Recent Applications
          </h2>
          <div className="space-y-4">
            {visaApps.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {app.country} - {app.visaType}
                      </CardTitle>
                      <CardDescription>
                        Applied on {new Date(app.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full font-switzer text-sm ${
                        app.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : app.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : app.status === 'in_review'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {app.status.replace('_', ' ')}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {passportApps.map((app) => (
              <Card key={app.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        Passport - {app.serviceType}
                      </CardTitle>
                      <CardDescription>
                        Applied on {new Date(app.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full font-switzer text-sm ${
                        app.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : app.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : app.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {app.status.replace('_', ' ')}
                    </span>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>

          <div className="mt-6">
            <Link href="/applications">
              <Button variant="ghost">View all applications →</Button>
            </Link>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-switzer text-slate-helper mb-4">
              You haven't started any applications yet
            </p>
            <p className="font-switzer text-sm text-slate-helper">
              Get started by choosing a service above
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
