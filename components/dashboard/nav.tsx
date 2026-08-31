"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/reviews", label: "Manage reviews" },
  { href: "/dashboard/widgets", label: "Widgets" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/media", label: "Media" },
  { href: "/dashboard/analytics", label: "Analytics" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop");
  const host = searchParams.get("host");

  function hrefFor(path: string) {
    const query = new URLSearchParams();
    if (shop) query.set("shop", shop);
    if (host) query.set("host", host);
    const value = query.toString();
    return value ? `${path}?${value}` : path;
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex flex-wrap gap-1 text-sm">
      {navItems.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={hrefFor(item.href)}
            className={`rounded-lg px-3 py-1.5 transition ${
              active
                ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
