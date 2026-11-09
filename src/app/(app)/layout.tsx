import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:pl-56">
      <Nav />
      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-6 md:pb-10 md:pt-10">{children}</main>
    </div>
  );
}
