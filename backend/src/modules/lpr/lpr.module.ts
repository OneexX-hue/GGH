import { Module } from '@nestjs/common';
import { LprService } from './lpr.service';
import { LprController } from './lpr.controller';
import { LPR_ADAPTER } from './adapters/lpr-adapter.interface';
import { PlateRecognizerAdapter } from './adapters/plate-recognizer.adapter';
import { ModulesRegistryModule } from '../../modules-registry/modules-registry.module';
import { MediaModule } from '../../media/media.module';

@Module({
  imports: [ModulesRegistryModule, MediaModule],
  providers: [LprService, { provide: LPR_ADAPTER, useClass: PlateRecognizerAdapter }],
  controllers: [LprController],
})
export class LprModule {}
