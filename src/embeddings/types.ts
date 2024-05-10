import { Embeddings, EmbeddingsInterface } from '@langchain/core/embeddings'

/**
 *
 */
export interface EmbeddingsInterface2 extends EmbeddingsInterface {
  get maxChunkSize(): number
}
/**
 *
 */
export abstract class Embeddings2
  extends Embeddings
  implements EmbeddingsInterface2
{
  abstract get maxChunkSize(): number
}
