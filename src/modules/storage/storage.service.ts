import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { FileEntity } from './entities/file.entity';
import { ListFilesDto } from './dto/list-files.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  StorageDriver,
  StorageDriverName,
} from './drivers/storage-driver.interface';
import { S3Driver, S3DriverConfig } from './drivers/s3.driver';
import {
  CloudinaryDriver,
  CloudinaryDriverConfig,
} from './drivers/cloudinary.driver';

export interface UploadOptions {
  folder?: string;
  uploadedById?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  /** Every driver, keyed by name, so old objects stay deletable after a switch. */
  private readonly drivers: Record<StorageDriverName, StorageDriver>;
  private readonly driver: StorageDriver;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {
    const s3Config = this.configService.get<S3DriverConfig>('s3', {
      endpoint: '',
      region: 'auto',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      publicUrlBase: '',
      forcePathStyle: true,
    });
    const cloudinaryConfig = this.configService.get<CloudinaryDriverConfig>(
      'cloudinary',
      { cloudName: '', apiKey: '', apiSecret: '', deliveryTransform: '' },
    );

    this.drivers = {
      r2: new S3Driver(s3Config),
      cloudinary: new CloudinaryDriver(cloudinaryConfig),
    };

    const configured = this.configService.get<string>('storage.driver', 's3');
    this.driver =
      configured === 'cloudinary' ? this.drivers.cloudinary : this.drivers.r2;
  }

  onModuleInit(): void {
    const missing = this.driver.missingConfig();
    if (missing.length > 0) {
      this.logger.warn(
        `Storage driver "${this.driver.name}" is NOT configured — uploads will fail. Missing env: ${missing.join(', ')}`,
      );
      return;
    }
    this.logger.log(`Storage driver: ${this.driver.name}`);
  }

  async upload(
    buffer: Buffer,
    mimetype: string,
    originalName: string,
    options: UploadOptions = {},
  ): Promise<FileEntity> {
    const missing = this.driver.missingConfig();
    if (missing.length > 0) {
      throw new InternalServerErrorException(
        `Storage is not configured for driver "${this.driver.name}": missing ${missing.join(', ')}. Ask your admin to set these env vars.`,
      );
    }

    const folder = (options.folder ?? 'misc').replace(/^\/+|\/+$/g, '');

    let stored: Awaited<ReturnType<StorageDriver['put']>>;
    try {
      stored = await this.driver.put({
        buffer,
        mimetype,
        originalName,
        folder,
      });
    } catch (err) {
      this.logger.error(
        `${this.driver.name} upload failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw new InternalServerErrorException('Failed to upload file');
    }

    const file = this.fileRepo.create({
      key: stored.key,
      url: stored.url,
      originalName,
      mimetype,
      size: buffer.length,
      folder,
      uploadedById: options.uploadedById ?? null,
      metadata: {
        ...(options.metadata ?? {}),
        ...(stored.metadata ?? {}),
        driver: this.driver.name,
      },
    } as Partial<FileEntity>);

    return this.fileRepo.save(file as FileEntity);
  }

  async findById(id: string): Promise<FileEntity> {
    const file = await this.fileRepo.findOne({ where: { id } });
    if (!file) throw new NotFoundException(`File ${id} not found`);
    return file;
  }

  async findByKey(key: string): Promise<FileEntity | null> {
    return this.fileRepo.findOne({ where: { key } });
  }

  async findManyByIds(ids: string[]): Promise<FileEntity[]> {
    if (ids.length === 0) return [];
    return this.fileRepo
      .createQueryBuilder('f')
      .where('f.id IN (:...ids)', { ids })
      .getMany();
  }

  async list(query: ListFilesDto): Promise<PaginatedResponseDto<FileEntity>> {
    const { page = 1, limit = 20, folder, uploadedById } = query;
    const where: FindOptionsWhere<FileEntity> = {};
    if (folder) where.folder = folder;
    if (uploadedById) where.uploadedById = uploadedById;

    const [data, total] = await this.fileRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return PaginatedResponseDto.of(data, total, page, limit);
  }

  async delete(id: string): Promise<void> {
    const file = await this.findById(id);
    await this.deleteObject(file);
    await this.fileRepo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    const file = await this.fileRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!file) throw new NotFoundException(`File ${id} not found`);
    await this.deleteObject(file);
    await this.fileRepo.delete(id);
  }

  private async deleteObject(file: FileEntity): Promise<void> {
    // Rows written before the driver was recorded all came from S3/R2.
    const recorded = file.metadata?.driver;
    const name: StorageDriverName = recorded === 'cloudinary' ? 'cloudinary' : 'r2';
    const driver = this.drivers[name];
    const isActive = name === this.driver.name;

    // A file on a backend we have migrated away from must still be deletable.
    // The row is the record the app cares about; the object is best-effort
    // cleanup, and a decommissioned backend can no longer perform it — R2, for
    // instance, answers every call with "Please enable R2 through the
    // Cloudflare Dashboard" while its credentials still look perfectly valid.
    // Orphaning those bytes beats making the file undeletable forever.
    const orphan = (reason: string): void => {
      this.logger.error(
        `File ${file.id} (${file.key}) lives on "${name}", which is no longer in use: ${reason}. Deleting the row and leaving the object behind.`,
      );
    };

    const missing = driver.missingConfig();
    if (missing.length > 0) {
      const reason = `missing ${missing.join(', ')}`;
      if (isActive) {
        throw new InternalServerErrorException(
          `Storage is not configured for driver "${name}": ${reason}.`,
        );
      }
      orphan(reason);
      return;
    }

    try {
      await driver.remove(file.key, file.metadata);
    } catch (err) {
      const message = (err as Error).message;
      if (!isActive) {
        orphan(message);
        return;
      }
      this.logger.error(
        `${name} delete failed for ${file.key}: ${message}`,
        (err as Error).stack,
      );
      throw new InternalServerErrorException('Failed to delete file');
    }
  }
}
