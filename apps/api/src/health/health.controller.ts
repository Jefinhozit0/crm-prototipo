import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiEngineService } from '../recomendacoes/ai-engine.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEngine: AiEngineService,
  ) {}

  /** Liveness — público pra load balancer/uptime monitor. Não toca dependências. */
  @Public()
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Readiness — público, sem detalhes: 200 se o banco responde, 503 se não.
   * O AI Engine não entra aqui: sem ele a API continua servindo o CRM, só a
   * geração de recomendações fica indisponível (degradação parcial).
   */
  @Public()
  @Get('ready')
  async ready() {
    if (!(await this.bancoOk())) {
      throw new ServiceUnavailableException('Serviço indisponível');
    }
    return { status: 'ok' };
  }

  /** Detalhado (banco + AI Engine) — só ADMIN, pra não expor topologia */
  @Get()
  @Roles('ADMIN')
  async check() {
    const inicio = Date.now();
    const banco = await this.bancoOk();
    const latenciaBancoMs = Date.now() - inicio;
    const ai = await this.aiEngine.health();
    return {
      status: banco ? (ai.ok ? 'ok' : 'degradado') : 'indisponivel',
      timestamp: new Date().toISOString(),
      dependencias: {
        banco: { ok: banco, latenciaMs: latenciaBancoMs },
        aiEngine: ai,
      },
    };
  }

  private async bancoOk(): Promise<boolean> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
