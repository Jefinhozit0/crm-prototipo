import { Module } from '@nestjs/common';
import { ClientesModule } from '../clientes/clientes.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [ClientesModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
