import { SaasAdminShell } from '@/components/admin/SaasAdminShell';

export const metadata = { title: 'Super admin', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SaasAdminShell>{children}</SaasAdminShell>;
}
