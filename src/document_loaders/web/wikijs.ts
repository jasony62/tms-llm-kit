import { BaseDocumentLoader } from 'langchain/document_loaders'
import { Document } from 'langchain/document'

interface GetPageResponse {
  content: string
  metadata: { [key: string]: any }
}
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
  constructor(private wikijsUrl: string, private wikijsApiKey: string) {
    super()
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

    // console.log(JSON.stringify(json, null, 2))

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
  private async processRepo(): Promise<GetPageResponse[]> {
    const pages: WikijsPageSimple[] = await this.fetchAll()

    let docs = []
    for (let { id } of pages) {
      let page = await this.fetchOne(id)
      let metadata = { ...page, content: undefined }
      let doc = {
        content: page.content ?? '',
        metadata,
      }
      docs.push(doc)
    }
    return docs
  }
  /**
   * 执行文档加载
   * @returns
   */
  public async load(): Promise<Document[]> {
    return (await this.processRepo()).map(
      (pageResponse) =>
        new Document({
          pageContent: pageResponse.content,
          metadata: pageResponse.metadata,
        })
    )
  }
}
