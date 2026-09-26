import { redirect } from 'next/navigation';

// Spec §6.1: /admin → /admin/orders from M3; until orders exist, land on books.
export default function AdminPage() {
  redirect('/admin/books');
}
