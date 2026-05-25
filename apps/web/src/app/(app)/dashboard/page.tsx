import { CalendarDays, DollarSign, Sparkles, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  kpisDashboard,
  aumSerie,
  captacaoSerie,
  distribuicaoPerfil,
  interacoesRecentes,
} from "@/lib/mock-data";
import { fmt } from "@/lib/format";
import { DashboardCharts } from "./_components/dashboard-charts";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Visão geral da operação — AUM, pipeline e interações"
        actions={
          <>
            <Button variant="outline" size="sm">
              <CalendarDays className="h-4 w-4" />
              Últimos 30 dias
            </Button>
            <Button size="sm">
              <Sparkles className="h-4 w-4" />
              Gerar recomendação
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="AUM total"
          value={fmt.brl(kpisDashboard.aumTotal)}
          delta={kpisDashboard.aumDelta}
          icon={DollarSign}
          tone="blue"
          hint="Assets under management"
        />
        <KpiCard
          label="Clientes ativos"
          value={String(kpisDashboard.clientesAtivos)}
          delta={kpisDashboard.clientesDelta}
          icon={Users}
          tone="emerald"
        />
        <KpiCard
          label="Leads abertos"
          value={String(kpisDashboard.leadsAbertos)}
          delta={kpisDashboard.leadsDelta}
          icon={TrendingUp}
          tone="amber"
        />
        <KpiCard
          label="Conversão 30d"
          value={fmt.pct(kpisDashboard.conversao30d)}
          delta={kpisDashboard.conversaoDelta}
          icon={Sparkles}
          tone="violet"
        />
      </div>

      <DashboardCharts
        aumSerie={aumSerie}
        captacaoSerie={captacaoSerie}
        distribuicaoPerfil={distribuicaoPerfil}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Interações recentes</CardTitle>
            <CardDescription>Últimos contatos com clientes</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interacoesRecentes.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.clienteNome}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {i.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.assunto}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {fmt.date(i.data)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tarefas do dia</CardTitle>
            <CardDescription>Agenda do assessor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { hora: "09:30", titulo: "Call Mariana Andrade — revisão Q2" },
              { hora: "11:00", titulo: "Follow-up Helena Sá (proposta)" },
              { hora: "14:00", titulo: "Reunião Felipe Okabe — BDR S&P 500" },
              { hora: "16:30", titulo: "Aprovação carteira — Bianca Lemos" },
            ].map((t) => (
              <div
                key={t.hora}
                className="flex items-start gap-3 rounded-md border border-border p-3"
              >
                <div className="text-xs font-mono text-muted-foreground pt-0.5 w-12 shrink-0">
                  {t.hora}
                </div>
                <p className="text-sm">{t.titulo}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
