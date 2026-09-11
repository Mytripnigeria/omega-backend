import { Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  PutInput,
  PutResult,
  StorageDriver,
  StorageDriverName,
} from './storage-driver.interface';

export interface S3DriverConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrlBase: string;
  forcePathStyle: boolean;
}

/** S3-compatible object storage (Cloudflare R2, AWS S3, MinIO…). */
export class S3Driver implements StorageDriver {
  readonly name: StorageDriverName = 'r2';
  private readonly logger = new Logger(S3Driver.name);
  private readonly client: S3Client;

  constructor(private readonly config: S3DriverConfig) {
    this.client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
    });
  }

  missingConfig(): string[] {
    const missing: string[] = [];
    if (!this.config.bucket) missing.push('S3_BUCKET');
    if (!this.config.accessKeyId) missing.push('S3_ACCESS_KEY_ID');
    if (!this.config.secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');
    if (!this.config.publicUrlBase) missing.push('S3_PUBLIC_URL_BASE');
    return missing;
  }

  async put(input: PutInput): Promise<PutResult> {
    const ext = extname(input.originalName) || '';
    const key = `${input.folder}/${randomUUID()}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimetype,
      }),
    );

    return { key, url: `${this.config.publicUrlBase}/${key}` };
  }

  async remove(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
    } catch (err) {
      if (err instanceof NoSuchKey) {
        this.logger.warn(`Object ${key} already absent; nothing to delete`);
        return;
      }
      throw err;
    }
  }
}
