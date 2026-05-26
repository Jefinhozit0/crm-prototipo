import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CategoriaProduto, PerfilInvestidor } from '@prisma/client';

// ============================================================
// Contrato com o microsserviço Python (apps/ai-engine)
// ============================================================

export type AiEngineRequest = {
  cliente: {
    id: string;
    nome: string;
    perfil: PerfilInvestidor;
    patrimonio: number;
  };
  suitability: {
    perfilCalculado: PerfilInvestidor;
    horizonteAnos: number;
    toleranciaPerda: number;
  };
  posicoes: Array<{
    produtoId: string;
    categoria: CategoriaProduto;
    valor: number;
  }>;
  catalog: Array<{
    id: string;
    nome: string;
    emissor: string;
    categoria: CategoriaProduto;
    rentabilidadeAno: number;
    risco: number;
    perfilMinimo: PerfilInvestidor;
    liquidez: string;
    taxaAdmin: number | null;
    ativo: boolean;
  }>;
  topN: number;
};

export type AiEngineRecomendacao = {
  produtoId: string;
  produtoNome: string;
  score: number;
  justificativa: string;
  fatores: Record<string, number>;
  pesos: Record<string, number>;
  contribs: Array<{ fator: string; contrib: number; frase: string }>;
};

export type AiEngineResponse = {
  recomendacoes: AiEngineRecomendacao[];
  engineVersion: string;
};

// ============================================================
// Service
// ============================================================

@Injectable()
export class AiEngineService {
  private readonly logger = new Logger(AiEngineService.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('AI_ENGINE_URL') ?? 'http://localhost:8000';
  }

  async recommend(req: AiEngineRequest): Promise<AiEngineResponse> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'erro desconhecido';
      this.logger.error(`Falha ao conectar no AI engine (${this.baseUrl}): ${msg}`);
      throw new ServiceUnavailableException(
        `Motor de IA indisponível (${this.baseUrl}). Verifique se o serviço Python está rodando.`,
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(
        `AI engine respondeu ${res.status}: ${body.slice(0, 500)}`,
      );
      throw new ServiceUnavailableException(
        `Motor de IA respondeu ${res.status}`,
      );
    }

    return (await res.json()) as AiEngineResponse;
  }

  /** Liveness check — usado em /health do NestJS no futuro */
  async health(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/health`);
      return r.ok;
    } catch {
      return false;
    }
  }
}
