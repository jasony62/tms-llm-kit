import { Document } from 'langchain/document'
import { HNSWLib2 } from '../vectorstores/hnswlib.js'
import {
  VectorRetrieve,
  MetadataRetrieve,
  LLMAnswer,
} from './pipeline/index.js'
import fs from 'fs'
import path from 'path'
import { getEmbedding } from '../embeddings/index.js'

import { reviseJPArray, reviseJPObject } from '../utils/index.js'
import { RetrieveService } from '../types/index.js'
import { Mongo2 } from '../vectorstores/mongo.js'

export abstract class RetrievePerset {
  constructor(
    public name: string,
    public service: RetrieveService,
    public options: Record<string, any>
  ) {}

  abstract run(text?: string): Promise<Document<Record<string, any>>[]>
}
/**
 * 语义检索向量化文档
 */
class VectorDoc extends RetrievePerset {
  constructor(service: RetrieveService, options: Record<string, any>) {
    super('vector-doc', service, options)
  }
  async run(text: string): Promise<Document[]> {
    const { filter, numRetrieve } = this.options
    let pipeline = new VectorRetrieve(this.service, { filter, numRetrieve })
    let result = await pipeline.run(text)
    return result
  }
}
/**
 * 语义检索关联文档
 */
class AssocDoc extends RetrievePerset {
  constructor(service: RetrieveService, options: Record<string, any>) {
    super('assoc-doc', service, options)
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
    let pipeline = new VectorRetrieve(this.service, { filter, numRetrieve })
    let pipeline2 = new MetadataRetrieve(this, {
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
 *
 * 用户的输入作为检索条件，从向量数据库中查找匹配的内容
 * 将匹配的内容作为背景材料发送给大模型成生成回复
 */
class FeedLlm extends RetrievePerset {
  constructor(service: RetrieveService, options: Record<string, any>) {
    super('feed-llm', service, options)
  }
  async run(text: string): Promise<Document[]> {
    const { filter, numRetrieve, model, streaming } = this.options
    let pipeline = new VectorRetrieve(this.service, { filter, numRetrieve })
    let modelName = model as string
    let pipeline2 = new LLMAnswer(text, {
      modelName,
      verbose: this.options.llmVerbose === true,
      streaming: streaming === true,
      streamingCallback: this.options.streamingCallback,
    })
    pipeline.next = pipeline2
    let result = await pipeline.run(text)
    return result
  }
}
/**
 * 元数据检索向量化文档
 */
class MetaVectorDoc extends RetrievePerset {
  constructor(service: RetrieveService, options: Record<string, any>) {
    super('meta-vector-doc', service, options)
  }
  async run(): Promise<Document<Record<string, any>>[]> {
    const { filter } = this.options
    let pipeline = new MetadataRetrieve(this, { filter })
    let result = await pipeline.run()
    return result
  }
}
/**
 * 元数据检索关联文档
 */
class MetaAssocDoc extends RetrievePerset {
  constructor(service: RetrieveService, options: Record<string, any>) {
    super('meta-assoc-doc', service, options)
  }
  async run(): Promise<Document<Record<string, any>>[]> {
    const { filter } = this.options
    let pipeline = new MetadataRetrieve(this, {
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
  text?: string
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

  /**
   * 从指定的数据库中加载数据
   */
  if (!options.store || typeof options.store !== 'string') {
    throw new Error('没有指定存储地址')
  }
  let service
  if (options.store.indexOf('mongodb://') === 0) {
    const { db: dbName, cl: clName, asVec, asMeta } = options
    if (!dbName) throw new Error('没有指定mongodb数据库名称')
    if (!clName) throw new Error('没有指定mongodb集合名称')
    service = await Mongo2.connect(options.store, dbName, clName, asVec, asMeta)
  } else {
    const modelFilePath = path.resolve(options.store, 'model.json')
    if (!fs.existsSync(modelFilePath))
      throw new Error('没有获得向量数据库的模型配置文件model.json')
    const modelConfig = JSON.parse(
      fs.readFileSync(modelFilePath).toString('utf-8')
    )
    options.model = modelConfig.name

    const embedding = await getEmbedding(modelConfig.name)

    service = await HNSWLib2.load(options.store, embedding)
  }

  const perset = new persetClass(service, options)

  return await perset.run(text)
}
