import { Prisma } from '@prisma/client';
import { diffCampos, removerCamposProibidos } from './auditoria.service';

describe('removerCamposProibidos', () => {
  it('remove senha, CPF e tokens em qualquer nível', () => {
    const r = removerCamposProibidos({
      nome: 'Ana',
      senha: 'x',
      cpf: '52998224725',
      nested: { token: 'abc', refreshToken: 'def', ok: 1 },
      lista: [{ password: 'p', valor: 2 }],
    });
    expect(r).toEqual({ nome: 'Ana', nested: { ok: 1 }, lista: [{ valor: 2 }] });
  });
});

describe('diffCampos', () => {
  it('registra só o que mudou, normalizando Decimal e Date', () => {
    const antes = {
      nome: 'Ana',
      patrimonio: new Prisma.Decimal('1000.50'),
      cidade: null,
      atualizado: new Date('2026-01-01T00:00:00Z'),
    };
    const d = diffCampos(antes, { nome: 'Ana', patrimonio: 2000, cidade: 'Recife', inexistente: undefined });
    expect(d).toEqual({
      antes: { patrimonio: 1000.5, cidade: null },
      depois: { patrimonio: 2000, cidade: 'Recife' },
    });
  });

  it('sem mudanças → diff vazio', () => {
    expect(diffCampos({ a: 1 }, { a: 1 })).toEqual({ antes: {}, depois: {} });
  });
});
