export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'mrjollof_db',
    synchronize: process.env.DB_SYNC === 'true',
    // Auto-run pending migrations on boot. Opt-in; default off so a deploy
    // applies schema changes via an explicit `npm run migration:run` step.
    migrationsRun: process.env.DB_MIGRATIONS_RUN === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    staffSecret: process.env.JWT_STAFF_SECRET ?? '',
    staffExpiresIn: process.env.JWT_STAFF_EXPIRES_IN ?? '12h',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  storage: {
    // Which backend serves uploads: 'cloudinary' or 's3' (Cloudflare R2, AWS
    // S3, MinIO). Defaults to whichever one is actually configured, so a
    // deployment only has to set the credentials, not also remember a switch.
    driver:
      process.env.STORAGE_DRIVER ??
      (process.env.CLOUDINARY_CLOUD_NAME ? 'cloudinary' : 's3'),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
    // Auto format + auto quality. Derived versions are cached by Cloudinary,
    // so this costs one transformation per unique variant, not per request,
    // and cuts delivered bytes (and therefore credits) substantially.
    deliveryTransform: process.env.CLOUDINARY_DELIVERY_TRANSFORM ?? 'f_auto,q_auto',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    region: process.env.S3_REGION ?? 'auto',
    bucket: process.env.S3_BUCKET ?? '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    publicUrlBase: (process.env.S3_PUBLIC_URL_BASE ?? '').replace(/\/$/, ''),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? '',
    baseUrl: process.env.PAYSTACK_BASE_URL ?? 'https://api.paystack.co',
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY ?? '',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
  },
  domains: {
    // Hostname merchants point their custom domain's CNAME at. This is the
    // public storefront ingress and is environment-specific — override per
    // deployment so the DNS instructions returned on domain creation point at
    // the right host. Defaults to the production storefront ingress.
    cnameTarget: process.env.DOMAIN_CNAME_TARGET ?? 'app.mrjollof.com',
  },
});
