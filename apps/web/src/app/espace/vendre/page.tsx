import { redirect } from 'next/navigation';

/** The checkout moved to /caisse, which also works offline (Phase 11). */
export default function SellPage() {
  redirect('/caisse');
}
