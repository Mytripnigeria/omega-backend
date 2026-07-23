import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { CustomerEntity } from './entities/customer.entity';
import { WalletTransactionEntity } from './entities/wallet-transaction.entity';
import { CustomersService } from './customers.service';
import { PaystackService } from '../paystack/paystack.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { UserJwtPayload } from '../../common/types/jwt-payload.types';

export interface WalletDepositInit {
  reference: string;
  amount: number;
  /** Amount in kobo for the inline popup. */
  amountKobo: number;
  publicKey: string;
  email: string;
}

/**
 * Customer wallet top-up over Paystack. Previously the storefront wallet only
 * showed static bank-transfer instructions and the balance could not move
 * without a merchant crediting it by hand — "wallet deposit not working yet".
 *
 * Flow: initialize() creates a Paystack transaction against the merchant's own
 * keys and returns the access code for the inline popup; verify() confirms the
 * charge with Paystack and credits the wallet exactly once (the reference is
 * the idempotency key, so a double-verify — or a webhook racing the browser —
 * cannot double-credit).
 */
@Injectable()
export class WalletDepositService {
  private readonly logger = new Logger(WalletDepositService.name);

  /** Wallet transaction references carry this prefix so deposits are traceable. */
  private static readonly REF_PREFIX = 'WLT';

  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(WalletTransactionEntity)
    private readonly walletTxRepo: Repository<WalletTransactionEntity>,
    private readonly customersService: CustomersService,
    private readonly paystack: PaystackService,
    private readonly integrations: IntegrationsService,
  ) {}

  private async requireCreds(businessId: string) {
    const cred = await this.integrations.getActiveCredential(
      businessId,
      'paystack',
    );
    if (!cred?.secretKey) {
      throw new BadRequestException(
        'Wallet top-up is unavailable — this store has not set up its Paystack keys yet.',
      );
    }
    return cred;
  }

  async initialize(
    user: UserJwtPayload,
    amount: number,
  ): Promise<WalletDepositInit> {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Enter a valid amount to deposit');
    }

    const customer = await this.customerRepo.findOne({
      where: { id: user.customerId, businessId: user.businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const cred = await this.requireCreds(user.businessId);
    if (!cred.publicKey) {
      throw new BadRequestException(
        'Wallet top-up is unavailable — this store has not set its Paystack public key.',
      );
    }
    const reference = `${WalletDepositService.REF_PREFIX}_${Date.now()}_${randomUUID().slice(0, 8)}`;

    // Do NOT pre-initialize the Paystack transaction: the inline popup
    // (PaystackPop.setup) initializes the reference itself, and a duplicate
    // server-side initialize with the same reference is what forced the old
    // redirect fallback. We only return the reference + public key; verify()
    // confirms the collected amount before crediting.
    return {
      reference,
      amount,
      amountKobo: Math.round(amount * 100),
      publicKey: cred.publicKey,
      email: customer.email ?? `customer-${customer.id}@no-email.local`,
    };
  }

  /**
   * Confirms a top-up with Paystack and credits the wallet. Safe to call more
   * than once for the same reference — the second call returns the already
   * credited balance without moving money.
   */
  async verify(
    user: UserJwtPayload,
    reference: string,
  ): Promise<{ credited: boolean; amount: number; walletBalance: number }> {
    if (!reference?.startsWith(WalletDepositService.REF_PREFIX)) {
      throw new BadRequestException('Not a wallet deposit reference');
    }

    const customer = await this.customerRepo.findOne({
      where: { id: user.customerId, businessId: user.businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    // Idempotency: a wallet tx already carrying this reference means the
    // deposit landed (browser retry, or the webhook beat us to it).
    const existing = await this.walletTxRepo.findOne({ where: { reference } });
    if (existing) {
      return {
        credited: false,
        amount: Number(existing.amount),
        walletBalance: Number(customer.walletBalance),
      };
    }

    const cred = await this.requireCreds(user.businessId);
    const result = await this.paystack.verify(reference, cred.secretKey);
    if (result.status !== 'success') {
      throw new BadRequestException(
        `Payment was not completed (${result.status}).`,
      );
    }

    const amount = Number(result.amount) / 100;
    await this.customersService.creditWallet(
      // Credit is made on the customer's own behalf; the ledger records the
      // customer, and there is no staff actor for a self-service top-up.
      { sub: customer.id, businessId: user.businessId },
      customer.id,
      amount,
      'Wallet top-up',
      reference,
    );

    const refreshed = await this.customerRepo.findOne({
      where: { id: customer.id },
    });
    this.logger.log(
      `Wallet top-up ${reference} credited ${amount} to customer ${customer.id}`,
    );

    return {
      credited: true,
      amount,
      walletBalance: Number(refreshed?.walletBalance ?? 0),
    };
  }
}
