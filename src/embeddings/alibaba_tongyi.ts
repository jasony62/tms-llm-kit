import { AlibabaTongyiEmbeddings } from '@langchain/community/embeddings/alibaba_tongyi'
import { EmbeddingsInterface2 } from './types.js'

const MaxChunkSize = 512

const APIKEY = process.env.ALIBABA_TONGYI_APIKEY

export class AlibabaTongyiEmbeddings2 implements EmbeddingsInterface2 {
  private _tongyiEmbedding

  constructor(params: any) {
    params ??= {}
    params.apiKey ??= APIKEY
    this._tongyiEmbedding = new AlibabaTongyiEmbeddings(params)
  }

  get maxChunkSize(): number {
    return MaxChunkSize
  }

  embedDocuments(documents: string[]): Promise<number[][]> {
    return this._tongyiEmbedding.embedDocuments(documents)
  }

  embedQuery(document: string): Promise<number[]> {
    return this._tongyiEmbedding.embedQuery(document)
  }
}
