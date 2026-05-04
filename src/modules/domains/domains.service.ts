import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { promises as dns } from 'dns';
import { randomBytes } from 'crypto';
import { DomainEntity } from './entities/domain.entity';
import { CreateDomainDto } from './dto/create-domain.dto';

@Injectable()
export class DomainsService {
  constructor(
    @InjectRepository(DomainEntity)
    private readonly repo: Repository<DomainEntity>,
    private readonly dataSource: DataSource,
  ) {}

  list(businessId: string): Promise<DomainEntity[]> {
    return this.repo.find({
      where: { businessId },
      order: { isPrimary: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(businessId: string, id: string): Promise<DomainEntity> {
    const domain = await this.repo.findOne({ where: { id, businessId } });
    if (!domain) throw new NotFoundException(`Domain ${id} not found`);
    return domain;
  }

  async create(businessId: string, dto: CreateDomainDto): Promise<DomainEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DomainEntity);
      if (dto.isPrimary) {
        await repo.update({ businessId, isPrimary: true }, { isPrimary: false });
      }
      const verificationToken = `mrjollof-verify-${randomBytes(16).toString('hex')}`;
      const domain = repo.create({
        ...dto,
        businessId,
        verificationToken,
        dnsRecords: [
          {
            type: 'TXT',
            name: `_mrjollof-challenge.${dto.hostname}`,
            value: verificationToken,
          },
          {
            type: 'CNAME',
            name: dto.hostname,
            value: 'app.mrjollof.com',
          },
        ],
      });
      return repo.save(domain);
    });
  }

  async setPrimary(businessId: string, id: string): Promise<DomainEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DomainEntity);
      const domain = await repo.findOne({ where: { id, businessId } });
      if (!domain) throw new NotFoundException(`Domain ${id} not found`);
      if (!domain.verifiedAt) {
        throw new BadRequestException('Verify the domain before setting it as primary');
      }
      await repo.update({ businessId, isPrimary: true }, { isPrimary: false });
      domain.isPrimary = true;
      return repo.save(domain);
    });
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.findOne(businessId, id);
    await this.repo.softDelete(id);
  }

  async verify(businessId: string, id: string): Promise<DomainEntity> {
    const domain = await this.findOne(businessId, id);
    let txtRecords: string[][] = [];
    try {
      txtRecords = await dns.resolveTxt(`_mrjollof-challenge.${domain.hostname}`);
    } catch (err) {
      throw new BadRequestException(
        `DNS lookup failed: ${(err as Error).message}. Add the TXT record and try again.`,
      );
    }
    const flat = txtRecords.flat();
    if (!flat.includes(domain.verificationToken)) {
      throw new BadRequestException(
        'Verification TXT record not found. Add the record exactly as shown in dnsRecords.',
      );
    }
    domain.verifiedAt = new Date();
    domain.sslStatus = 'pending';
    return this.repo.save(domain);
  }
}
