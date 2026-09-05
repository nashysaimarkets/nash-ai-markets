declare module "sharp" {
  type SharpInput = string | Buffer;
  type BufferResult = { data: Buffer; info: { width: number; height: number; channels: number } };
  interface SharpInstance {
    clone(): SharpInstance;
    metadata(): Promise<{ width?: number; height?: number }>;
    removeAlpha(): SharpInstance;
    extract(options: { left: number; top: number; width: number; height: number }): SharpInstance;
    resize(options: { width: number }): SharpInstance;
    grayscale(): SharpInstance;
    normalize(): SharpInstance;
    negate(): SharpInstance;
    threshold(value: number): SharpInstance;
    composite(items: Array<{ input: Buffer; top: number; left: number }>): SharpInstance;
    toFile(path: string): Promise<unknown>;
    raw(): SharpInstance;
    png(): SharpInstance;
    toBuffer(options: { resolveWithObject: true }): Promise<BufferResult>;
    toBuffer(): Promise<Buffer>;
  }
  export default function sharp(input: SharpInput): SharpInstance;
}
