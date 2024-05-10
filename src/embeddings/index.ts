import { EmbeddingsInterface2 } from './types.js'

export async function getEmbedding(modelName: string) {
  let embedding: EmbeddingsInterface2 | undefined

  switch (modelName) {
    case 'baiduwenxin':
      const { BaiduwenxinEmbeddings } = await import('./baiduwenxin.js')
      embedding = new BaiduwenxinEmbeddings()
      break
    case 'xunfeispark':
      const { XunfeisparkEmbeddings } = await import('./xunfeispark.js')
      embedding = new XunfeisparkEmbeddings()
      break
    case 'alibaba_tongyi':
      {
        const { AlibabaTongyiEmbeddings2 } = await import('./alibaba_tongyi.js')
        const params = {}
        embedding = new AlibabaTongyiEmbeddings2(params)
      }
      break
    case 'ollama':
      {
        const { OllamaEmbeddings2 } = await import('./ollama.js')
        const params = {}
        embedding = new OllamaEmbeddings2(params)
      }
      break
    default:
      throw new Error(`不支持指定的模型【${modelName}】`)
  }

  return embedding
}
