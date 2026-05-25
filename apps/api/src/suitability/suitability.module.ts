import { Module } from '@nestjs/common';
import { SuitabilityController } from './suitability.controller';
import { SuitabilityService } from './suitability.service';

@Module({
  controllers: [SuitabilityController],
  providers: [SuitabilityService],
})
export class SuitabilityModule {}
