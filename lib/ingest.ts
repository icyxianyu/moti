import { embed } from "./embedder";
import { upsert } from "./vector-store";

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 100;
const MIN_CHUNK_LENGTH = 50;

export function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > MIN_CHUNK_LENGTH) chunks.push(chunk);
    if (end === text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

export async function ingestText(
  authorId: string,
  collectionId: string,
  filename: string,
  rawText: string
): Promise<number> {
  const chunks = splitIntoChunks(rawText);
  let added = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkId = `${collectionId}__${i}`;
    const vector = await embed(chunks[i]);
    const inserted = await upsert(authorId, vector, {
      id: chunkId,
      text: chunks[i],
      source: filename,
      chunkIndex: i,
    });
    if (inserted) added++;
  }

  return chunks.length;
}
