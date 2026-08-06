const MAX_EXTRACTED_TEXT = 100000;

export async function readText(
  fileResponse: Response
) {
  const text =
    await fileResponse.text();

  return text
    .trim()
    .slice(
      0,
      MAX_EXTRACTED_TEXT
    );
}