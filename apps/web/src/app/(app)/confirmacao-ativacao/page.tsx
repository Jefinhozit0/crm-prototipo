import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ConfirmacaoAtivacaoPage() {
  return (
    <>
      <PageHeader
        title="Confirmação de Ativação"
        description="Carteira aprovada e ativada com sucesso"
      />

      <Card>
        <CardContent className="py-16 flex flex-col items-center text-center gap-4 max-w-lg mx-auto">
          <div className="h-14 w-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Carteira ativada</h2>
            <p className="text-sm text-muted-foreground mt-1">
              A alocação foi enviada à mesa de operações. O cliente receberá uma
              confirmação por e-mail nas próximas horas.
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Voltar ao dashboard
            </Link>
            <Link href="/historico" className={cn(buttonVariants({ size: "sm" }))}>
              Ver no histórico
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
