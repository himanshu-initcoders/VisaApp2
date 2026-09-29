import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { visaApplications, passportServices } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  getStatusVariant,
} from '@/components/ui';
import Link from 'next/link';

/**
 * Applicant dashboard — welcome + applications overview.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ submitted?: string }>;
}) {
  const session = await auth();

  if (!session) {
    redirect('/signin');
  }

  const params = searchParams ? await searchParams : {};
  const submittedId = params.submitted;
  const firstName = session.user.name?.split(' ')[0] || 'traveler';

  const [visaApps, passportApps] = await Promise.all([
    db
      .select()
      .from(visaApplications)
      .where(eq(visaApplications.userId, session.user.id))
      .orderBy(desc(visaApplications.createdAt))
      .limit(8),
    db
      .select()
      .from(passportServices)
      .where(eq(passportServices.userId, session.user.id))
      .orderBy(desc(passportServices.createdAt))
      .limit(8),
  ]);

  const totalApplications = visaApps.length + passportApps.length;
  const inProgress =
    visaApps.filter((a) =>
      ['submitted', 'under_review', 'draft'].includes(a.status)
    ).length +
    passportApps.filter((a) =>
      ['submitted', 'under_review', 'draft', 'in_progress'].includes(a.status)
    ).length;
  const approved =
    visaApps.filter((a) => a.status === 'approved').length +
    passportApps.filter((a) =>
      ['approved', 'completed'].includes(a.status)
    ).length;

  const recent = [
    ...visaApps.map((app) => ({
      id: app.id,
      kind: 'visa' as const,
      title: `${app.country || app.countryCode || 'Visa'} · ${app.visaType}`,
      status: app.status,
      date: app.submittedAt || app.createdAt,
      href: `/applications`,
    })),
    ...passportApps.map((app) => ({
      id: app.id,
      kind: 'passport' as const,
      title: `Passport · ${app.serviceType}`,
      status: app.status,
      date: app.submittedAt || app.createdAt,
      href: `/applications`,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {submittedId && (
        <div className="rounded-[24px] border border-ash bg-mint-wash/60 px-6 py-4">
          <p className="font-switzer text-sm text-portrait-ink">
            Application submitted successfully
            {submittedId.length > 8 ? ` (${submittedId.slice(0, 8)}…)` : ''}.
            We&apos;ll update you as it moves through review.
          </p>
        </div>
      )}

      <section className="relative overflow-hidden rounded-[28px] border border-ash bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 100% 0%, #e8f1ff 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 0% 100%, #d7ffe2 0%, transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative">
          <p className="font-switzer text-sm text-slate-helper">Your account</p>
          <h1 className="mt-2 font-basier text-[40px] leading-tight tracking-tight text-portrait-ink sm:text-[48px]">
            Welcome back,{' '}
            <span className="bg-gradient-rainbow bg-clip-text italic text-transparent">
              {firstName}
            </span>
          </h1>
          <p className="mt-3 max-w-xl font-switzer text-base leading-7 text-slate-helper">
            Track visa applications, pick up where you left off, and start a new
            trip whenever you&apos;re ready.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/destinations">
              <Button variant="primary" size="md">
                Browse destinations
              </Button>
            </Link>
            <Link href="/applications">
              <Button variant="ghost" size="md">
                View applications
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-ash">
          <CardHeader className="pb-2">
            <CardDescription>Total</CardDescription>
            <CardTitle className="font-basier text-4xl text-portrait-ink">
              {totalApplications}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-switzer text-xs text-slate-helper">
              Applications on file
            </p>
          </CardContent>
        </Card>
        <Card className="border-ash">
          <CardHeader className="pb-2">
            <CardDescription>In progress</CardDescription>
            <CardTitle className="font-basier text-4xl text-portrait-ink">
              {inProgress}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-switzer text-xs text-slate-helper">
              Awaiting review or action
            </p>
          </CardContent>
        </Card>
        <Card className="border-ash">
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="font-basier text-4xl text-portrait-ink">
              {approved}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-switzer text-xs text-slate-helper">
              Ready for travel
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-basier text-2xl text-portrait-ink">
              Recent applications
            </h2>
            <p className="mt-1 font-switzer text-sm text-slate-helper">
              Latest visa and passport activity
            </p>
          </div>
          {totalApplications > 0 && (
            <Link
              href="/applications"
              className="font-switzer text-sm text-nautical-teal hover:text-portrait-ink"
            >
              See all
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <Card className="border-ash">
            <CardContent className="py-14 text-center">
              <p className="font-switzer text-portrait-ink">
                No applications yet
              </p>
              <p className="mt-2 font-switzer text-sm text-slate-helper">
                Start with a destination to create your first visa application.
              </p>
              <div className="mt-6">
                <Link href="/destinations">
                  <Button variant="primary" size="md">
                    Explore destinations
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {recent.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-4 rounded-[20px] border border-ash bg-white px-5 py-4 transition-colors hover:bg-sky-wash/30"
                >
                  <div className="min-w-0">
                    <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
                      {item.title}
                    </p>
                    <p className="mt-1 font-switzer text-xs text-slate-helper">
                      {new Date(item.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </p>
                  </div>
                  <Badge variant={getStatusVariant(item.status)}>
                    {item.status.replace(/_/g, ' ')}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
