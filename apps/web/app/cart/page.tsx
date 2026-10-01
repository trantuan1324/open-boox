import { PageTitle } from '@/components/ui/page-title';
import { CartView } from './cart-view';

export default function CartPage() {
  return (
    <div className="sheet sheet-pad flex w-full flex-col gap-[31px]">
      <PageTitle>Giỏ hàng</PageTitle>
      <CartView />
    </div>
  );
}
