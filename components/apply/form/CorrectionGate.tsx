import type { ReactNode } from 'react';

/**
 * In correction mode, locks every control that was not requested.
 * When editableKeys is omitted, children render exactly as in a fresh application.
 */
export function CorrectionGate({
  targetKey,
  editableKeys,
  comment,
  children,
}: {
  targetKey: string;
  editableKeys?: ReadonlySet<string>;
  comment?: string;
  children: ReactNode;
}) {
  if (!editableKeys) return <>{children}</>;

  const locked = !editableKeys.has(targetKey);
  return (
    <div
      id={`correction-${targetKey}`}
      inert={locked ? true : undefined}
      className={
        locked
          ? 'opacity-50'
          : 'rounded-2xl bg-peach-wash/70 p-3 ring-1 ring-[#f3c9a0]'
      }
    >
      {children}
      {!locked && comment ? (
        <p className="mt-2 text-xs leading-5 text-portrait-ink">{comment}</p>
      ) : null}
    </div>
  );
}
