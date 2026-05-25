import { Mail, MessageSquare, Phone, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { interacoesRecentes } from "@/lib/mock-data";
import { fmt } from "@/lib/format";

const tipoIcon = {
  email: Mail,
  ligacao: Phone,
  reuniao: Users,
  whatsapp: MessageSquare,
  tarefa: MessageSquare,
};

export default function HistoricoPage() {
  return (
    <>
      <PageHeader
        title="Histórico de Interações"
        description="Linha do tempo unificada de e-mails, ligações, reuniões e mensagens"
      />

      <Card>
        <CardHeader>
          <CardTitle>Últimas interações</CardTitle>
          <CardDescription>Ordenadas da mais recente para a mais antiga</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative border-l border-border ml-2 space-y-6">
            {interacoesRecentes.map((i) => {
              const Icon = tipoIcon[i.tipo];
              return (
                <li key={i.id} className="ml-6">
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                  </span>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{i.clienteNome}</p>
                    <Badge variant="outline" className="capitalize text-xs">
                      {i.tipo}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {fmt.dateLong(i.data)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground/80">{i.assunto}</p>
                  <p className="text-sm text-muted-foreground mt-1">{i.resumo}</p>
                  <p className="text-xs text-muted-foreground mt-2">por {i.autor}</p>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
