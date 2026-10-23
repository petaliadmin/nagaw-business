import { Module } from '@nestjs/common';
import { ResponsibilitiesController } from './responsibilities.controller.js';
import { ResponsibilitiesService } from './responsibilities.service.js';

@Module({
  controllers: [ResponsibilitiesController],
  providers: [ResponsibilitiesService],
})
export class ResponsibilitiesModule {}
