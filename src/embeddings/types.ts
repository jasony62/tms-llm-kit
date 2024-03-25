import { Embeddings } from '@langchain/core/embeddings'

export abstract class Embeddings2 extends Embeddings {
  abstract get maxChunkSize(): number
}
