'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { gql, TOKEN_KEY } from '@/lib/api';
import { releasePush } from '@/lib/push';
import type { User } from '@/lib/types';

const USER_FIELDS = 'id name email phone role createdAt avatar';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (input: { name: string; phone: string; email?: string; password: string }) => Promise<User>;
  logout: () => void;
  /** profile edit korar por header/sidebar-e notun naam dekhate */
  updateUser: (u: User) => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => { throw new Error('no provider'); },
  register: async () => { throw new Error('no provider'); },
  logout: () => {},
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    gql<{ me: User }>(`query { me { ${USER_FIELDS} } }`)
      .then((d) => setUser(d.me))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const finish = (p: { accessToken: string; user: User }) => {
    localStorage.setItem(TOKEN_KEY, p.accessToken);
    setUser(p.user);
    return p.user;
  };

  const login = useCallback(async (identifier: string, password: string) => {
    const d = await gql<{ login: { accessToken: string; user: User } }>(
      `mutation($i:String!,$p:String!){ login(identifier:$i,password:$p){ accessToken user{ ${USER_FIELDS} } } }`,
      { i: identifier, p: password },
      { token: '' },
    );
    return finish(d.login);
  }, []);

  const register = useCallback(async (input: any) => {
    const d = await gql<{ register: { accessToken: string; user: User } }>(
      `mutation($input:RegisterInput!){ register(input:$input){ accessToken user{ ${USER_FIELDS} } } }`,
      { input },
      { token: '' },
    );
    return finish(d.register);
  }, []);

  const logout = useCallback(() => {
    // customer ar agent-er device theke push soriye dei, jeno logout-er pore onno-jon-er noti na ashe (owner-er order alert cholte thake)
    if (userRef.current && userRef.current.role !== 'ADMIN') void releasePush(localStorage.getItem(TOKEN_KEY) || '');
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  return <Ctx.Provider value={{ user, loading, login, register, logout, updateUser }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);