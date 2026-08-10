import { createRequire } from "module";
import os from "os";
import path from "path";
import fs from "fs/promises";

const require = createRequire(import.meta.url);

const PPTX2Json = require("pptx2json");

export async function readPptx(
  response: Response
): Promise<string> {
  const buffer = await response.arrayBuffer();

  const tempPath = path.join(
    os.tmpdir(),
    `qelvora-${Date.now()}.pptx`
  );

  try {
    await fs.writeFile(
      tempPath,
      Buffer.from(buffer)
    );

    const pptx2json = new PPTX2Json();

    const json =
      await pptx2json.toJson(tempPath);

    return JSON.stringify(json);
  } finally {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Geçici dosya zaten silinmişse sorun değil.
    }
  }
}