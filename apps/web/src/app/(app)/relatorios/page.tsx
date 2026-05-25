import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function RelatoriosPage() {
  return (
    <>
      <PageHeader
        title="Relatórios e Performance"
        description="Relatórios consolidados de carteira, captação e produtividade do assessor"
      />
      <RoutePlaceholder
        icon={BarChart3}
        message="Relatórios gerados sob demanda ou agendados, exportáveis em PDF e Excel."
        bullets={[
          "Performance de carteira por cliente e por período",
          "Captação líquida e funil de conversão",
          "Comparativo entre assessores (KPIs configuráveis)",
          "Relatórios regulatórios CVM e Anbima",
        ]}
      />
    </>
  );
}
