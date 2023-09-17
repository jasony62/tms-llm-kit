import { Document } from 'langchain/document'
import { HNSWLib2 } from '../vectorstores/hnswlib.js'
import {
  VectorRetrieve,
  MetadataRetrieve,
  LLMAnswer,
} from './pipeline/index.js'
import { getEmbedding } from '../embeddings/index.js'

import { reviseJPArray, reviseJPObject } from '../utils/index.js'

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
  async run(text: string): Promise<Document[]> {
    const { filter, numRetrieve } = this.options
    let pipeline = new VectorRetrieve(this.vectorStore, { filter, numRetrieve })
    let result = await pipeline.run(text)
    return result
  }
}
/**
 * 语义检索关联文档
 */
class AssocDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('assoc-doc', vectorStore)
  }
  async run(text: string): Promise<Document[]> {
    const {
      filter,
      numRetrieve,
      assocMatch,
      assocFilter,
      asDoc,
      asMeta,
      retrieveObject,
    } = this.options
    let pipeline = new VectorRetrieve(this.vectorStore, { filter, numRetrieve })
    let pipeline2 = new MetadataRetrieve(this.vectorStore, {
      matchBy: assocMatch,
      filter: assocFilter,
      fromAssocStore: true,
      asDoc,
      asMeta,
      retrieveObject,
    })
    pipeline.next = pipeline2
    let result = await pipeline.run(text)
    return result
  }
}
/**
 * 语言大模型生成回复
 */
class FeedLlm extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('feed-llm', vectorStore)
  }
  async run(text: string): Promise<Document[]> {
    const { filter, numRetrieve, model } = this.options
    let pipeline = new VectorRetrieve(this.vectorStore, { filter, numRetrieve })
    let modelName = model as string
    let pipeline2 = new LLMAnswer(text, { modelName })
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
 * 元数据检索关联文档
 */
class MetaAssocDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('meta-assoc-doc', vectorStore)
  }
  async run(): Promise<Document<Record<string, any>>[]> {
    const { filter } = this.options
    let pipeline = new MetadataRetrieve(this.vectorStore, {
      filter,
      fromAssocStore: true,
    })
    let result = await pipeline.run()
    return result
  }
}
/**
 * 检索
 *
 * @param name
 * @param options
 * @param text
 * @param model
 * @returns
 */
export async function runPerset(
  name: string,
  options: Record<string, any>,
  text?: string,
  model?: string
) {
  if (options.filter && typeof options.filter === 'object') {
    options.filter = reviseJPObject(options.filter)
  }
  if (options.assocFilter && typeof options.assocFilter === 'object') {
    options.assocFilter = reviseJPObject(options.assocFilter)
  }
  if (Array.isArray(options.assocMatch)) {
    options.assocMatch = reviseJPArray(options.assocMatch)
  }
  if (Array.isArray(options.asDoc)) {
    options.asDoc = reviseJPArray(options.asDoc)
  }
  if (Array.isArray(options.asMeta)) {
    options.asMeta = reviseJPArray(options.asMeta)
  }

  let persetClass: any
  switch (name) {
    case 'vector-doc':
      persetClass = VectorDoc
      break
    case 'assoc-doc':
      persetClass = AssocDoc
      break
    case 'feed-llm':
      persetClass = FeedLlm
      break
    case 'meta-vector-doc':
      persetClass = MetaVectorDoc
      break
    case 'meta-assoc-doc':
      persetClass = MetaAssocDoc
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
