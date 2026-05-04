import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { FileEntity } from './entities/file.entity';
import { ListFilesDto } from './dto/list-files.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlBase: string;
  forcePathStyle: boolean;
}

export interface UploadOptions {
  folder?: string;
  uploadedById?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly config: S3Config;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {
    this.config = this.configService.get<S3Config>('s3', {
      endpoint: '',
      region: 'auto',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      publicUrlBase: '',
      forcePathStyle: true,
    });

    this.client = new S3Client({
      region: this.config.region,
      ...(this.config.endpoint ? { endpoint: this.config.endpoint } : {}),
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: this.config.forcePathStyle,
    });
  }

  async upload(
    buffer: Buffer,
    mimetype: string,
    originalName: string,
    options: UploadOptions = {},
  ): Promise<FileEntity> {
    if (!this.config.bucket) {
      throw new InternalServerErrorException('Storage bucket is not configured');
    }
    if (!this.config.publicUrlBase) {
      throw new InternalServerErrorException('S3_PUBLIC_URL_BASE is not configured');
    }

    const folder = (options.folder ?? 'misc').replace(/^\/+|\/+$/g, '');
    const ext = extname(originalName) || '';
    const key = `${folder}/${randomUUID()}${ext}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );
    } catch (err) {
      this.logger.error(`R2 upload failed: ${(err as Error).message}`, (err as Error).stack);
      throw new InternalServerErrorException('Failed to upload file');
    }

    const file = this.fileRepo.create({
      key,
      url: `${this.config.publicUrlBase}/${key}`,
      originalName,
      mimetype,
      size: buffer.length,
      folder,
      uploadedById: options.uploadedById ?? null,
      metadata: options.metadata ?? null,
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
    await this.deleteObject(file.key);
    await this.fileRepo.softDelete(id);
  }

  async hardDelete(id: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id }, withDeleted: true });
    if (!file) throw new NotFoundException(`File ${id} not found`);
    await this.deleteObject(file.key);
    await this.fileRepo.delete(id);
  }

  private async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
    } catch (err) {
      if (err instanceof NoSuchKey) {
        this.logger.warn(`R2 object ${key} already absent; proceeding with row deletion`);
        return;
      }
      this.logger.error(`R2 delete failed for ${key}: ${(err as Error).message}`, (err as Error).stack);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }
}
