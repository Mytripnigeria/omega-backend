import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderReviewEntity } from './entities/order-review.entity';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import { CustomerEntity } from '../customers/entities/customer.entity';
import {
  CreateOrderReviewDto,
  OrderReviewFilterDto,
  OrderReviewResponseDto,
  UpdateOrderReviewModerationDto,
} from './dto/order-review.dto';
import { PaginatedResponseDto, paginate } from '../../common/dto/pagination.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(OrderReviewEntity)
    private readonly reviewRepo: Repository<OrderReviewEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
  ) {}

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
      isPublished: false,
    });

    const saved = await this.reviewRepo.save(review);
    return OrderReviewResponseDto.from(saved);
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
    return paginate(data, total, page, limit, OrderReviewResponseDto.from);
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
