declare module "pptx2json" {
  class PPTX2Json {
    toJson(filePath: string): Promise<unknown>;
  }

  export = PPTX2Json;
}