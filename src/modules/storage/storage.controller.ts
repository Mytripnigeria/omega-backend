import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from './storage.service';
import { ListFilesDto } from './dto/list-files.dto';
import { FileResponseDto } from './dto/file-response.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_PATTERN = /^(image\/(jpe?g|png|webp|gif|svg\+xml)|application\/pdf)$/i;
const ALLOWED_FOLDER_PATTERN = /^[a-z0-9][a-z0-9\-_/]{0,63}$/i;

type MulterFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

interface AuthedRequest {
  user?: { id?: string; sub?: string };
}

@ApiTags('storage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @ApiOperation({
    summary: 'Upload a file',
    description:
      'Uploads an image or PDF (max 5 MB). Pass an optional `folder` query param to organise files. ' +
      'Allowed MIME types: jpeg, png, webp, gif, svg, pdf.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'File to upload (max 5 MB)' },
      },
    },
  })
  @ApiQuery({ name: 'folder', required: false, example: 'products' })
  @ApiCreatedResponse({ type: FileResponseDto })
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME_PATTERN.test(file.mimetype)) {
          cb(new BadRequestException('File type not allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: MulterFile | undefined,
    @Query('folder') folder: string | undefined,
    @Req() req: AuthedRequest,
  ): Promise<FileResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (folder && !ALLOWED_FOLDER_PATTERN.test(folder)) {
      throw new BadRequestException('Invalid folder name');
    }
    const uploadedById = req.user?.id ?? req.user?.sub;
    const saved = await this.storage.upload(file.buffer, file.mimetype, file.originalname, {
      folder,
      uploadedById,
    });
    return FileResponseDto.from(saved);
  }

  @ApiOperation({
    summary: 'List files',
    description: 'Returns a paginated list of uploaded files. Filter by `folder` or `uploadedById`.',
  })
  @ApiOkResponse({
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/FileResponseDto' },
        },
        total: { type: 'number', example: 42 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 20 },
        totalPages: { type: 'number', example: 3 },
      },
    },
  })
  @Get()
  async list(@Query() query: ListFilesDto): Promise<PaginatedResponseDto<FileResponseDto>> {
    const result = await this.storage.list(query);
    const wrapped = new PaginatedResponseDto<FileResponseDto>();
    wrapped.data = FileResponseDto.fromMany(result.data);
    wrapped.total = result.total;
    wrapped.page = result.page;
    wrapped.limit = result.limit;
    wrapped.totalPages = result.totalPages;
    return wrapped;
  }

  @ApiOperation({ summary: 'Get a file', description: 'Returns a single file record by ID.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: FileResponseDto })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<FileResponseDto> {
    return FileResponseDto.from(await this.storage.findById(id));
  }

  @ApiOperation({ summary: 'Delete a file', description: 'Soft-deletes the file record and removes the object from storage.' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse()
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.storage.delete(id);
  }
}
