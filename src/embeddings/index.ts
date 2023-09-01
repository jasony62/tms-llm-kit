import { Embeddings2 } from './types.js'

export async function getEmbedding(modelName: string) {
  let embedding: Embeddings2 | undefined

  switch (modelName) {
    case 'baiduwenxin':
      const { BaiduwenxinEmbeddings } = await import('./baiduwenxin.js')
      embedding = new BaiduwenxinEmbeddings()
      break
    case 'xunfeispark':
      const { XunfeisparkEmbeddings } = await import('./xunfeispark.js')
      embedding = new XunfeisparkEmbeddings()
      break
    default:
      throw new Error(`不支持指定的模型【${modelName}】`)
  }

  return embedding
}
