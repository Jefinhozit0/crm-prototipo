"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { mainNav } from "@/lib/nav";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:z-30 bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 text-sidebar-primary-foreground shadow-sm">
          <span className="text-sm font-bold tracking-tight">CE</span>
        </div>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight text-sm text-white">Capital Elite</p>
          <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-[0.12em] mt-0.5">
            Wealth Management
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/40 font-semibold">
          Operação
        </p>
        <ul className="flex flex-col gap-0.5">
          {mainNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
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
                  />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* CTA + footer */}
      <div className="p-3 border-t border-sidebar-border space-y-3">
        <Button className="w-full" size="sm">
          <Plus className="h-4 w-4" />
          Nova carteira
        </Button>
        <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-sidebar-foreground/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Conectado · v0.1.0
        </div>
      </div>
    </aside>
  );
}
