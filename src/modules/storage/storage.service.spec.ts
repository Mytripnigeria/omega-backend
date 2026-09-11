import { InternalServerErrorException } from '@nestjs/common';
import { StorageService } from './storage.service';
import { mockRepo } from '../../testing/mocks';

/**
 * File storage moved from Cloudflare R2 to Cloudinary: R2 answers every call
 * with "Please enable R2 through the Cloudflare Dashboard" — which is what made
 * review photos and product images fail to upload.
 *
 * Two things have to keep holding. Uploads must go to the configured backend
 * and fail loudly when it is not configured; and a file written by the
 * *previous* backend must still be deletable, because R2's credentials are all
 * still present and valid-looking while every call to it fails.
 */
describe('StorageService', () => {
  const cloudinaryConfig = {
    cloudName: 'omega',
    apiKey: 'key',
    apiSecret: 'secret',
    deliveryTransform: 'f_auto,q_auto',
  };
  const s3Config = {
    endpoint: 'https://acct.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'omega',
    accessKeyId: 'ak',
    secretAccessKey: 'sk',
    publicUrlBase: 'https://pub-xyz.r2.dev',
    forcePathStyle: true,
  };

  const build = (over: Record<string, any> = {}) => {
    const conf: Record<string, any> = {
      'storage.driver': 'cloudinary',
      cloudinary: cloudinaryConfig,
      s3: s3Config,
      ...over,
    };
    const configService = {
      get: (key: string, dflt: unknown) =>
        key in conf ? conf[key] : (dflt as unknown),
    };
    const fileRepo = mockRepo<Record<string, any>>([]);
    const service = new StorageService(configService as never, fileRepo as never);

    const drivers = (service as never as {
      drivers: Record<string, { put: jest.Mock; remove: jest.Mock }>;
    }).drivers;
    // Stub the network edges of both drivers; the routing between them is what
    // these tests are about. Individual tests override as needed.
    for (const name of ['cloudinary', 'r2']) {
      drivers[name].put = jest.fn(async () => ({ key: 'k', url: 'https://cdn/k' }));
      drivers[name].remove = jest.fn(async () => undefined);
    }
    return { service, fileRepo, drivers };
  };

  describe('upload', () => {
    it('writes through the configured driver and records which one', async () => {
      const { service, drivers, fileRepo } = build();
      drivers.cloudinary.put = jest.fn(async () => ({
        key: 'products/abc',
        url: 'https://res.cloudinary.com/omega/image/upload/f_auto,q_auto/v1/products/abc.jpg',
        metadata: { resourceType: 'image', version: 1 },
      }));

      const file = await service.upload(
        Buffer.alloc(16),
        'image/jpeg',
        'jollof.jpg',
        { folder: 'products', uploadedById: 'admin-1' },
      );

      expect(file.key).toBe('products/abc');
      expect(file.url).toContain('res.cloudinary.com');
      expect(file.metadata).toMatchObject({
        driver: 'cloudinary',
        resourceType: 'image',
      });
      expect(fileRepo.rows).toHaveLength(1);
      expect(drivers.r2.put).not.toHaveBeenCalled();
    });

    it('keeps caller metadata alongside the driver stamp', async () => {
      const { service, drivers } = build();
      drivers.cloudinary.put = jest.fn(async () => ({
        key: 'k',
        url: 'https://cdn/x',
        metadata: { resourceType: 'image' },
      }));

      const file = await service.upload(Buffer.alloc(4), 'image/png', 'x.png', {
        metadata: { source: 'hub' },
      });

      expect(file.metadata).toMatchObject({ source: 'hub', driver: 'cloudinary' });
    });

    it('normalises the folder and defaults it', async () => {
      const { service, drivers } = build();
      drivers.cloudinary.put = jest.fn(async () => ({ key: 'k', url: 'u' }));

      await service.upload(Buffer.alloc(4), 'image/png', 'x.png', {
        folder: '/reviews/',
      });
      await service.upload(Buffer.alloc(4), 'image/png', 'y.png', {});

      expect(drivers.cloudinary.put.mock.calls[0][0].folder).toBe('reviews');
      expect(drivers.cloudinary.put.mock.calls[1][0].folder).toBe('misc');
    });

    it('fails loudly and names the missing env when the driver is unconfigured', async () => {
      const { service } = build({
        cloudinary: { cloudName: '', apiKey: '', apiSecret: '', deliveryTransform: '' },
      });

      await expect(
        service.upload(Buffer.alloc(4), 'image/png', 'x.png', {}),
      ).rejects.toThrow(/CLOUDINARY_CLOUD_NAME/);
    });

    it('does not persist a row when the upload fails', async () => {
      const { service, drivers, fileRepo } = build();
      drivers.cloudinary.put = jest.fn(async () => {
        throw new Error('cloudinary down');
      });

      await expect(
        service.upload(Buffer.alloc(4), 'image/png', 'x.png', {}),
      ).rejects.toThrow(InternalServerErrorException);
      expect(fileRepo.rows).toHaveLength(0);
    });

    it('falls back to the S3 driver when cloudinary is not selected', async () => {
      const { service, drivers } = build({ 'storage.driver': 's3' });
      drivers.r2.put = jest.fn(async () => ({ key: 'products/x.jpg', url: 'https://pub-xyz.r2.dev/products/x.jpg' }));

      const file = await service.upload(Buffer.alloc(4), 'image/jpeg', 'x.jpg', {});

      expect(file.metadata).toMatchObject({ driver: 'r2' });
      expect(drivers.r2.put).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    const seed = (fileRepo: ReturnType<typeof mockRepo>, driver: string) => {
      fileRepo.rows.push({
        id: 'file-1',
        key: 'products/old.jpg',
        url: 'https://example/old.jpg',
        metadata: driver ? { driver } : null,
      });
    };

    it('removes the object through the driver that wrote it', async () => {
      const { service, fileRepo, drivers } = build();
      seed(fileRepo, 'cloudinary');
      drivers.cloudinary.remove = jest.fn(async () => undefined);

      await service.delete('file-1');

      expect(drivers.cloudinary.remove).toHaveBeenCalledWith(
        'products/old.jpg',
        { driver: 'cloudinary' },
      );
      expect(fileRepo.rows[0].deletedAt).toBeTruthy();
    });

    it('still deletes the row when the previous backend rejects the call', async () => {
      // The regression this guards: R2's credentials are all present, so a
      // "is it configured?" check passes, the call throws NotEntitled, and the
      // row never went — leaving every pre-migration file undeletable forever.
      const { service, fileRepo, drivers } = build();
      seed(fileRepo, 'r2');
      drivers.r2.remove = jest.fn(async () => {
        throw new Error('Please enable R2 through the Cloudflare Dashboard.');
      });

      await expect(service.delete('file-1')).resolves.toBeUndefined();
      expect(fileRepo.rows[0].deletedAt).toBeTruthy();
    });

    it('treats a file with no recorded driver as an R2-era file', async () => {
      const { service, fileRepo, drivers } = build();
      seed(fileRepo, '');
      drivers.r2.remove = jest.fn(async () => undefined);

      await service.delete('file-1');

      expect(drivers.r2.remove).toHaveBeenCalled();
      expect(drivers.cloudinary.remove).not.toHaveBeenCalled();
    });

    it('still deletes the row when the previous backend is no longer configured', async () => {
      const { service, fileRepo } = build({
        s3: { ...s3Config, bucket: '', accessKeyId: '', secretAccessKey: '', publicUrlBase: '' },
      });
      seed(fileRepo, 'r2');

      await expect(service.delete('file-1')).resolves.toBeUndefined();
      expect(fileRepo.rows[0].deletedAt).toBeTruthy();
    });

    it('raises when the ACTIVE backend fails, because that is a real outage', async () => {
      const { service, fileRepo, drivers } = build();
      seed(fileRepo, 'cloudinary');
      drivers.cloudinary.remove = jest.fn(async () => {
        throw new Error('cloudinary down');
      });

      await expect(service.delete('file-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(fileRepo.rows[0].deletedAt).toBeFalsy();
    });
  });
});
