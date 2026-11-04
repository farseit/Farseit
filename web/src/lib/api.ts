import { compressImage } from './image';
const isServer = typeof window === 'undefined';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SERVER_API_URL = process.env.API_URL || API_URL;

export const TOKEN_KEY = 'farse_token';

type Opts = { token?: string | null; revalidate?: number };

/** Minimal GraphQL client that works in server components and the browser. */
export async function gql<T = any>(query: string, variables?: Record<string, unknown>, opts: Opts = {}): Promise<T> {
  const base = isServer ? SERVER_API_URL : API_URL;
  const token = opts.token ?? (!isServer ? localStorage.getItem(TOKEN_KEY) : null);

  // Server-e public query (token nai, mutation na) default-e 60s cache hobe
  const isQuery = /^\s*(query\b|\{)/.test(query);
  const revalidateSecs = opts.revalidate ?? (isServer && !token && isQuery ? 60 : 0);

  let res: Response;
  try {
    res = await fetch(`${base}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query, variables }),
      ...(revalidateSecs ? { next: { revalidate: revalidateSecs } } : { cache: 'no-store' as const }),
    });
  } catch {
    throw new Error('Cannot reach the server. Please check your connection.');
  }

  const json = await res.json().catch(() => null);
  if (!json) throw new Error('Unexpected server response');
  if (json.errors?.length) {
    const e = json.errors[0];
    const msg = e.extensions?.originalError?.message;
    throw new Error(Array.isArray(msg) ? msg[0] : e.message);
  }
  return json.data as T;
}

/** raw = true: browser-e compress korbe na (transparent PNG-r alpha ba'ch rakhte; server WebP-te alpha rakhe) */
export async function uploadImage(original: File, raw = false, path = '/upload'): Promise<string> {
  const file = raw ? original : await compressImage(original); // big phone photos are shrunk here, before upload
  const fd = new FormData();
  fd.append('file', file, file.name);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}` },
    body: fd,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || 'Upload failed');
  return json.url as string;
}
