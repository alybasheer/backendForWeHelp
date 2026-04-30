import { Test, TestingModule } from '@nestjs/testing';
import { HelpsController } from './helps.controller';
import { HelpsService } from './helps.service';

describe('HelpsController', () => {
  let controller: HelpsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HelpsController],
      providers: [HelpsService],
    }).compile();

    controller = module.get<HelpsController>(HelpsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
