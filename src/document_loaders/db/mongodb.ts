import { Document as LCDocument } from 'langchain/document'
import { BaseDocumentLoader } from 'langchain/document_loaders/base'
import { Collection, Db, MongoClient, Document as MongoDoc } from 'mongodb'
import jsonpointer from 'jsonpointer'

import Debug from 'debug'

const debug = Debug('tms-llm-kit:document_loaders:db:mongodb')
/**
 * mongodbb集合内容加载
 */
export class MongodbCollectionLoader extends BaseDocumentLoader {
  vecPts: string[]
  metaPts: string[]
  compiledVecPts: jsonpointer[]
  compiledMetaPts: jsonpointer[]

  constructor(
    private connUri: string,
    private dbName: string,
    private clName: string,
    vecPts: string | string[] = [],
    metaPts: string | string[] = []
  ) {
    super()
    this.vecPts = Array.isArray(vecPts) ? vecPts : vecPts.split(',')
    this.metaPts = Array.isArray(metaPts) ? metaPts : metaPts.split(',')
    this.compiledVecPts = this.vecPts.map((p) => {
      return /^\//.test(p)
        ? jsonpointer.compile(p)
        : jsonpointer.compile('/' + p)
    })
    this.compiledMetaPts = this.metaPts.map((p) => {
      return /^\//.test(p)
        ? jsonpointer.compile(p)
        : jsonpointer.compile('/' + p)
    })
  }

  toJSON() {
    return {
      connUri: this.connUri,
      dbName: this.dbName,
      clName: this.clName,
      vecPts: this.vecPts,
      metaPts: this.metaPts,
    }
  }

  async fetchRawDocs(client: MongoClient): Promise<MongoDoc[]> {
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
   * 处理单条文档
   */
  private processDocument(rawDoc: MongoDoc): LCDocument[] {
    let metadata: Record<string, string> // 文档元数据
    if (this.compiledMetaPts.length) {
      metadata = this.compiledMetaPts.reduce((m: any, p: jsonpointer) => {
        p.set(m, p.get(rawDoc))
        return m
      }, {})
    } else {
      metadata = { ...rawDoc }
    }
    // 每个向量化的字段生成1个稳单
    if (this.compiledVecPts.length) {
      const vecDocs = this.compiledVecPts.map((p: jsonpointer, index) => {
        let pageContent = p.get(rawDoc)
        return new LCDocument({
          metadata: {
            ...metadata,
            _pageContentSource: this.vecPts[index],
          },
          pageContent,
        })
      })
      return vecDocs
    }

    return []
  }
  /**
   * 处理集合中的文档
   */
  private async processCollection(client: MongoClient): Promise<LCDocument[]> {
    // 从数据库中获得文档
    const rawDocs: MongoDoc[] = await this.fetchRawDocs(client)

    let docs = []
    for (let rawDoc of rawDocs) {
      let doc = this.processDocument(rawDoc)
      docs.push(...doc)
    }
    return docs
  }
  /**
   * 执行文档加载
   *
   * @returns
   */
  public async load(): Promise<LCDocument[]> {
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
