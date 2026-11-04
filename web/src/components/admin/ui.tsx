'use client';

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{message}</div>;
}
