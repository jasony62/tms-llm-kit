import { Embeddings } from 'langchain/embeddings'

export abstract class Embeddings2 extends Embeddings {
  abstract get maxChunkSize(): number
}
