"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mainNav } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function isAtivo(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  // /leads também cobre a ficha do cliente (/clientes/:id)
  if (href === "/leads") return pathname.startsWith("/leads") || pathname.startsWith("/clientes");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Links da navegação principal — usados na sidebar (desktop) e no menu mobile. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <ul className="flex flex-col gap-0.5">
      {mainNav.map((item) => {
        const Icon = item.icon;
        const active = isAtivo(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all focus-visible:outline-2 focus-visible:outline-sidebar-primary",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-sidebar-primary" />
              )}
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-sidebar-primary" : "text-sidebar-foreground/60",
                )}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Marca() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-sm">
        <span className="text-sm font-bold tracking-tight" aria-hidden>
          CE
        </span>
      </div>
      <div className="leading-tight">
        <p className="font-semibold tracking-tight text-sm text-white">Capital Elite</p>
        <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-[0.12em] mt-0.5">
          Wealth Management
        </p>
      </div>
    </div>
  );
}
