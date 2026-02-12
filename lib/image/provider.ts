export type ProcessedImageResult = {
  bytes: Uint8Array;
  mimeType: string;
};

export interface ImageProcessingProvider {
  process(input: { bytes: Uint8Array; mimeType: string }): Promise<ProcessedImageResult>;
}

export class NoopImageProcessingProvider implements ImageProcessingProvider {
  async process(input: { bytes: Uint8Array; mimeType: string }): Promise<ProcessedImageResult> {
    return { bytes: input.bytes, mimeType: input.mimeType };
  }
}
