import { redirect } from 'next/navigation';

// Spec §6.1: /admin lands on orders from M3.
export default function AdminPage() {
  redirect('/admin/orders');
}
