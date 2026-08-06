import { readDocx } from "./read-docx";
import { readPdf } from "./read-pdf";
import { readText } from "./readText";

export async function readDocument(
  extension: string,
  fileResponse: Response
) {
  switch (extension) {
    case "docx":
      return await readDocx(fileResponse);

    case "pdf":
      return await readPdf(fileResponse);

    case "txt":
    case "md":
    case "json":
    case "csv":
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "css":
    case "html":
    case "xml":
    case "py":
    case "java":
    case "c":
    case "cpp":
    case "cs":
    case "sql":
      return await readText(fileResponse);

    default:
      throw new Error(
        `Şimdilik .${extension} dosyalarını okuyamıyorum.`
      );
  }
}