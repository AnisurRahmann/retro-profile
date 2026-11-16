declare module "potrace" {
  interface Options {
    turdSize?: number;
    optTolerance?: number;
    alphaMax?: number;
    threshold?: number;
    optCurve?: boolean;
  }
  export class Potrace {
    constructor(options?: Options);
    loadImage(source: Buffer | string, callback: (error: Error | null) => void): void;
    getPathTag(): string;
  }
  const api: { Potrace: typeof Potrace };
  export default api;
}
