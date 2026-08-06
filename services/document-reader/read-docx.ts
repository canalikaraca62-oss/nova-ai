import mammoth from "mammoth";

const MAX_EXTRACTED_TEXT = 100000;

export async function readDocx(
  fileResponse: Response
) {
  const arrayBuffer =
    await fileResponse.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  const result =
    await mammoth.extractRawText({
      buffer,
    });

  return result.value
    .trim()
    .slice(
      0,
      MAX_EXTRACTED_TEXT
    );
}