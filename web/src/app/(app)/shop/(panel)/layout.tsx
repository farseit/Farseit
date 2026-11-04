import { ShopShell } from '@/components/shop/ShopShell';

export const metadata = { title: 'Shop dashboard', robots: { index: false, follow: false } };

export default function ShopPanelLayout({ children }: { children: React.ReactNode }) {
  return <ShopShell>{children}</ShopShell>;
}