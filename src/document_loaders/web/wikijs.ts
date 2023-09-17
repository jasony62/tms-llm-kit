import { BaseDocumentLoader } from 'langchain/document_loaders'
import { Document } from 'langchain/document'
import { DocTransform } from '../../utils/index.js'

interface WikijsPage {
  id: number
  path: string
  title: string
  description: string
  createdAt: string
  updatedAt: string
  content: string
}
/**
 *
 */
interface WikijsPageSimple {
  id: number
  path: string
  updatedAt: string
}

export class WikijsPageLoader extends BaseDocumentLoader {
  docTransform: DocTransform

  constructor(
    private wikijsUrl: string,
    private wikijsApiKey: string,
    asVec: string | string[] = ['content'],
    asMeta: string | string[] = ['id']
  ) {
    super()
    // 提取页面对象的content字段作为向量
    this.docTransform = DocTransform.create(asVec, asMeta)
  }

  async fetchWikijs(body: string) {
    const headers: any = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${this.wikijsApiKey}`,
    }
    const response = await fetch(this.wikijsUrl, {
      method: 'POST',
      headers,
      body,
    })

    let { status, statusText } = response
    if (status !== 200) {
      throw new Error('调用API发生错误，原因：' + statusText)
    }

    const json = await response.json()

    return json
  }
  /**
   * 获取指定id的页面
   * @param id
   */
  async fetchOne(id: number): Promise<WikijsPage> {
    let body = JSON.stringify({
      query: `{pages{single(id:${id}){id\npath\ntitle\ndescription\ncreatedAt\nupdatedAt\ncontent}}}`,
    })
    let json = await this.fetchWikijs(body)

    console.log(JSON.stringify(json, null, 2))

    return json.data.pages.single
  }
  /**
   * 获取所有的页面
   * @returns
   */
  async fetchAll(): Promise<WikijsPageSimple[]> {
    let body = JSON.stringify({
      query:
        '{pages{list(orderBy:UPDATED\norderByDirection:DESC){id\npath\nupdatedAt}}}',
    })
    let json = await this.fetchWikijs(body)

    return json.data.pages.list
  }
  /**
   *
   */
  private async processRepo(): Promise<Document[]> {
    const pages: WikijsPageSimple[] = await this.fetchAll()

    let result: Document[] = []
    for await (let page of pages) {
      let page2 = await this.fetchOne(page.id)
      let docs = this.docTransform.exec(page2)
      result.push(...docs)
    }
    return result
  }
  /**
   * 执行文档加载
   * @returns
   */
  public async load(): Promise<Document[]> {
    return await this.processRepo()
  }
}
