import { Module } from '@nestjs/common';
import { RecomendacoesController } from './recomendacoes.controller';
import { RecomendacoesService } from './recomendacoes.service';

@Module({
  controllers: [RecomendacoesController],
  providers: [RecomendacoesService],
})
export class RecomendacoesModule {}
