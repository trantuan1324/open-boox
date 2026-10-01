import { PageTitle } from '@/components/ui/page-title';
import { CartView } from './cart-view';

export default function CartPage() {
  return (
    <div className="sheet mx-auto flex w-full max-w-3xl flex-col gap-[31px] px-[20px] py-[48px] md:px-[48px] md:py-[72px]">
      <PageTitle>Giỏ hàng</PageTitle>
      <CartView />
    </div>
  );
}
