"use client";

import { Plus } from "lucide-react";
import { EmBreveButton } from "@/components/demo";
import { Marca, NavLinks } from "@/components/nav-links";

export function AppSidebar() {
  return (
    <aside
      className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:z-30 bg-sidebar text-sidebar-foreground"
      aria-label="Navegação principal"
    >
      <div className="flex items-center px-5 h-16 border-b border-sidebar-border">
        <Marca />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Operação">
        <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.14em] text-sidebar-foreground/50 font-semibold">
          Operação
        </p>
        <NavLinks />
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-3">
        <EmBreveButton variant="default" className="w-full">
          <Plus className="h-4 w-4" aria-hidden />
          Nova carteira
        </EmBreveButton>
        <p className="px-2 py-1 text-[11px] text-sidebar-foreground/60">
          Capital Elite · MVP v0.2
        </p>
      </div>
    </aside>
  );
}
