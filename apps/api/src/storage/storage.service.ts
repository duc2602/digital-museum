import { Injectable, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly bucket = process.env.MINIO_BUCKET ?? 'museum-assets';
  private readonly client = this.createClient(
    process.env.MINIO_ENDPOINT ?? 'localhost',
    process.env.MINIO_PORT ?? '9000',
  );
  private readonly publicClient = this.createClient(
    process.env.MINIO_PUBLIC_ENDPOINT ?? 'localhost',
    process.env.MINIO_PUBLIC_PORT ?? '9000',
  );

  async onModuleInit(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async checkConnection(): Promise<void> {
    await this.client.bucketExists(this.bucket);
  }

  async createUploadUrl(
    objectName: string,
    expirySeconds = 900,
  ): Promise<string> {
    if (!objectName.trim()) {
      throw new Error('objectName must not be empty');
    }
    if (
      !Number.isInteger(expirySeconds) ||
      expirySeconds < 1 ||
      expirySeconds > 604800
    ) {
      throw new Error('expirySeconds must be between 1 and 604800');
    }

    return this.publicClient.presignedPutObject(
      this.bucket,
      objectName,
      expirySeconds,
    );
  }

  private createClient(endPoint: string, rawPort: string): Client {
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('MinIO port must be a valid TCP port');
    }

    return new Client({
      endPoint,
      port,
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'museum-minio',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'museum-minio-password',
      region: process.env.MINIO_REGION ?? 'us-east-1',
    });
  }
}
