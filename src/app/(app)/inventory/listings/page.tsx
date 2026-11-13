import Link from "next/link";
import { InventoryTabs } from "@/components/inventory-tabs";
import { ListingsManager } from "@/components/listings-manager";
import { PageHeader } from "@/components/page-header";
import { currentUserId } from "@/lib/data";

export const metadata = { title: "My listings" };

export default async function ListingsPage() {
  const signedIn = !!(await currentUserId());
  return (
    <div className="space-y-5">
      <PageHeader kicker="Your stuff" title="Inventory" />
      <InventoryTabs active="listings" />
      {signedIn ? <ListingsManager /> : (
        <div className="card space-y-3 text-sm text-dim">
          <p>See and manage everything you have listed on Warframe Market — reprice, hide or remove orders one at a time or in bulk. It needs a Riven Buddy account, because your Warframe Market connection is stored against it.</p>
          <Link href="/login?next=/inventory/listings" className="btn-primary">Sign in</Link>
        </div>
      )}
    </div>
  );
}
