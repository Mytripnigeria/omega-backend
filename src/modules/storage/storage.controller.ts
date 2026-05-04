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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StorageService } from './storage.service';
import { ListFilesDto } from './dto/list-files.dto';

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

@UseGuards(JwtAuthGuard)
@Controller('files')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

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
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    if (folder && !ALLOWED_FOLDER_PATTERN.test(folder)) {
      throw new BadRequestException('Invalid folder name');
    }
    const uploadedById = req.user?.id ?? req.user?.sub;
    return this.storage.upload(file.buffer, file.mimetype, file.originalname, {
      folder,
      uploadedById,
    });
  }

  @Get()
  list(@Query() query: ListFilesDto) {
    return this.storage.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storage.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.storage.delete(id);
  }
}
