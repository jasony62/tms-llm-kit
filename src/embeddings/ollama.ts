import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama'
import { EmbeddingsInterface2 } from './types.js'

const MaxChunkSize = 512

export class OllamaEmbeddings2 implements EmbeddingsInterface2 {
  private _ollamaEmbedding

  constructor(params: any) {
    if (!params?.model) {
      params.model = 'llama3'
    }
    this._ollamaEmbedding = new OllamaEmbeddings(params)
  }
  get maxChunkSize(): number {
    return MaxChunkSize
  }
  embedDocuments(documents: string[]): Promise<number[][]> {
    return this._ollamaEmbedding.embedDocuments(documents)
  }
  embedQuery(document: string): Promise<number[]> {
    return this._ollamaEmbedding.embedQuery(document)
  }
}
