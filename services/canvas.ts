/**
 * SYRAVEN Canvas Service
 *
 * Enterprise-grade canvas abstraction for:
 * - 2D rendering
 * - High-DPI support
 * - Drawing primitives
 * - Image rendering
 * - Text rendering
 * - Exporting canvas data
 * - Browser-safe runtime checks
 *
 * Designed for strict TypeScript environments.
 */

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

export type CanvasExportFormat =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasLineOptions {
  color?: string;
  width?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
}

export interface CanvasTextOptions {
  color?: string;
  font?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
}

export interface CanvasImageOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface CanvasExportOptions {
  format?: CanvasExportFormat;
  quality?: number;
}

export interface CanvasSnapshot {
  dataUrl: string;
  width: number;
  height: number;
}

export interface CanvasConfig {
  width?: number;
  height?: number;
  pixelRatio?: number;
  alpha?: boolean;
  desynchronized?: boolean;
}

/* -------------------------------------------------------------------------- */
/*                               TYPE GUARDS                                  */
/* -------------------------------------------------------------------------- */

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined"
  );
}

function assertBrowser(): void {
  if (!isBrowser()) {
    throw new Error(
      "Canvas operations are only available in a browser environment."
    );
  }
}

function assertFiniteNumber(
  value: number,
  name: string
): void {
  if (!Number.isFinite(value)) {
    throw new Error(
      `${name} must be a finite number.`
    );
  }
}

function assertPositiveNumber(
  value: number,
  name: string
): void {
  assertFiniteNumber(value, name);

  if (value <= 0) {
    throw new Error(
      `${name} must be greater than zero.`
    );
  }
}

function clamp(
  value: number,
  min: number,
  max: number
): number {
  return Math.min(
    Math.max(value, min),
    max
  );
}

/* -------------------------------------------------------------------------- */
/*                              CANVAS SERVICE                                */
/* -------------------------------------------------------------------------- */

export class CanvasService {
  private canvas: HTMLCanvasElement | null = null;

  private context: CanvasRenderingContext2D | null = null;

  private logicalWidth = 0;

  private logicalHeight = 0;

  private pixelRatio = 1;

  /* ------------------------------------------------------------------------ */
  /*                              INITIALIZATION                              */
  /* ------------------------------------------------------------------------ */

  create(
    config: CanvasConfig = {}
  ): HTMLCanvasElement {
    assertBrowser();

    const canvas =
      document.createElement("canvas");

    this.attach(
      canvas,
      config
    );

    return canvas;
  }

  attach(
    canvas: HTMLCanvasElement,
    config: CanvasConfig = {}
  ): CanvasRenderingContext2D {
    assertBrowser();

    if (!canvas) {
      throw new Error(
        "A valid canvas element is required."
      );
    }

    const width =
      config.width ??
      canvas.width ??
      300;

    const height =
      config.height ??
      canvas.height ??
      150;

    assertPositiveNumber(
      width,
      "Canvas width"
    );

    assertPositiveNumber(
      height,
      "Canvas height"
    );

    const ratio =
      config.pixelRatio ??
      this.getDevicePixelRatio();

    assertPositiveNumber(
      ratio,
      "Pixel ratio"
    );

    const context =
      canvas.getContext(
        "2d",
        {
          alpha:
            config.alpha ??
            true,

          desynchronized:
            config.desynchronized ??
            false,
        }
      );

    if (!context) {
      throw new Error(
        "Unable to create CanvasRenderingContext2D."
      );
    }

    this.canvas = canvas;

    this.context = context;

    this.logicalWidth = width;

    this.logicalHeight = height;

    this.pixelRatio = ratio;

    this.resize(
      width,
      height,
      ratio
    );

    return context;
  }

  detach(): void {
    this.canvas = null;

    this.context = null;

    this.logicalWidth = 0;

    this.logicalHeight = 0;

    this.pixelRatio = 1;
  }

  /* ------------------------------------------------------------------------ */
  /*                               ACCESSORS                                  */
  /* ------------------------------------------------------------------------ */

  getCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      throw new Error(
        "Canvas has not been initialized."
      );
    }

    return this.canvas;
  }

  getContext(): CanvasRenderingContext2D {
    if (!this.context) {
      throw new Error(
        "Canvas context has not been initialized."
      );
    }

    return this.context;
  }

  getSize(): CanvasSize {
    return {
      width:
        this.logicalWidth,

      height:
        this.logicalHeight,
    };
  }

  getPixelRatio(): number {
    return this.pixelRatio;
  }

  /* ------------------------------------------------------------------------ */
  /*                                  RESIZE                                  */
  /* ------------------------------------------------------------------------ */

  resize(
    width: number,
    height: number,
    pixelRatio =
      this.getDevicePixelRatio()
  ): void {
    const canvas =
      this.getCanvas();

    const context =
      this.getContext();

    assertPositiveNumber(
      width,
      "Canvas width"
    );

    assertPositiveNumber(
      height,
      "Canvas height"
    );

    assertPositiveNumber(
      pixelRatio,
      "Pixel ratio"
    );

    this.logicalWidth = width;

    this.logicalHeight = height;

    this.pixelRatio = pixelRatio;

    canvas.width =
      Math.round(
        width * pixelRatio
      );

    canvas.height =
      Math.round(
        height * pixelRatio
      );

    canvas.style.width =
      `${width}px`;

    canvas.style.height =
      `${height}px`;

    context.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      0,
      0
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  CLEAR                                   */
  /* ------------------------------------------------------------------------ */

  clear(
    rect?: CanvasRect
  ): void {
    const context =
      this.getContext();

    if (rect) {
      assertFiniteNumber(
        rect.x,
        "Rect x"
      );

      assertFiniteNumber(
        rect.y,
        "Rect y"
      );

      assertFiniteNumber(
        rect.width,
        "Rect width"
      );

      assertFiniteNumber(
        rect.height,
        "Rect height"
      );

      context.clearRect(
        rect.x,
        rect.y,
        rect.width,
        rect.height
      );

      return;
    }

    context.clearRect(
      0,
      0,
      this.logicalWidth,
      this.logicalHeight
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              STATE CONTROL                               */
  /* ------------------------------------------------------------------------ */

  save(): void {
    this.getContext().save();
  }

  restore(): void {
    this.getContext().restore();
  }

  resetTransform(): void {
    const context =
      this.getContext();

    context.setTransform(
      this.pixelRatio,
      0,
      0,
      this.pixelRatio,
      0,
      0
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                RECTANGLES                                */
  /* ------------------------------------------------------------------------ */

  fillRect(
    rect: CanvasRect,
    color: string
  ): void {
    const context =
      this.getContext();

    context.fillStyle = color;

    context.fillRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  }

  strokeRect(
    rect: CanvasRect,
    color = "#000000",
    lineWidth = 1
  ): void {
    const context =
      this.getContext();

    context.strokeStyle = color;

    context.lineWidth =
      lineWidth;

    context.strokeRect(
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  LINES                                   */
  /* ------------------------------------------------------------------------ */

  drawLine(
    start: CanvasPoint,
    end: CanvasPoint,
    options: CanvasLineOptions = {}
  ): void {
    const context =
      this.getContext();

    context.beginPath();

    context.moveTo(
      start.x,
      start.y
    );

    context.lineTo(
      end.x,
      end.y
    );

    context.strokeStyle =
      options.color ??
      "#000000";

    context.lineWidth =
      options.width ??
      1;

    context.lineCap =
      options.lineCap ??
      "round";

    context.lineJoin =
      options.lineJoin ??
      "round";

    context.stroke();
  }

  /* ------------------------------------------------------------------------ */
  /*                                 CIRCLES                                  */
  /* ------------------------------------------------------------------------ */

  fillCircle(
    center: CanvasPoint,
    radius: number,
    color: string
  ): void {
    assertPositiveNumber(
      radius,
      "Circle radius"
    );

    const context =
      this.getContext();

    context.beginPath();

    context.arc(
      center.x,
      center.y,
      radius,
      0,
      Math.PI * 2
    );

    context.fillStyle = color;

    context.fill();
  }

  strokeCircle(
    center: CanvasPoint,
    radius: number,
    color = "#000000",
    lineWidth = 1
  ): void {
    assertPositiveNumber(
      radius,
      "Circle radius"
    );

    const context =
      this.getContext();

    context.beginPath();

    context.arc(
      center.x,
      center.y,
      radius,
      0,
      Math.PI * 2
    );

    context.strokeStyle = color;

    context.lineWidth =
      lineWidth;

    context.stroke();
  }

  /* ------------------------------------------------------------------------ */
  /*                                   TEXT                                   */
  /* ------------------------------------------------------------------------ */

  drawText(
    text: string,
    position: CanvasPoint,
    options: CanvasTextOptions = {}
  ): void {
    const context =
      this.getContext();

    context.fillStyle =
      options.color ??
      "#000000";

    context.font =
      options.font ??
      "16px sans-serif";

    context.textAlign =
      options.align ??
      "left";

    context.textBaseline =
      options.baseline ??
      "alphabetic";

    if (
      typeof options.maxWidth ===
      "number"
    ) {
      context.fillText(
        text,
        position.x,
        position.y,
        options.maxWidth
      );

      return;
    }

    context.fillText(
      text,
      position.x,
      position.y
    );
  }

  measureText(
    text: string,
    font?: string
  ): TextMetrics {
    const context =
      this.getContext();

    if (font) {
      context.save();

      context.font = font;

      const metrics =
        context.measureText(text);

      context.restore();

      return metrics;
    }

    return context.measureText(
      text
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                  IMAGES                                  */
  /* ------------------------------------------------------------------------ */

  drawImage(
    image: CanvasImageSource,
    options: CanvasImageOptions
  ): void {
    const context =
      this.getContext();

    if (
      typeof options.width ===
        "number" &&
      typeof options.height ===
        "number"
    ) {
      context.drawImage(
        image,
        options.x,
        options.y,
        options.width,
        options.height
      );

      return;
    }

    context.drawImage(
      image,
      options.x,
      options.y
    );
  }

  async loadImage(
    source: string
  ): Promise<HTMLImageElement> {
    assertBrowser();

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const image =
          new Image();

        image.onload =
          () => resolve(image);

        image.onerror =
          () =>
            reject(
              new Error(
                `Failed to load image: ${source}`
              )
            );

        image.src = source;
      }
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                              IMAGE DATA                                  */
  /* ------------------------------------------------------------------------ */

  getImageData(
    rect?: CanvasRect
  ): ImageData {
    const context =
      this.getContext();

    if (rect) {
      return context.getImageData(
        rect.x,
        rect.y,
        rect.width,
        rect.height
      );
    }

    return context.getImageData(
      0,
      0,
      this.logicalWidth,
      this.logicalHeight
    );
  }

  putImageData(
    imageData: ImageData,
    position: CanvasPoint
  ): void {
    this.getContext().putImageData(
      imageData,
      position.x,
      position.y
    );
  }

  /* ------------------------------------------------------------------------ */
  /*                                EXPORT                                    */
  /* ------------------------------------------------------------------------ */

  toDataURL(
    options: CanvasExportOptions = {}
  ): string {
    const canvas =
      this.getCanvas();

    const format =
      options.format ??
      "image/png";

    const quality =
      options.quality === undefined
        ? undefined
        : clamp(
            options.quality,
            0,
            1
          );

    if (
      quality === undefined
    ) {
      return canvas.toDataURL(
        format
      );
    }

    return canvas.toDataURL(
      format,
      quality
    );
  }

  toBlob(
    options: CanvasExportOptions = {}
  ): Promise<Blob> {
    const canvas =
      this.getCanvas();

    const format =
      options.format ??
      "image/png";

    const quality =
      options.quality === undefined
        ? undefined
        : clamp(
            options.quality,
            0,
            1
          );

    return new Promise(
      (
        resolve,
        reject
      ) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  "Failed to export canvas as Blob."
                )
              );

              return;
            }

            resolve(blob);
          },
          format,
          quality
        );
      }
    );
  }

  snapshot(
    options: CanvasExportOptions = {}
  ): CanvasSnapshot {
    return {
      dataUrl:
        this.toDataURL(options),

      width:
        this.logicalWidth,

      height:
        this.logicalHeight,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                               UTILITIES                                  */
  /* ------------------------------------------------------------------------ */

  private getDevicePixelRatio(): number {
    if (
      typeof window === "undefined"
    ) {
      return 1;
    }

    const ratio =
      window.devicePixelRatio;

    if (
      !Number.isFinite(ratio) ||
      ratio <= 0
    ) {
      return 1;
    }

    return ratio;
  }
}

/* -------------------------------------------------------------------------- */
/*                               SINGLETON                                    */
/* -------------------------------------------------------------------------- */

export const canvasService =
  new CanvasService();

/* -------------------------------------------------------------------------- */
/*                            CONVENIENCE EXPORTS                             */
/* -------------------------------------------------------------------------- */

export function createCanvas(
  config: CanvasConfig = {}
): HTMLCanvasElement {
  return canvasService.create(
    config
  );
}

export function attachCanvas(
  canvas: HTMLCanvasElement,
  config: CanvasConfig = {}
): CanvasRenderingContext2D {
  return canvasService.attach(
    canvas,
    config
  );
}

export function detachCanvas(): void {
  canvasService.detach();
}

export function getCanvas(): HTMLCanvasElement {
  return canvasService.getCanvas();
}

export function getCanvasContext(): CanvasRenderingContext2D {
  return canvasService.getContext();
}

export function resizeCanvas(
  width: number,
  height: number,
  pixelRatio?: number
): void {
  canvasService.resize(
    width,
    height,
    pixelRatio
  );
}

export function clearCanvas(
  rect?: CanvasRect
): void {
  canvasService.clear(
    rect
  );
}

export function exportCanvasDataUrl(
  options: CanvasExportOptions = {}
): string {
  return canvasService.toDataURL(
    options
  );
}

export function exportCanvasBlob(
  options: CanvasExportOptions = {}
): Promise<Blob> {
  return canvasService.toBlob(
    options
  );
}

export default canvasService;