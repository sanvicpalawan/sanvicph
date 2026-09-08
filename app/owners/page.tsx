import OwnerPortal from '@/components/owners/owner-portal';
export const metadata = { title: 'My Locations · SANVIC', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default function OwnersPage() {
  return <OwnerPortal url={process.env.NEXT_PUBLIC_SUPABASE_URL || ''} apiKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''}/>;
}
