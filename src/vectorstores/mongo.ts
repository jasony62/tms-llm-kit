import { Document } from 'langchain/document'
import { MetaFilter, RetrieveService } from '../types/index.js'
import { Collection, Db, MongoClient } from 'mongodb'
import Debug from 'debug'
import { DocTransform } from '../utils/index.js'

const debug = Debug('tms-llm-kit:vectorstores:mongo')

class PrintableRegExp extends RegExp {
  constructor(pattern: string, flag?: string) {
    super(pattern, flag)
  }

  toJSON() {
    return this.toString()
  }
}

export class Mongo2 implements RetrieveService {
  constructor(
    public readonly connUri: string,
    public readonly dbName: string,
    public readonly clName: string,
    private readonly asVec: string | string[] = [],
    public readonly docTransform: DocTransform
  ) {}
  /**
   *
   * @param connUrl
   * @returns
   */
  static async connect(
    connUri: string,
    dbName: string,
    clName: string,
    asVec: string | string[] = [],
    asMeta: string | string[] = []
  ) {
    const docTransform = DocTransform.create(asVec, asMeta)
    const lib = new Mongo2(connUri, dbName, clName, asVec, docTransform)
    return lib
  }
  /**
   * 从数据库中检索数据
   * @returns
   */
  private async fetchRawDocs(text: string, k = 1): Promise<any[]> {
    debug('开始连接mongodb数据库：' + this.connUri)
    const client = new MongoClient(this.connUri)
    await client.connect()
    debug('完成连接mongodb数据库' + this.connUri)

    let db: Db = client.db(this.dbName)
    let cl: Collection = db.collection(this.clName)
    let query: any = {}
    if (typeof this.asVec === 'string') {
      query.asVec = { $regex: new PrintableRegExp(text) }
    } else if (Array.isArray(this.asVec)) {
      query.$or = this.asVec.map((field) => {
        return { [field]: { $regex: new PrintableRegExp(text) } }
      })
    }
    debug('查询条件：\n' + JSON.stringify(query, null, 2))

    let cursor = cl.find(query).limit(k)
    const docs = []
    for await (const doc of cursor) {
      docs.push(doc)
    }
    client.close()
    return docs
  }
  /**
   *
   * @param query
   * @param k
   * @returns
   */
  async similaritySearch(
    text: string,
    k = 1,
    filter?: (doc: Document<Record<string, any>>) => boolean
  ): Promise<Document[]> {
    // 从数据库中获得文档
    let pattern = text.replaceAll(/,|\s/g, '|')
    const rawDocs = await this.fetchRawDocs(pattern, k)

    const matched: Document[] = rawDocs.reduce((result, rawDoc) => {
      let docs = this.docTransform.exec(rawDoc)
      result.push(...docs)
      return result
    }, [] as Document[])

    return matched
  }
  /**
   * 根据元数据检索文档
   * @returns
   */
  async metadataSearch(
    filter: MetaFilter,
    options = { fromAssocStore: false }
  ): Promise<Document[]> {
    const matched: Document[] = []
    return matched
  }
}
