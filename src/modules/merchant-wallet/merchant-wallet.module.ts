import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantWalletEntity } from './entities/merchant-wallet.entity';
import { MerchantWalletTransactionEntity } from './entities/merchant-wallet-transaction.entity';
import { MerchantWalletService } from './merchant-wallet.service';
import { MerchantWalletController } from './merchant-wallet.controller';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MerchantWalletEntity,
      MerchantWalletTransactionEntity,
    ]),
  ],
  controllers: [MerchantWalletController],
  providers: [MerchantWalletService],
  exports: [MerchantWalletService],
})
export class MerchantWalletModule {}
