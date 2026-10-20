import type { ReactNode } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

type LegalPageShellProps = {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
  relatedHref: string;
  relatedLabel: string;
};

export function LegalPageShell({
  title,
  lastUpdated,
  intro,
  children,
  relatedHref,
  relatedLabel,
}: LegalPageShellProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl">
          <header className="mb-10 space-y-4 border-b border-portrait-ink/10 pb-8">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-helper">
              Legal
            </p>
            <h1 className="font-basier text-4xl leading-tight text-portrait-ink sm:text-5xl">
              {title}
            </h1>
            <p className="text-sm text-slate-helper">Last updated: {lastUpdated}</p>
            {intro ? (
              <div className="space-y-4 text-base leading-8 text-portrait-ink/85">
                {intro}
              </div>
            ) : null}
            <p className="text-sm text-slate-helper">
              Also see our{' '}
              <Link
                href={relatedHref}
                className="text-portrait-ink underline underline-offset-2 hover:opacity-80"
              >
                {relatedLabel}
              </Link>
              .
            </p>
          </header>

          <div className="legal-prose space-y-10 text-base leading-8 text-portrait-ink/85 [&_h2]:font-basier [&_h2]:text-2xl [&_h2]:leading-snug [&_h2]:text-portrait-ink [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-portrait-ink [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_a]:text-portrait-ink [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-medium [&_strong]:text-portrait-ink">
            {children}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 space-y-4">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-portrait-ink/10 bg-white">
      <table className="min-w-full text-left text-sm leading-6">
        <thead className="bg-sky-wash/60 text-portrait-ink">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="whitespace-nowrap px-4 py-3 font-medium first:rounded-tl-2xl last:rounded-tr-2xl"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-t border-portrait-ink/8 align-top"
            >
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-portrait-ink/80">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
