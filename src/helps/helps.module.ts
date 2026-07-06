import { Module } from '@nestjs/common';
import { HelpsController } from './helps.controller';
import { HelpsService } from './helps.service';

@Module({
  controllers: [HelpsController],
  providers: [HelpsService]
})
export class HelpsModule {}
