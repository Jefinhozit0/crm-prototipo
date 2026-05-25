import {
  LayoutDashboard,
  Users,
  FileCheck2,
  Package,
  Sparkles,
  GitBranch,
  History,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads & Clientes", icon: Users },
  { href: "/suitability", label: "Suitability", icon: FileCheck2 },
  { href: "/produtos", label: "Produtos", icon: Package },
  { href: "/recomendacao", label: "Recomendações IA", icon: Sparkles },
  { href: "/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/historico", label: "Histórico", icon: History },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
];
