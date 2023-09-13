import { HNSWLib2 } from '../../vectorstores/hnswlib.js'
import {
  PointerFilter,
  RetrievePipeline,
  compilePointerFilter,
} from '../pipeline.js'
import { Document } from 'langchain/document'

interface VectorRetrieveOptions {
  filter: PointerFilter
  numRetrieve: number
}

/**
 * 在向量数据库中根据语义搜索匹配的文档
 */
export class VectorRetrieve extends RetrievePipeline {
  filter: PointerFilter | undefined

  numRetrieve = 1

  constructor(vectorStore: HNSWLib2, options?: VectorRetrieveOptions) {
    super(vectorStore)

    if (options?.filter) {
      const { filter } = options
      this.filter = typeof filter === 'string' ? JSON.parse(filter) : filter
    }
    if (options?.numRetrieve) {
      this.numRetrieve = +options.numRetrieve
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
      this.numRetrieve,
      this.filter ? compilePointerFilter(this.filter) : undefined
    )
    if (this.next) {
      return await this.next.run(result)
    }

    return result!
  }
}
