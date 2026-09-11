import { Logger } from '@nestjs/common';
import {
  v2 as cloudinary,
  UploadApiErrorResponse,
  UploadApiResponse,
} from 'cloudinary';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import {
  PutInput,
  PutResult,
  StorageDriver,
  StorageDriverName,
} from './storage-driver.interface';

export interface CloudinaryDriverConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /**
   * Raw transformation spliced into delivery URLs for raster images, e.g.
   * `f_auto,q_auto` — Cloudinary then serves WebP/AVIF at an auto-chosen
   * quality, which is where most of the bandwidth saving comes from. Empty
   * string delivers the original bytes untouched.
   */
  deliveryTransform: string;
}

type CloudinaryResourceType = 'image' | 'raw';

/**
 * Cloudinary. Unlike S3 there is no bucket and no public URL base: the cloud
 * name is the namespace and Cloudinary's CDN is the origin. `files.key` holds
 * the Cloudinary `public_id`, and `files.metadata.resourceType` records which
 * delivery type it was stored under, because deletion needs it.
 */
export class CloudinaryDriver implements StorageDriver {
  readonly name: StorageDriverName = 'cloudinary';
  private readonly logger = new Logger(CloudinaryDriver.name);

  constructor(private readonly config: CloudinaryDriverConfig) {
    if (config.cloudName && config.apiKey && config.apiSecret) {
      cloudinary.config({
        cloud_name: config.cloudName,
        api_key: config.apiKey,
        api_secret: config.apiSecret,
        secure: true,
        // Keeps the `?_a=` SDK analytics param out of URLs we persist.
        analytics: false,
      });
    }
  }

  missingConfig(): string[] {
    const missing: string[] = [];
    if (!this.config.cloudName) missing.push('CLOUDINARY_CLOUD_NAME');
    if (!this.config.apiKey) missing.push('CLOUDINARY_API_KEY');
    if (!this.config.apiSecret) missing.push('CLOUDINARY_API_SECRET');
    return missing;
  }

  async put(input: PutInput): Promise<PutResult> {
    const resourceType = CloudinaryDriver.resourceTypeFor(input.mimetype);
    const ext = extname(input.originalName) || '';
    // Images are addressed without an extension (Cloudinary derives it from
    // the delivery format); raw files keep theirs so the URL downloads sanely.
    const publicId =
      resourceType === 'image'
        ? `${input.folder}/${randomUUID()}`
        : `${input.folder}/${randomUUID()}${ext}`;

    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: resourceType,
          overwrite: false,
          use_filename: false,
          unique_filename: false,
        },
        (err: UploadApiErrorResponse | undefined, res: UploadApiResponse | undefined) => {
          if (err) {
            reject(new Error(err.message ?? 'Cloudinary upload failed'));
            return;
          }
          if (!res) {
            reject(new Error('Cloudinary upload returned no result'));
            return;
          }
          resolve(res);
        },
      );
      stream.end(input.buffer);
    });

    return {
      key: result.public_id,
      url: this.deliveryUrl(result, resourceType, input.mimetype),
      metadata: { resourceType, version: result.version },
    };
  }

  async remove(
    key: string,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    const resourceType =
      metadata?.resourceType === 'raw' ? 'raw' : ('image' as CloudinaryResourceType);
    const res = (await cloudinary.uploader.destroy(key, {
      resource_type: resourceType,
      invalidate: true,
    })) as { result?: string };

    if (res?.result === 'not found') {
      this.logger.warn(`Asset ${key} already absent; nothing to delete`);
      return;
    }
    if (res?.result !== 'ok') {
      throw new Error(`Cloudinary delete returned "${res?.result ?? 'unknown'}"`);
    }
  }

  private deliveryUrl(
    result: UploadApiResponse,
    resourceType: CloudinaryResourceType,
    mimetype: string,
  ): string {
    // SVG is served as-is: f_auto would rasterise a logo that should stay
    // vector. Raw files have no transformations at all.
    const transformable =
      resourceType === 'image' &&
      !/svg/i.test(mimetype) &&
      this.config.deliveryTransform.length > 0;

    if (!transformable) return result.secure_url;

    return cloudinary.url(result.public_id, {
      resource_type: resourceType,
      type: result.type,
      version: result.version,
      format: result.format,
      secure: true,
      raw_transformation: this.config.deliveryTransform,
    });
  }

  private static resourceTypeFor(mimetype: string): CloudinaryResourceType {
    return mimetype.startsWith('image/') ? 'image' : 'raw';
  }
}
