import { BadRequestException, Controller, ForbiddenException, Module, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { AdminGuard, JwtAuthGuard } from '../auth/guards';
import { compressImage } from './compress';
import { rateLimit } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.module';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

/** multer-er type (@types/multer) na thakleo build jeno bhange, tai nijer chhoto type */
type UploadedImage = { buffer: Buffer; originalname: string; mimetype: string };

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

@Controller('upload')
export class UploadController {
  private cloudName = '';
  private apiKey = '';
  private apiSecret = '';

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME') || '';
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY') || '';
    this.apiSecret = config.get<string>('CLOUDINARY_API_SECRET') || '';
    // Cloudinary (free plan, no card) is used when all three variables are set; otherwise images go to local disk.
    console.log(
      this.useCloud ? 'Image uploads: Cloudinary' : 'Image uploads: local disk (set CLOUDINARY_* variables to use Cloudinary)',
    );
  }

  private get useCloud() {
    return !!(this.cloudName && this.apiKey && this.apiSecret);
  }

  /** Login kora jekono user nijer profile picture upload korte pare (max 5MB) */
  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!TYPES[extname(file.originalname).toLowerCase()] || !file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed (jpg, png, webp, gif, avif)'), false);
        }
        cb(null, true);
      },
    }),
  )
  async avatar(@UploadedFile() file: UploadedImage) {
    return this.upload(file); // same compress + upload logic
  }

  /** Shop owner/agent nijer product-er photo upload kore (max 8MB). Cloudinary-te alada folder: farse-ai/shops/<shopId> */
  @Post('shop')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!TYPES[extname(file.originalname).toLowerCase()] || !file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed (jpg, png, webp, gif, avif)'), false);
        }
        cb(null, true);
      },
    }),
  )
  async shopImage(@UploadedFile() file: UploadedImage, @Req() req: any) {
    const m = await this.prisma.shopMember.findFirst({ where: { userId: req.user.id }, select: { shopId: true } });
    if (!m) throw new ForbiddenException('You do not have a shop yet');
    await rateLimit(`shopupload:${m.shopId}`, 100, 3600 * 1000, 'Too many uploads, please try again later.');
    return this.upload(file, `farse-ai/shops/${m.shopId}`);
  }

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // anything bigger than this is rejected; everything below is compressed
      fileFilter: (_req, file, cb) => {
        if (!TYPES[extname(file.originalname).toLowerCase()] || !file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed (jpg, png, webp, gif, avif)'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: UploadedImage, folder = 'farse-ai') {
    if (!file) throw new BadRequestException('No file uploaded');
    // resize + convert to WebP (also keeps us under Cloudinary's 10MB free-plan file limit)
    const { buffer, ext } = await compressImage(file.buffer, extname(file.originalname).toLowerCase());
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`;

    if (this.useCloud) {
      // Signed upload: signature = sha1("folder=...&timestamp=..." + api_secret)
      const timestamp = String(Math.floor(Date.now() / 1000));

      const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${this.apiSecret}`).digest('hex');

      const form = new FormData();
      form.append('file', new Blob([buffer as any], { type: TYPES[ext] }), name);
      form.append('api_key', this.apiKey);
      form.append('timestamp', timestamp);
      form.append('folder', folder);
      form.append('signature', signature);

      let res: Response;
      try {
        res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, { method: 'POST', body: form });
      } catch {
        throw new BadRequestException('Could not reach Cloudinary. Check your internet connection.');
      }
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok || !json.secure_url) {
        throw new BadRequestException(json?.error?.message || 'Image upload failed');
      }
      // serve a web-optimised version (auto format/quality, max 1400px wide)
      return { url: String(json.secure_url).replace('/upload/', '/upload/f_auto,q_auto,w_1400,c_limit/') };
    }

    writeFileSync(join(UPLOAD_DIR, name), buffer);
    const base = (this.config.get<string>('PUBLIC_API_URL') || 'http://localhost:4000').replace(/\/$/, '');
    return { url: `${base}/uploads/${name}` };
  }
}

@Module({ controllers: [UploadController] })
export class UploadModule {}