import { ReviewsService } from './reviews.service';
import { mockRepo } from '../../testing/mocks';

/**
 * Round-11 feedback, Storefront → Order Details:
 *  - "Review does not upload and submit images attached to reviews"
 *
 * Two causes sat behind that: uploads silently failed (R2 was not enabled on
 * the Cloudflare account, and the error was swallowed), and the photos were too
 * big to survive the JSON body limit in the first place. A lost photo must
 * still never cost the merchant the rating and comment.
 */
describe('ReviewsService.storeReviewImages', () => {
  const jpegDataUrl = (bytes: number) =>
    `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString('base64')}`;

  const build = () => {
    const storage = {
      upload: jest.fn(async (_b: Buffer, _m: string, name: string) => ({
        id: `file-${name}`,
        url: `https://res.cloudinary.com/omega/image/upload/f_auto,q_auto/reviews/${name}`,
      })),
    };
    const service = new ReviewsService(
      mockRepo([]) as never,
      mockRepo([]) as never,
      mockRepo([]) as never,
      storage as never,
    );
    // Private by design: this is the unit the feedback is about.
    const store = (customerId: string, images?: string[]) =>
      (service as never as {
        storeReviewImages: (
          c: string,
          i?: string[],
        ) => Promise<{ urls: string[] | null; failed: number }>;
      }).storeReviewImages(customerId, images);
    return { store, storage };
  };

  it('uploads every attached photo and returns their URLs', async () => {
    const { store, storage } = build();

    const res = await store('cust-1', [jpegDataUrl(1024), jpegDataUrl(2048)]);

    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(res.urls).toHaveLength(2);
    expect(res.failed).toBe(0);
    expect(res.urls?.[0]).toContain('https://');
  });

  it('files them under the reviews folder against the customer', async () => {
    const { store, storage } = build();

    await store('cust-1', [jpegDataUrl(1024)]);

    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/jpeg',
      'review-1.jpeg',
      { folder: 'reviews', uploadedById: 'cust-1' },
    );
  });

  it('decodes the base64 payload to the real bytes', async () => {
    const { store, storage } = build();

    await store('cust-1', [jpegDataUrl(4096)]);

    const [buffer] = storage.upload.mock.calls[0];
    expect(buffer).toHaveLength(4096);
  });

  it('reports a failed upload instead of silently dropping the photo', async () => {
    const { store, storage } = build();
    storage.upload.mockRejectedValue(new Error('storage unavailable') as never);

    const res = await store('cust-1', [jpegDataUrl(1024)]);

    expect(res.urls).toBeNull();
    expect(res.failed).toBe(1);
  });

  it('keeps the photos that did upload when one fails', async () => {
    const { store, storage } = build();
    storage.upload
      .mockResolvedValueOnce({ id: 'f1', url: 'https://cdn/one.jpg' } as never)
      .mockRejectedValueOnce(new Error('storage unavailable') as never);

    const res = await store('cust-1', [jpegDataUrl(1024), jpegDataUrl(1024)]);

    expect(res.urls).toEqual(['https://cdn/one.jpg']);
    expect(res.failed).toBe(1);
  });

  it('rejects a photo over the per-image ceiling', async () => {
    const { store, storage } = build();

    const res = await store('cust-1', [jpegDataUrl(3 * 1024 * 1024)]);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(res.urls).toBeNull();
    expect(res.failed).toBe(1);
  });

  it('accepts a photo just under the ceiling', async () => {
    const { store, storage } = build();

    const res = await store('cust-1', [jpegDataUrl(2 * 1024 * 1024 - 1)]);

    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(res.failed).toBe(0);
  });

  it('skips anything that is not an image data URL', async () => {
    const { store, storage } = build();

    const res = await store('cust-1', [
      'https://example.com/not-a-data-url.jpg',
      'data:application/pdf;base64,AAAA',
      jpegDataUrl(1024),
    ]);

    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(res.urls).toHaveLength(1);
    expect(res.failed).toBe(2);
  });

  it('caps a submission at four photos', async () => {
    const { store, storage } = build();

    const res = await store('cust-1', Array.from({ length: 7 }, () => jpegDataUrl(512)));

    expect(storage.upload).toHaveBeenCalledTimes(4);
    expect(res.urls).toHaveLength(4);
  });

  it('returns nothing to store when no photo is attached', async () => {
    const { store, storage } = build();

    const res = await store('cust-1', undefined);

    expect(storage.upload).not.toHaveBeenCalled();
    expect(res).toEqual({ urls: null, failed: 0 });
  });

  it('accepts png and webp as well as jpeg', async () => {
    const { store, storage } = build();
    const png = `data:image/png;base64,${Buffer.alloc(256, 1).toString('base64')}`;
    const webp = `data:image/webp;base64,${Buffer.alloc(256, 1).toString('base64')}`;

    const res = await store('cust-1', [png, webp]);

    expect(res.urls).toHaveLength(2);
    expect(storage.upload.mock.calls.map((c) => c[1])).toEqual([
      'image/png',
      'image/webp',
    ]);
  });
});
