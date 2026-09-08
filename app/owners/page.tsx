import OwnerPortal from '@/components/owners/owner-portal';
import { OPEN_OWNER_BUILDER_MODE } from '@/lib/owner-types';
export const metadata = { title: 'My Locations · SANVIC', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default function OwnersPage() {
  return <OwnerPortal openMode={OPEN_OWNER_BUILDER_MODE} url={process.env.NEXT_PUBLIC_SUPABASE_URL || ''} apiKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''}/>;
}
