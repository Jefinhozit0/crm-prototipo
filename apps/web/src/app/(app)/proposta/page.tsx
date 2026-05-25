import { FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function PropostaPage() {
  return (
    <>
      <PageHeader
        title="Revisão de Proposta de Carteira"
        description="Composição sugerida pela IA com simulação de risco/retorno"
      />
      <RoutePlaceholder
        icon={FileText}
        message="Tela de revisão da proposta antes de enviar ao cliente — ajuste de pesos, simulação de cenários e validação do enquadramento."
        bullets={[
          "Distribuição por classe e por produto (drag-to-rebalance)",
          "Cenários: pessimista / base / otimista (Monte Carlo)",
          "Validação de suitability automática",
          "Geração de PDF assinado para envio ao cliente",
        ]}
      />
    </>
  );
}
