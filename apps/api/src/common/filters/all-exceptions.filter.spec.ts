import { NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function executar(exception: unknown) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const req = { method: 'POST', path: '/api/x', requestId: 'req-123' };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}

const prismaErro = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError('detalhe interno com SQL', {
    code,
    clientVersion: '5.22.0',
    meta,
  });

describe('AllExceptionsFilter', () => {
  beforeAll(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));

  it('HttpException mantém status e mensagem, com requestId', () => {
    const { status, body } = executar(new NotFoundException('Cliente não encontrado'));
    expect(status).toBe(404);
    expect(body).toMatchObject({ statusCode: 404, message: 'Cliente não encontrado', requestId: 'req-123' });
  });

  it('erro desconhecido vira 500 genérico, sem stack nem mensagem interna', () => {
    const { status, body } = executar(new Error('senha do banco: hunter2'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(body).not.toHaveProperty('stack');
    expect(body.requestId).toBe('req-123');
  });

  it('P2002 em cpfHash vira 409 citando "CPF" (nunca o nome da coluna)', () => {
    const { status, body } = executar(prismaErro('P2002', { target: ['cpfHash'] }));
    expect(status).toBe(409);
    expect(body.message).toContain('CPF');
    expect(body.message).not.toContain('cpfHash');
  });

  it('P2025 vira 404 e P2003 vira 409', () => {
    expect(executar(prismaErro('P2025')).status).toBe(404);
    expect(executar(prismaErro('P2003')).status).toBe(409);
  });

  it('banco inacessível vira 503', () => {
    expect(executar(prismaErro('P1001')).status).toBe(503);
    const init = new Prisma.PrismaClientInitializationError("Can't reach database", '5.22.0');
    expect(executar(init).status).toBe(503);
  });

  it('violação de CHECK do Postgres (Prisma "unknown") vira 422 sem detalhes da linha', () => {
    const e = new Prisma.PrismaClientUnknownRequestError(
      'PostgresError { code: "23514", message: "new row for relation \\"clientes\\" violates check constraint", detail: Some("Failing row contains (..., h1:abc..., -1.00)") }',
      { clientVersion: '5.22.0' },
    );
    const { status, body } = executar(e);
    expect(status).toBe(422);
    expect(JSON.stringify(body)).not.toContain('Failing row');
  });

  it('violação de RESTRICT vira 409', () => {
    const e = new Prisma.PrismaClientUnknownRequestError(
      'code: "23001", message: "update or delete on table \\"clientes\\" violates RESTRICT setting"',
      { clientVersion: '5.22.0' },
    );
    expect(executar(e).status).toBe(409);
  });

  it('código Prisma desconhecido não vaza a mensagem do banco', () => {
    const { status, body } = executar(prismaErro('P2010'));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('SQL');
  });
});
