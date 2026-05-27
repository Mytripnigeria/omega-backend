import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';
import { PushService } from './push.service';
import { PushNotificationsController } from './push-notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscriptionEntity])],
  controllers: [PushNotificationsController],
  providers: [PushService],
  exports: [PushService],
})
export class PushNotificationsModule {}
