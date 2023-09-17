import { BaseDocumentLoader } from 'langchain/document_loaders/base'
import { Document } from 'langchain/document'
import { DocTransform } from '../../utils/index.js'

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
  docTransform: DocTransform

  constructor(
    private tmwUrl: string,
    private tmwAccessToken: string,
    asVec: string | string[] = [],
    asMeta: string | string[] = []
  ) {
    super()
    this.docTransform = DocTransform.create(asVec, asMeta)
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

    let { status, statusText } = response

    if (status !== 200) {
      throw new Error('调用API发生错误，原因：' + statusText)
    }

    const json: TmwDocQueryResponse = await response.json()
    let { code, msg, result } = json
    if (code !== 0) {
      throw new Error('调用API返回结果错误，原因：' + msg)
    }

    let { docs } = result

    return docs
  }
  /**
   * 处理集合中的文档
   */
  private async processCollection(): Promise<Document[]> {
    const tmwDocs: TmwDoc[] = await this.fetchTmwDocs()

    return tmwDocs.reduce((result, tmwDoc) => {
      let docs = this.docTransform.exec(tmwDoc)
      result.push(...docs)
      return result
    }, [] as Document[])
  }
  /**
   * 执行文档加载
   * @returns
   */
  public async load(): Promise<Document[]> {
    return await this.processCollection()
  }
}
