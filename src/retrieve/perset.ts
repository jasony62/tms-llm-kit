import { Document } from 'langchain/document'
import { HNSWLib2 } from '../vectorstores/hnswlib.js'
import {
  VectorRetrieve,
  MetadataRetrieve,
  LLMAnswer,
} from './pipeline/index.js'
import { getEmbedding } from '../embeddings/index.js'

abstract class RetrievePerset {
  constructor(public name: string, public vectorStore: HNSWLib2) {}

  abstract run(text?: string): Promise<Document<Record<string, any>>[]>
}
/**
 * 语义检索向量化文档
 */
class VectorDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('vector-doc', vectorStore)
  }
  async run(text: string): Promise<Document<Record<string, any>>[]> {
    const { filter, k } = this.options
    let pipeline = new VectorRetrieve(this.vectorStore, { filter, k })
    let result = await pipeline.run(text)
    return result
  }
}
/**
 * 语义检索非向量化文档
 */
class NonvecDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('nonvec-doc', vectorStore)
  }
  async run(text: string): Promise<Document[]> {
    const {
      filter,
      k,
      nonvecMatch,
      nonvecFilter: nvFilter,
      asDoc,
      asMeta,
    } = this.options
    let pipeline = new VectorRetrieve(this.vectorStore, { filter, k })
    let pipeline2 = new MetadataRetrieve(this.vectorStore, {
      matchBy: nonvecMatch,
      filter: nvFilter,
      fromNonvecStore: true,
      asDoc,
      asMeta,
    })
    pipeline.next = pipeline2
    let result = await pipeline.run(text)
    return result
  }
}
/**
 * 语言大模型生成回复
 */
class LlmAnswer extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('llm-answer', vectorStore)
  }
  async run(text: string): Promise<Document<Record<string, any>>[]> {
    const { filter, k } = this.options
    let pipeline = new VectorRetrieve(this.vectorStore, { filter, k })
    let pipeline2 = new LLMAnswer(text)
    pipeline.next = pipeline2
    let result = await pipeline.run(text)
    return result
  }
}
/**
 * 元数据检索向量化文档
 */
class MetaVectorDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('meta-vector-doc', vectorStore)
  }
  async run(): Promise<Document<Record<string, any>>[]> {
    const { filter } = this.options
    let pipeline = new MetadataRetrieve(this.vectorStore, { filter })
    let result = await pipeline.run()
    return result
  }
}
/**
 * 元数据检索非向量化文档
 */
class MetaNonvecDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('meta-nonvec-doc', vectorStore)
  }
  async run(): Promise<Document<Record<string, any>>[]> {
    const { filter } = this.options
    let pipeline = new MetadataRetrieve(this.vectorStore, {
      filter,
      fromNonvecStore: true,
    })
    let result = await pipeline.run()
    return result
  }
}

export async function runPerset(
  name: string,
  options: Record<string, any>,
  text?: string,
  model?: string
) {
  let persetClass: any
  switch (name) {
    case 'vector-doc':
      persetClass = VectorDoc
      break
    case 'nonvec-doc':
      persetClass = NonvecDoc
      break
    case 'llm-answer':
      persetClass = LLMAnswer
      break
    case 'meta-vector-doc':
      persetClass = MetaVectorDoc
      break
    case 'meta-nonvec-doc':
      persetClass = MetaNonvecDoc
      break
  }
  if (!persetClass) throw new Error('指定了无效的预制操作：' + name)

  const embedding = await getEmbedding(model ?? 'baiduwenxin')
  /**
   * 从指定的数据库中加载数据
   */
  const vectorStore = await HNSWLib2.load(options.store, embedding)

  const perset = new persetClass(vectorStore, options)

  return await perset.run(text)
}
