import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingView, type LandingData } from '@/components/shop/LandingView';
import { gql } from '@/lib/api';
import { ldJson, SITE_URL } from '@/lib/seo';

async function load(code: string): Promise<LandingData | null> {
  try {
    const d = await gql<{ shopLanding: LandingData | null }>(`query($c:String!){ shopLanding(code:$c) }`, { c: code }, { revalidate: 30 });
    return d.shopLanding;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const p = await load(params.code);
  if (!p) return { title: 'Product not found', robots: { index: false } };
  const desc = (p.description || `${p.name} from ${p.shopName}`).replace(/\s+/g, ' ').slice(0, 160);
  const url = `${SITE_URL}/p/${p.code}`;
  return {
    title: { absolute: `${p.name} | ${p.shopName}` },
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: p.name, description: desc, url, type: 'website', images: p.images[0] ? [{ url: p.images[0] }] : undefined },
  };
}

export default async function LandingPage({ params }: { params: { code: string } }) {
  const p = await load(params.code);
  if (!p) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || undefined,
    image: p.images,
    brand: { '@type': 'Brand', name: p.shopName },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/p/${p.code}`,
      priceCurrency: 'BDT',
      price: p.price,
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(jsonLd) }} />
      <LandingView data={p} />
    </>
  );
}