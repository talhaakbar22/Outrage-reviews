import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

let s3Client: S3Client | undefined;

function getS3Client() {
  if (!s3Client) {
    const endpoint = env.s3Endpoint();

    s3Client = new S3Client({
      region: env.s3Region(),
      endpoint: endpoint ?? undefined,
      credentials: {
        accessKeyId: env.s3AccessKeyId(),
        secretAccessKey: env.s3SecretAccessKey(),
      },
      forcePathStyle: env.s3ForcePathStyle(),
    });
  }

  return s3Client;
}

export function buildPublicObjectUrl(key: string) {
  return `${env.s3PublicBaseUrl()}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function createPresignedPutUrl(input: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket(),
    Key: input.key,
    ContentType: input.contentType,
    ContentLength: input.contentLength,
  });

  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: input.expiresInSeconds ?? env.mediaPresignExpiresSeconds(),
  });

  return {
    uploadUrl,
    headers: {
      "Content-Type": input.contentType,
      "Content-Length": String(input.contentLength),
    },
    expiresInSeconds: input.expiresInSeconds ?? env.mediaPresignExpiresSeconds(),
  };
}

export async function headObject(key: string) {
  const response = await getS3Client().send(
    new HeadObjectCommand({
      Bucket: env.s3Bucket(),
      Key: key,
    }),
  );

  return {
    contentLength: response.ContentLength ?? 0,
    contentType: response.ContentType ?? null,
  };
}

export async function getObjectBuffer(key: string) {
  const response = await getS3Client().send(
    new GetObjectCommand({
      Bucket: env.s3Bucket(),
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Object not found: ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function putObjectBuffer(input: {
  key: string;
  body: Buffer;
  contentType: string;
}) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.s3Bucket(),
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

export async function deleteObject(key: string) {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: env.s3Bucket(),
      Key: key,
    }),
  );
}
