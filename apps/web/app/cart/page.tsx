import { PageTitle } from '@/components/ui/page-title';
import { CartView } from './cart-view';

export default function CartPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-[31px] px-[24px] py-[41px]">
      <PageTitle>Giỏ hàng</PageTitle>
      <CartView />
    </div>
  );
}
