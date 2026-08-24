declare module "sharp" {
  type Metadata = { width?: number; height?: number };
  type CreateInput = { create: { width: number; height: number; channels: number; background: string } };
  type ResizeOptions = { width: number; withoutEnlargement?: boolean };
  type ExtractOptions = { left: number; top: number; width: number; height: number };
  type PngOptions = { compressionLevel?: number };

  interface SharpImage {
    metadata(): Promise<Metadata>;
    extract(options: ExtractOptions): SharpImage;
    resize(options: ResizeOptions): SharpImage;
    png(options?: PngOptions): SharpImage;
    toBuffer(): Promise<Buffer>;
  }

  function sharp(input: Buffer | CreateInput, options?: { failOn?: "error" | "warning" | "none" | "truncated" }): SharpImage;
  export default sharp;
}
