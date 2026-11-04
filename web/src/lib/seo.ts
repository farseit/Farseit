export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

/** Safe to put inside <script type="application/ld+json"> (stops "</script>" in product text from breaking the page). */
export const ldJson = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');