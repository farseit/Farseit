import { redirect } from 'next/navigation';

export default function LoginRedirect() {
  redirect('/shop/start?mode=login');
}
