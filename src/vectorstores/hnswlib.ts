import { Document } from 'langchain/document'
import { HNSWLib } from 'langchain/vectorstores/hnswlib'
import { Embeddings } from 'langchain/embeddings/base'
import jsonpointer from 'jsonpointer'
import fs from 'fs'
import path from 'path'
import { SynchronousInMemoryDocstore } from 'langchain/stores/doc/in_memory'
interface MetaFilter {
  [pointer: string]: any
}

export class HNSWLib2 {
  declare FilterType: (doc: Document) => boolean
  /**
   * 未向量化文档
   */
  docstoreNonvec?: SynchronousInMemoryDocstore

  constructor(public store: HNSWLib, public directory: string) {}

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
    let lib = new HNSWLib2(store, directory)
    /**
     * 未向量化文档资料
     */
    let nonvec = path.resolve(directory, 'docstore-nonvec.json')
    if (fs.existsSync(nonvec)) {
      let buf = fs.readFileSync(nonvec, 'utf-8')
      let docs = JSON.parse(buf.toString())
      lib.docstoreNonvec = new SynchronousInMemoryDocstore(new Map(docs))
    }
    return lib
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
  async metadataSearch(
    filter: MetaFilter,
    options = { fromNonvecStore: false }
  ): Promise<Document[]> {
    if (Object.keys(filter).length === 0)
      throw new Error('没有指定元数据检索条件')

    const rules = Object.keys(filter).map((k) => {
      let compiledPointer = jsonpointer.compile(k)
      return (metadata: any) => {
        return compiledPointer.get(metadata) === filter[k]
      }
    })

    const matched = []
    const docSource =
      options?.fromNonvecStore === true
        ? this.docstoreNonvec?._docs
        : this.docstore._docs

    const docs = docSource?.values()
    if (docs) {
      for (let doc of docs) {
        if (rules.every((rule) => rule(doc.metadata))) {
          matched.push(doc)
        }
      }
    }

    return matched
  }
}
