import { Embeddings } from 'langchain/embeddings/base'

export abstract class Embeddings2 extends Embeddings {
  abstract get maxChunkSize(): number
}
