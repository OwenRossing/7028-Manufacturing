import { env } from "@/lib/env";

export type OnshapeCredentials = {
  accessKey: string;
  secretKey: string;
  baseUrl: string;
};

export interface OnshapeCredentialsProvider {
  getCredentials(): Promise<OnshapeCredentials>;
}

export class EnvOnshapeCredentialsProvider implements OnshapeCredentialsProvider {
  async getCredentials(): Promise<OnshapeCredentials> {
    const accessKey = env.ONSHAPE_ACCESS_KEY?.trim();
    const secretKey = env.ONSHAPE_SECRET_KEY?.trim();
    const baseUrl = (env.ONSHAPE_BASE_URL ?? "https://cad.onshape.com").trim();
    if (!accessKey || !secretKey) {
      throw new Error("Onshape credentials are not configured.");
    }
    return { accessKey, secretKey, baseUrl };
  }
}
