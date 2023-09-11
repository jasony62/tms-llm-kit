import { BaseDocumentLoader } from 'langchain/document_loaders/base'
import { Document } from 'langchain/document'
import jsonpointer from 'jsonpointer'

/**
 * tmw查询文档
 */
interface TmwDoc {
  _id: string
  [key: string]: any
}
/**
 * tmw文档查询返回结果
 */
interface TmwDocQueryResponse {
  msg: string
  code: number
  result: {
    docs: TmwDoc[]
    total: number
  }
}
/**
 * tms-mongodb-web集合内容加载
 */
export class TmwCollectionLoader extends BaseDocumentLoader {
  vecPts: string[]
  metaPts: string[]
  compiledVecPts: jsonpointer[]
  compiledMetaPts: jsonpointer[]

  constructor(
    private tmwUrl: string,
    private tmwAccessToken: string,
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

  async fetchTmwDocs(): Promise<TmwDoc[]> {
    const headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.tmwAccessToken}`,
    }
    const response = await fetch(this.tmwUrl, {
      method: 'GET',
      headers,
    })

    const json: TmwDocQueryResponse = await response.json()

    let docs = json.result.docs

    return docs
  }
  /**
   * 处理单条文档
   */
  private processDocument(tmwDoc: TmwDoc): Document[] {
    let metadata: Record<string, string> // 文档元数据
    if (this.compiledMetaPts.length) {
      metadata = this.compiledMetaPts.reduce((m: any, p: jsonpointer) => {
        p.set(m, p.get(tmwDoc))
        return m
      }, {})
    } else {
      metadata = { ...tmwDoc }
    }
    // 每个向量化的字段生成1个稳单
    if (this.compiledVecPts.length) {
      const vecDocs = this.compiledVecPts.map((p: jsonpointer, index) => {
        let pageContent = p.get(tmwDoc)
        return new Document({
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
  private async processCollection(): Promise<Document[]> {
    const tmwDocs: TmwDoc[] = await this.fetchTmwDocs()

    let docs = []
    for (let tmwDoc of tmwDocs) {
      let doc = this.processDocument(tmwDoc)
      docs.push(...doc)
    }
    return docs
  }
  /**
   * 执行文档加载
   * @returns
   */
  public async load(): Promise<Document[]> {
    return await this.processCollection()
  }
}
