/**
 * SYRAVEN Document Reader
 * Type declarations for pptx2json
 *
 * Enterprise-safe declaration file for PPTX parsing.
 */

declare module "pptx2json" {
  export interface PptxTextRun {
    text?: string;
    value?: string;
    content?: string;

    bold?: boolean;
    italic?: boolean;
    underline?: boolean;

    fontFace?: string;
    fontSize?: number;

    color?: string;

    [key: string]: unknown;
  }

  export interface PptxShape {
    type?: string;
    name?: string;

    text?: string;

    textRuns?: PptxTextRun[];

    x?: number;
    y?: number;
    width?: number;
    height?: number;

    [key: string]: unknown;
  }

  export interface PptxSlide {
    number?: number;
    index?: number;

    title?: string;

    text?: string;

    shapes?: PptxShape[];

    [key: string]: unknown;
  }

  export interface PptxPresentation {
    slides?: PptxSlide[];

    title?: string;

    author?: string;

    subject?: string;

    company?: string;

    createdAt?: string | Date;

    modifiedAt?: string | Date;

    [key: string]: unknown;
  }

  export interface Pptx2JsonOptions {
    includeNotes?: boolean;

    includeImages?: boolean;

    includeCharts?: boolean;

    includeTables?: boolean;

    preserveFormatting?: boolean;

    [key: string]: unknown;
  }

  export type PptxInput =
    | string
    | Buffer
    | Uint8Array
    | ArrayBuffer;

  export interface Pptx2JsonFunction {
    (
      input: PptxInput,
      options?: Pptx2JsonOptions
    ): Promise<PptxPresentation>;

    parse?(
      input: PptxInput,
      options?: Pptx2JsonOptions
    ): Promise<PptxPresentation>;

    convert?(
      input: PptxInput,
      options?: Pptx2JsonOptions
    ): Promise<PptxPresentation>;

    default?: Pptx2JsonFunction;
  }

  const pptx2json: Pptx2JsonFunction;

  export default pptx2json;
}