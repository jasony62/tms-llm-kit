import { Document } from 'langchain/document'
import { BaseDocumentLoader } from 'langchain/document_loaders/base'
import { Collection, Db, MongoClient } from 'mongodb'
import { DocTransform } from '../../utils/index.js'

import Debug from 'debug'

const debug = Debug('tms-llm-kit:document_loaders:db:mongodb')
/**
 * mongodbb集合内容加载
 */
export class MongodbCollectionLoader extends BaseDocumentLoader {
  docTransform: DocTransform

  constructor(
    private connUri: string,
    private dbName: string,
    private clName: string,
    asVec: string | string[] = [],
    asMeta: string | string[] = []
  ) {
    super()
    this.docTransform = DocTransform.create(asVec, asMeta)
  }

  toJSON() {
    return {
      loaderName: 'MongodbCollectionLoader',
      connUri: this.connUri,
      dbName: this.dbName,
      clName: this.clName,
      vecFields: this.docTransform.vecFields.ptNames,
      metaFields: this.docTransform.metaFields?.ptNames,
    }
  }

  async fetchRawDocs(client: MongoClient): Promise<any[]> {
    let db: Db = client.db(this.dbName)
    let cl: Collection = db.collection(this.clName)
    let cursor = cl.find()
    const docs = []
    for await (const doc of cursor) {
      docs.push(doc)
    }

    return docs
  }
  /**
   * 处理集合中的文档
   */
  private async processCollection(client: MongoClient): Promise<Document[]> {
    // 从数据库中获得文档
    const rawDocs = await this.fetchRawDocs(client)

    return rawDocs.reduce((result, rawDoc) => {
      let docs = this.docTransform.exec(rawDoc)
      result.push(...docs)
      return result
    }, [] as Document[])
  }
  /**
   * 执行文档加载
   *
   * @returns
   */
  public async load(): Promise<Document[]> {
    const client = new MongoClient(this.connUri)
    try {
      await client.connect()
      debug('完成连接mongodb数据库')
      const docs = await this.processCollection(client)
      debug(`完成文档加载，共生成${docs.length}个文档`)
      client.close()
      return docs
    } catch (e: any) {
      console.log('连接mongodb失败，原因：' + e.message)
    }
    return []
  }
}
