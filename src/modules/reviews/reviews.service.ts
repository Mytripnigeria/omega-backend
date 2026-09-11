import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderReviewEntity } from './entities/order-review.entity';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import { StorageService } from '../storage/storage.service';
import {
  CreateOrderReviewDto,
  OrderReviewFilterDto,
  OrderReviewResponseDto,
  UpdateOrderReviewModerationDto,
} from './dto/order-review.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(OrderReviewEntity)
    private readonly reviewRepo: Repository<OrderReviewEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    private readonly storage: StorageService,
  ) {}

  /** Largest photo we accept per review image, before base64 expansion. */
  /**
   * Per-photo ceiling after base64 decoding.
   *
   * Deliberately well under the 5 MB JSON body limit in `main.ts`: the images
   * arrive base64-encoded inside the request body (which inflates them by
   * about a third), so a 5 MB photo could never have reached this check in the
   * first place — the request died at the body parser. The storefront now
   * downscales before sending, and this is the backstop.
   */
  private static readonly MAX_REVIEW_IMAGE_BYTES = 2 * 1024 * 1024;

  /**
   * Stores the customer's attached photos and returns their public URLs.
   *
   * Customers post images as `data:` URLs rather than going through the
   * admin-only `/files` API. Anything unparseable, oversized or not an image is
   * skipped rather than failing the whole review — a lost photo must never cost
   * the merchant the rating and comment.
   */
  private async storeReviewImages(
    customerId: string,
    images: string[] | undefined,
  ): Promise<{ urls: string[] | null; failed: number }> {
    if (!images?.length) return { urls: null, failed: 0 };

    const urls: string[] = [];
    for (const [index, raw] of images.slice(0, 4).entries()) {
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(
        (raw ?? '').trim(),
      );
      if (!match) continue;
      const [, mimetype, payload] = match;
      let buffer: Buffer;
      try {
        buffer = Buffer.from(payload, 'base64');
      } catch {
        continue;
      }
      if (
        buffer.length === 0 ||
        buffer.length > ReviewsService.MAX_REVIEW_IMAGE_BYTES
      ) {
        continue;
      }
      try {
        const extension = mimetype.split('/')[1]?.split('+')[0] ?? 'jpg';
        const file = await this.storage.upload(
          buffer,
          mimetype,
          `review-${index + 1}.${extension}`,
          { folder: 'reviews', uploadedById: customerId },
        );
        urls.push(file.url);
      } catch (err) {
        this.logger.warn(
          `Review image upload failed: ${(err as Error).message}`,
        );
      }
    }
    return {
      urls: urls.length > 0 ? urls : null,
      failed: images.slice(0, 4).length - urls.length,
    };
  }

  async submit(
    businessId: string,
    customerId: string,
    orderId: string,
    dto: CreateOrderReviewDto,
  ): Promise<OrderReviewResponseDto> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, businessId, customerId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.status !== OrderStatus.COMPLETED &&
      order.status !== OrderStatus.SERVED
    ) {
      throw new BadRequestException(
        'You can only review an order after it has been completed',
      );
    }

    const existing = await this.reviewRepo.findOne({ where: { orderId } });
    if (existing) throw new ConflictException('Order already reviewed');

    const customer = await this.customerRepo.findOne({ where: { id: customerId } });

    // A photo that could not be stored must not cost the customer their
    // rating, but it must not be silent either: object storage being
    // misconfigured looked exactly like the feature not working, because the
    // review came back 201 with no photos and nothing said why.
    const storedImages = await this.storeReviewImages(customerId, dto.images);
    if (storedImages.failed > 0) {
      this.logger.error(
        `${storedImages.failed} review photo(s) could not be stored for order ` +
          `${orderId}. Check the object-storage configuration (S3/R2).`,
      );
    }

    const review = this.reviewRepo.create({
      businessId,
      storeId: order.storeId,
      orderId,
      customerId,
      customerName: customer
        ? `${customer.firstName} ${customer.lastName}`.trim()
        : 'Customer',
      rating: dto.rating,
      comment: dto.comment ?? null,
      imageUrls: storedImages.urls,
      isPublished: false,
    });

    const saved = await this.reviewRepo.save(review);
    return {
      ...OrderReviewResponseDto.from(saved),
      imagesFailed: storedImages.failed,
    };
  }

  async findForOrder(
    customerId: string,
    orderId: string,
  ): Promise<OrderReviewResponseDto | null> {
    const review = await this.reviewRepo.findOne({
      where: { orderId, customerId },
    });
    return review ? OrderReviewResponseDto.from(review) : null;
  }

  async list(
    businessId: string,
    filter: OrderReviewFilterDto,
  ): Promise<PaginatedResponseDto<OrderReviewResponseDto>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .where('r.businessId = :businessId', { businessId })
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.createdAt', 'DESC');

    if (filter.storeId)
      qb.andWhere('r.storeId = :storeId', { storeId: filter.storeId });
    if (filter.isPublished !== undefined)
      qb.andWhere('r.isPublished = :p', { p: filter.isPublished });
    if (filter.rating)
      qb.andWhere('r.rating = :rating', { rating: filter.rating });

    const [data, total] = await qb.getManyAndCount();

    // Attach the human-facing order number so the merchant Reviews page can
    // show "which order this review is affiliated to" without a UUID.
    const orderIds = Array.from(new Set(data.map((r) => r.orderId)));
    const orderNumbers = new Map<string, number>();
    if (orderIds.length > 0) {
      const orders = await this.orderRepo.find({
        where: orderIds.map((id) => ({ id })),
        select: { id: true, orderNumber: true },
      });
      for (const o of orders) orderNumbers.set(o.id, o.orderNumber);
    }
    const enriched = data.map((r) =>
      Object.assign(r, { orderNumber: orderNumbers.get(r.orderId) ?? null }),
    );
    return paginate(enriched, total, page, limit, OrderReviewResponseDto.from);
  }

  async listPublic(
    businessId: string,
    storeId?: string,
  ): Promise<OrderReviewResponseDto[]> {
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .where('r.businessId = :businessId', { businessId })
      .andWhere('r.isPublished = true')
      .orderBy('r.createdAt', 'DESC')
      .take(50);
    if (storeId) qb.andWhere('r.storeId = :storeId', { storeId });
    const rows = await qb.getMany();
    return rows.map(OrderReviewResponseDto.from);
  }

  async moderate(
    businessId: string,
    id: string,
    dto: UpdateOrderReviewModerationDto,
  ): Promise<OrderReviewResponseDto> {
    const review = await this.reviewRepo.findOne({
      where: { id, businessId },
    });
    if (!review) throw new NotFoundException('Review not found');
    Object.assign(review, dto);
    return OrderReviewResponseDto.from(await this.reviewRepo.save(review));
  }
}
