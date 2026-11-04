import { gql } from './api';

export type ShopPageInfo = { id: string; pageId: string; name: string | null; status: string; createdAt: string };
export type ShopAccess = {
  ok: boolean;
  reason: null | 'SUSPENDED' | 'EXPIRED' | 'LIMIT';
  plan: string;
  planName: string;
  limit: number;
  used: number;
  pagesLimit: number;
  expiresAt: string | null;
  daysLeft: number | null;
};

export type Shop = {
  id: string;
  name: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  plan: string;
  trialEndsAt: string | null;
  botEnabled: boolean;
  myRole: 'OWNER' | 'AGENT';
  approved: boolean;
  planEndsAt: string | null;
  access: ShopAccess;
  pages: ShopPageInfo[];
};

export const fetchMyShop = async (): Promise<Shop | null> => (await gql<{ myShop: Shop | null }>(`query { myShop }`)).myShop;

export const SUPPORT_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE || '01761402081';

/** Trial-er koyta din baki (nei hole null) */
export const trialDaysLeft = (s: Shop) =>
  s.status === 'TRIAL' && s.trialEndsAt ? Math.max(0, Math.ceil((new Date(s.trialEndsAt).getTime() - Date.now()) / 86400000)) : null;

// ------------------------------------------------------------ Facebook Login (Page connect-er jonno)
declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

let sdk: Promise<any> | null = null;

export function loadFacebookSdk(): Promise<any> {
  const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
  if (!appId) return Promise.reject(new Error('NEXT_PUBLIC_FB_APP_ID web-er .env-e set kora nei'));
  if (sdk) return sdk;
  sdk = new Promise((resolve, reject) => {
    if (window.FB) return resolve(window.FB);
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: false, xfbml: false, version: 'v21.0' });
      resolve(window.FB);
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.onerror = () => {
      sdk = null;
      reject(new Error('Facebook load hoyni (ad-blocker/internet check korun)'));
    };
    document.head.appendChild(s);
  });
  return sdk;
}

/** Popup-e Facebook login, short-lived user access token ferot dey */
export async function facebookLogin(): Promise<string> {
  const FB = await loadFacebookSdk();
  return new Promise((resolve, reject) => {
    FB.login(
      (r: any) => {
        if (r?.authResponse?.accessToken) resolve(r.authResponse.accessToken);
        else reject(new Error('Facebook login complete hoyni'));
      },
      {
        scope: 'pages_show_list,pages_messaging,pages_manage_metadata,pages_read_engagement,business_management',
        auth_type: 'rerequest',
      },
    );
  });
}