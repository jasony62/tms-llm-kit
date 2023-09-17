import jsonpointer from 'jsonpointer'
import { PointerFilter, RetrievePipeline } from '../pipeline.js'
import { HNSWLib2 } from '../../vectorstores/hnswlib.js'
import { Document } from 'langchain/document'
import fs from 'fs'
import { Collection } from 'mongodb'

import Debug from 'debug'
import { constants } from 'buffer'

const debug = Debug('tms-llm-kit:retrieve:pipeline:metadata')

interface MetadataRetrieveOptions {
  filter?: PointerFilter
  matchBy?: string[]
  fromAssocStore?: boolean
  asDoc?: string[]
  asMeta?: string[]
  retrieveObject?: boolean
}
/**
 * 根据元数据检索文档
 */
export class MetadataRetrieve extends RetrievePipeline {
  filter: PointerFilter | undefined

  matchBy: string[] | undefined

  matchByPointers: jsonpointer[] | undefined

  fromAssocStore = false

  asDoc: string[] | undefined

  asMeta: string[] | undefined

  retrieveObject = false

  loaderArgs: Record<string, any> | undefined

  constructor(vectorStore: HNSWLib2, options?: MetadataRetrieveOptions) {
    if (!vectorStore) throw new Error('没有指定向量数据库实例')

    super(vectorStore)
    if (options && typeof options === 'object') {
      const { filter, matchBy, fromAssocStore, asDoc, asMeta, retrieveObject } =
        options
      if (filter) {
        this.filter = typeof filter === 'string' ? JSON.parse(filter) : filter
      }
      if (matchBy) {
        this.matchBy = matchBy
        this.matchByPointers = matchBy.map((p) => jsonpointer.compile(p))
      }
      if (fromAssocStore === true) {
        this.fromAssocStore = true
      }
      if (asDoc) {
        this.asDoc = asDoc
      }
      if (asMeta) {
        this.asMeta = asMeta
      }
      this.retrieveObject = retrieveObject === true
    }
    // 向量数据库的存储路径
    const { directory } = vectorStore
    // 检查是否存在loader.json
    const loderfilepath = `${directory}/loader.json`
    if (fs.existsSync(loderfilepath)) {
      this.loaderArgs = JSON.parse(
        fs.readFileSync(loderfilepath).toString('utf-8')
      )
    }
  }
  /**
   * 关联数据整体转为一个文档对象
   * @param rawDoc
   */
  private convertRawDoc2Document(
    rawDoc: Record<string, any>,
    asDoc?: string[],
    asMeta?: string[]
  ): Document {
    let metadata: any
    if (Array.isArray(asMeta) && asMeta.length) {
      metadata = asMeta.reduce((m, k) => {
        m[k] = jsonpointer.compile(k).get(rawDoc)
        return m
      }, {} as Record<string, any>)
    }
    let content: any
    if (Array.isArray(asDoc) && asDoc.length) {
      content = asDoc.reduce((c, k) => {
        c[k] = jsonpointer.compile(k).get(rawDoc)
        return c
      }, {} as Record<string, any>)
    } else {
      content = rawDoc
    }
    if (!metadata) {
      // 将文档内容从元数据中去掉
      metadata = JSON.parse(JSON.stringify(rawDoc))
      Object.keys(content).forEach((k) => {
        jsonpointer.compile(k).set(metadata ?? {}, undefined)
      })
    }
    return new Document({
      pageContent: JSON.stringify(content),
      metadata,
    })
  }
  /**
   *
   * @param rawDoc
   * @param asDoc
   * @param asMeta
   */
  private splitRawDoc2Documents(
    rawDoc: any,
    asDoc?: string[],
    asMeta?: string[]
  ): Document[] {
    let metadata: Record<string, any> | undefined
    if (Array.isArray(asMeta) && asMeta.length) {
      metadata = asMeta.reduce((m, c) => {
        m[c] = jsonpointer.compile(c).get(rawDoc)
        return m
      }, {} as Record<string, any>)
    }
    let contents: Record<string, any> = {}
    if (Array.isArray(asDoc) && asDoc.length) {
      asDoc?.forEach((k) => {
        contents[k] = jsonpointer.compile(k).get(rawDoc)
      })
    }
    if (Object.keys(contents).length) {
      if (!metadata) {
        // 将文档内容从元数据中去掉
        metadata = JSON.parse(JSON.stringify(rawDoc))
        Object.keys(contents).forEach((k) => {
          jsonpointer.compile(k).set(metadata ?? {}, undefined)
        })
      }
      return Object.entries(contents).map(([k, v]) => {
        return new Document({
          pageContent: v,
          metadata: {
            ...metadata,
            _pageContentSource: k,
          },
        })
      })
    } else {
      if (metadata) {
        return [
          new Document({
            pageContent: '',
            metadata,
          }),
        ]
      } else {
        return [
          new Document({
            pageContent: '',
            metadata: {
              ...rawDoc,
            },
          }),
        ]
      }
    }
  }
  /**
   * 执行一次查询
   * @param cl
   * @param filter
   * @returns
   */
  private async _fetchMongoOnce(
    cl: Collection,
    filter: Record<string, any>
  ): Promise<Document[]> {
    // 从mongodb获得数据
    const cursor = cl.find(filter)
    // 处理结果
    const lcDocs = []
    if (this.retrieveObject === true) {
      for await (const rawDoc of cursor) {
        lcDocs.push(
          this.convertRawDoc2Document(rawDoc, this.asDoc, this.asMeta)
        )
      }
    } else {
      for await (const rawDoc of cursor) {
        lcDocs.push(
          ...this.splitRawDoc2Documents(rawDoc, this.asDoc, this.asMeta)
        )
      }
    }

    return lcDocs
  }
  /**
   * 从mongodb获取文档
   *
   * @param documents
   * @returns
   */
  private async _fetchMongo(documents?: Document[]) {
    let mongoArgs = this.loaderArgs
    if (!mongoArgs || typeof mongoArgs !== 'object')
      throw new Error('没有提供mongodb参数')

    const { MongoClient, ObjectId } = await import('mongodb')
    const client = new MongoClient(mongoArgs.connUri)
    const db = client.db(mongoArgs.dbName)
    const cl = db.collection(mongoArgs.clName)

    let result: any
    debug('获取loader信息：\n%O', mongoArgs)
    if (Array.isArray(documents)) {
      for (let doc of documents) {
        let matcher: Record<string, any> = {}
        this.matchBy?.forEach((k) => {
          let jp = jsonpointer.compile(k)
          let v = jp.get(doc.metadata)
          if (v ?? false) jp.set(matcher, k === '/_id' ? new ObjectId(v) : v)
        })
        debug('mongodb文档筛选条件\n%O', matcher)
        if (Object.keys(matcher).length) {
          let docs = await this._fetchMongoOnce(cl, matcher)
          if (docs) {
            result ? result.push(...docs) : (result = docs)
          }
        }
      }
    } else if (this.filter) {
      result = await this._fetchMongoOnce(cl, this.filter)
    }

    client.close()

    return result
  }
  /**
   * 从本地获取文档数据
   *
   * @param documents
   */
  private async _fetchLocal(documents?: Document[]) {
    let result
    if (Array.isArray(documents)) {
      for (let doc of documents) {
        let matcher: PointerFilter = {}
        this.matchByPointers?.forEach((p, index) => {
          if (this.matchBy) matcher[this.matchBy[index]] = p.get(doc.metadata)
        })
        if (this.filter) {
          matcher = {
            ...matcher,
            ...this.filter,
          }
        }
        debug(`本地非向量化文档检索条件\n%O`, matcher)
        const assocDocs = await this.vectorStore?.metadataSearch(matcher, {
          fromAssocStore: this.fromAssocStore,
        })
        if (assocDocs) {
          result = []
          if (this.retrieveObject === true) {
            for (let assocDoc of assocDocs) {
              let rawDoc: any = lcDoc2RawDoc(assocDoc)
              result.push(
                this.convertRawDoc2Document(rawDoc, this.asDoc, this.asMeta)
              )
            }
          } else {
            for (let assocDoc of assocDocs) {
              let rawDoc: any = lcDoc2RawDoc(assocDoc)
              result.push(
                ...this.splitRawDoc2Documents(rawDoc, this.asDoc, this.asMeta)
              )
            }
          }
        }
      }
    } else if (this.filter) {
      result = await this.vectorStore?.metadataSearch(this.filter, {
        fromAssocStore: this.fromAssocStore,
      })
    }
    return result

    function lcDoc2RawDoc(assocDoc: Document<Record<string, any>>) {
      let rawDoc: any = {
        ...assocDoc.metadata,
        [assocDoc.metadata._pageContentSource]: assocDoc.pageContent,
      }
      delete rawDoc['_pageContentSource']
      delete rawDoc.loc
      delete rawDoc.source
      return rawDoc
    }
  }
  /**
   * lorder名称
   * @returns
   */
  private get loaderName(): string | undefined {
    return this.loaderArgs?.loaderName
  }
  /**
   * 执行检索操作
   * @param documents 作为检索条件的文档
   * @returns
   */
  async run(documents?: Document[]): Promise<Document[]> {
    debug(`指定了${documents?.length ?? 0}个文档作为检索条件`)
    let result
    switch (this.loaderName) {
      case 'MongodbCollectionLoader':
        result = await this._fetchMongo(documents)
        break
      default:
        result = await this._fetchLocal(documents)
    }

    if (this.next) {
      return await this.next.run(result)
    }
    return result ?? []
  }
}
