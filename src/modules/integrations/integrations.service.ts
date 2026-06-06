import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IntegrationCredentialEntity,
  IntegrationProvider,
  INTEGRATION_PROVIDERS,
} from './entities/integration-credential.entity';
import {
  IntegrationResponseDto,
  UpdateIntegrationDto,
} from './dto/integration.dto';
import { decryptSecret, encryptSecret } from '../../common/crypto/secret-cipher';

export interface ResolvedProviderCredential {
  provider: IntegrationProvider;
  publicKey: string | null;
  secretKey: string;
  isLive: boolean;
}

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(IntegrationCredentialEntity)
    private readonly repo: Repository<IntegrationCredentialEntity>,
  ) {}

  /** Returns every known provider, merged with any saved credentials (masked). */
  async list(businessId: string): Promise<IntegrationResponseDto[]> {
    const saved = await this.repo.find({ where: { businessId } });
    return INTEGRATION_PROVIDERS.map((provider) => {
      const entity = saved.find((s) => s.provider === provider) ?? null;
      return IntegrationResponseDto.from(
        provider,
        entity,
        decryptSecret(entity?.secretKey),
      );
    });
  }

  /**
   * Returns the decrypted credentials for a provider, scoped to a single
   * business, ONLY when the integration is enabled and has a secret. Returns
   * null otherwise. This is the tenant-safe accessor the payment flow uses so
   * one merchant can never transact with another merchant's keys.
   */
  async getActiveCredential(
    businessId: string,
    provider: IntegrationProvider,
  ): Promise<ResolvedProviderCredential | null> {
    const entity = await this.repo.findOne({
      where: { businessId, provider },
    });
    if (!entity || !entity.isEnabled) return null;
    const secretKey = decryptSecret(entity.secretKey);
    if (!secretKey) return null;
    return {
      provider,
      publicKey: entity.publicKey,
      secretKey,
      isLive: entity.isLive,
    };
  }

  private assertProvider(provider: string): IntegrationProvider {
    if (!INTEGRATION_PROVIDERS.includes(provider as IntegrationProvider)) {
      throw new BadRequestException(`Unknown provider: ${provider}`);
    }
    return provider as IntegrationProvider;
  }

  async upsert(
    businessId: string,
    providerRaw: string,
    dto: UpdateIntegrationDto,
  ): Promise<IntegrationResponseDto> {
    const provider = this.assertProvider(providerRaw);
    let entity = await this.repo.findOne({ where: { businessId, provider } });
    if (!entity) {
      entity = this.repo.create({ businessId, provider });
    }
    if (dto.publicKey !== undefined) entity.publicKey = dto.publicKey || null;
    // Only overwrite the secret when a non-empty value is supplied, so the
    // merchant can toggle/enable without re-entering it. Stored encrypted.
    if (dto.secretKey) entity.secretKey = encryptSecret(dto.secretKey);
    if (dto.isEnabled !== undefined) entity.isEnabled = dto.isEnabled;
    if (dto.isLive !== undefined) entity.isLive = dto.isLive;

    const saved = await this.repo.save(entity);
    return IntegrationResponseDto.from(
      provider,
      saved,
      decryptSecret(saved.secretKey),
    );
  }
}
