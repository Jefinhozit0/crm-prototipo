import { Shield } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { RoutePlaceholder } from "@/components/route-placeholder";

export default function AprovacaoClientePage() {
  return (
    <>
      <PageHeader
        title="Aprovação de Carteira — Visão Cliente"
        description="Como o cliente vê a proposta antes de aprovar"
      />
      <RoutePlaceholder
        icon={Shield}
        message="Página acessada via link assinado enviado por e-mail ao cliente — visualização limpa da proposta com aprovação digital."
        bullets={[
          "Link com expiração e assinatura JWT",
          "Aceite digital com timestamp e IP",
          "MFA opcional via SMS/e-mail",
          "Trilha de auditoria LGPD-compliant",
        ]}
      />
    </>
  );
}
