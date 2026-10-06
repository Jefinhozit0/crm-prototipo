import { extrairParametrosSuitability } from './parametros';
import { perfilDePontuacao, pontuar, QUESTIONARIO } from './questionario';
import { calcularValidade, SuitabilityService } from './suitability.service';

describe('extrairParametrosSuitability', () => {
  it('converte respostas do questionário (ids de opção) em números', () => {
    // Regressão do bug crítico: antes "t2" virava NaN e o motor rejeitava o request
    expect(extrairParametrosSuitability({ horizonte: 'h3', tolerancia_perda: 't2' })).toEqual({
      horizonteAnos: 5,
      toleranciaPerda: 10,
      origem: 'questionario',
    });
  });

  it.each([
    ['h1', 1],
    ['h2', 2],
    ['h3', 5],
    ['h4', 10],
  ])('horizonte %s → %i anos', (opcao, anos) => {
    expect(extrairParametrosSuitability({ horizonte: opcao, tolerancia_perda: 't1' })?.horizonteAnos).toBe(anos);
  });

  it('"não aceito perdas" vira 5% (libera só risco 1), nunca 0', () => {
    expect(extrairParametrosSuitability({ horizonte: 'h1', tolerancia_perda: 't1' })?.toleranciaPerda).toBe(5);
  });

  it('aceita o formato legado numérico do seed', () => {
    expect(extrairParametrosSuitability({ horizonte_anos: 7, tolerancia_perda: 15 })).toEqual({
      horizonteAnos: 7,
      toleranciaPerda: 15,
      origem: 'legado',
    });
  });

  it.each([
    [null],
    [[]],
    [{}],
    [{ horizonte: 'h9', tolerancia_perda: 't2' }],
    [{ horizonte: 'h3' }],
    [{ horizonte_anos: 'sete', tolerancia_perda: 15 }],
    [{ horizonte_anos: 7, tolerancia_perda: 150 }],
    [{ horizonte_anos: Number.NaN, tolerancia_perda: 10 }],
  ])('rejeita respostas incompletas/inválidas: %j', (r) => {
    expect(extrairParametrosSuitability(r)).toBeNull();
  });
});

describe('pontuação do questionário', () => {
  const respostasMin = Object.fromEntries(QUESTIONARIO.map((p) => [p.id, p.opcoes[0].id]));
  const respostasMax = Object.fromEntries(QUESTIONARIO.map((p) => [p.id, p.opcoes.at(-1)!.id]));

  it('pontuação mínima é 0 e máxima é 100', () => {
    expect(pontuar(respostasMin).pontuacao).toBe(0);
    expect(pontuar(respostasMax).pontuacao).toBe(100);
  });

  it('exige todas as perguntas respondidas', () => {
    const { horizonte: _h, ...semHorizonte } = respostasMin;
    expect(() => pontuar(semHorizonte)).toThrow(/horizonte/);
  });

  it('rejeita opção que não pertence à pergunta', () => {
    expect(() => pontuar({ ...respostasMin, horizonte: 't1' })).toThrow(/inválida/);
  });

  it.each([
    [0, 'CONSERVADOR'],
    [25, 'CONSERVADOR'],
    [26, 'MODERADO'],
    [50, 'MODERADO'],
    [51, 'ARROJADO'],
    [75, 'ARROJADO'],
    [76, 'AGRESSIVO'],
    [100, 'AGRESSIVO'],
  ])('pontuação %i → %s (limites das faixas)', (pts, perfil) => {
    expect(perfilDePontuacao(pts)).toBe(perfil);
  });
});

describe('validade da suitability', () => {
  it('vale 24 meses a partir da aplicação', () => {
    const v = calcularValidade(new Date('2026-01-15T12:00:00Z'));
    expect(v.toISOString()).toBe('2028-01-15T12:00:00.000Z');
  });
});

describe('questionário exposto ao front', () => {
  it('não envia a pontuação das opções (evita indução de respostas)', () => {
    const service = new SuitabilityService({} as never, {} as never);
    const q = service.getQuestionario();
    for (const p of q.perguntas) {
      for (const o of p.opcoes) {
        expect(o).not.toHaveProperty('pontos');
      }
    }
  });
});
