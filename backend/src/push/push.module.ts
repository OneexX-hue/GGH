import { Global, Module } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';

// @Global(): начисление баллов происходит в разных модулях (auto-quest,
// hide-and-seek, lpr), каждому нужен доступ к отправке push — проще
// сделать сервис глобальным, чем импортировать PushModule всюду отдельно.
@Global()
@Module({
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushModule {}
