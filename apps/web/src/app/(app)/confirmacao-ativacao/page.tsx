import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

// Antes esta tela afirmava "Carteira ativada — alocação enviada à mesa de
// operações" sem nenhuma operação por trás. Agora é explicitamente conceito.
export default function ConfirmacaoAtivacaoPage() {
  return (
    <>
      <PageHeader
        title="Confirmação de Ativação"
        description="Etapa final do fluxo de carteira (planejada)"
      />
      <RoutePlaceholder
        icon={CheckCircle2}
        message="Tela conceito. Nenhuma carteira é ativada e nenhuma ordem é enviada por este sistema nesta versão."
        bullets={[
          "Confirmação após o aceite formal do cliente",
          "Integração com a mesa de operações / plataforma de ordens",
          "Comprovante com trilha de auditoria",
        ]}
      />
    </>
  );
}
