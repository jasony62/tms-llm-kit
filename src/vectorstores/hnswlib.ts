import { Document } from 'langchain/document'
import { HNSWLib } from 'langchain/vectorstores/hnswlib'
import { Embeddings } from 'langchain/embeddings'
import jsonpointer from 'jsonpointer'

interface MetaFilter {
  [pointer: string]: any
}

export class HNSWLib2 {
  declare FilterType: (doc: Document) => boolean

  constructor(public store: HNSWLib) {}

  get docstore() {
    return this.store.docstore
  }
  /**
   *
   * @param directory
   * @param embeddings
   * @returns
   */
  static async load(directory: string, embeddings: Embeddings) {
    let store = await HNSWLib.load(directory, embeddings)
    return new HNSWLib2(store)
  }

  /**
   *
   * @param query
   * @param k
   * @returns
   */
  async similaritySearch(
    query: string,
    k = 4,
    filter?: this['FilterType']
  ): Promise<Document[]> {
    return this.store.similaritySearch(query, k, filter)
  }
  /**
   * 根据元数据检索文档
   * @returns
   */
  async metadataSearch(filter: MetaFilter): Promise<Document[]> {
    if (Object.keys(filter).length === 0)
      throw new Error('没有指定元数据检索条件')

    const rules = Object.keys(filter).map((k) => {
      let compiledPointer = jsonpointer.compile(k)
      return (metadata: any) => {
        return compiledPointer.get(metadata) === filter[k]
      }
    })

    let matched = []
    let docs = this.docstore._docs.values()
    for (let doc of docs) {
      if (rules.every((rule) => rule(doc.metadata))) {
        matched.push(doc)
      }
    }

    return matched
  }
}
