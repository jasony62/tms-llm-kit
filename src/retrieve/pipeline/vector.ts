import JSONPointer from 'jsonpointer'
import { HNSWLib2 } from '../../vectorstores/hnswlib.js'
import { PointerFilter, RetrievePipeline } from '../pipeline.js'
import { Document } from 'langchain/document'

/**
 * 将筛选条件编译为检查规则方法
 *
 * @param filter
 * @returns
 */
function filterFunction(filter: PointerFilter): (doc: Document) => boolean {
  const rules = Object.keys(filter).map((k) => {
    let cp = JSONPointer.compile(k)
    return (metadata: any) => {
      return cp.get(metadata) === filter[k]
    }
  })

  return (doc: any) => {
    return rules.every((rule) => rule(doc.metadata))
  }
}

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
      this.filter ? filterFunction(this.filter) : undefined
    )
    if (this.next) {
      return await this.next.run(result)
    }

    return result!
  }
}
