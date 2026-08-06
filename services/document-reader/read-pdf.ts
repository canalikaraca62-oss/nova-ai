import PDFParser from "pdf2json";

const MAX_EXTRACTED_TEXT = 100000;

export async function readPdf(
  fileResponse: Response
) {
  const arrayBuffer =
    await fileResponse.arrayBuffer();

  const buffer = Buffer.from(arrayBuffer);

  return new Promise<string>(
    (resolve, reject) => {
      const pdfParser =
        new PDFParser();

      pdfParser.on(
        "pdfParser_dataError",
        (err) => {
          reject(err);
        }
      );

      pdfParser.on(
        "pdfParser_dataReady",
        (pdfData: any) => {
          try {
            let text = "";

            for (const page of pdfData.Pages) {
              for (const item of page.Texts) {
  if (!item.R || !Array.isArray(item.R)) continue;

  for (const run of item.R) {
    if (!run.T) continue;

    let value = String(run.T);

    try {
      value = decodeURIComponent(value);
    } catch {
      // decode edilemezse olduğu gibi bırak
    }

    text += value + " ";
  }
}

              text += "\n";
            }

            resolve(
              text
                .trim()
                .slice(
                  0,
                  MAX_EXTRACTED_TEXT
                )
            );
          } catch (e) {
            reject(e);
          }
        }
      );

      pdfParser.parseBuffer(buffer);
    }
  );
}