import { HNSWLib2 } from '../../vectorstores/hnswlib.js'
import {
  PointerFilter,
  RetrievePipeline,
  compilePointerFilter,
} from '../pipeline.js'
import { Document } from 'langchain/document'

interface VectorRetrieveOptions {
  filter: PointerFilter
  k: number
}

/**
 * 在向量数据库中根据语义搜索匹配的文档
 */
export class VectorRetrieve extends RetrievePipeline {
  filter: PointerFilter | undefined

  k = 1

  constructor(vectorStore: HNSWLib2, options?: VectorRetrieveOptions) {
    super(vectorStore)

    if (options?.filter) {
      const { filter } = options
      this.filter = typeof filter === 'string' ? JSON.parse(filter) : filter
    }
    if (options?.k) {
      this.k = +options.k
    }
  }

  /**
   * 执行操作
   * @param text
   * @returns
   */
  async run(text: string): Promise<Document<Record<string, any>>[]> {
    const result = await this.vectorStore?.similaritySearch(
      text,
      this.k,
      this.filter ? compilePointerFilter(this.filter) : undefined
    )
    if (this.next) {
      return await this.next.run(result)
    }

    return result!
  }
}
