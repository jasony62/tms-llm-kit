import { TextLoader } from 'langchain/document_loaders/fs/text'
import { Document } from 'langchain/document'
import { DocTransform } from '../../utils/index.js'
/**
 * 加载JSON数据文件
 */
export class JSONLoader extends TextLoader {
  docTransform: DocTransform

  constructor(
    filePathOrBlob: string | Blob,
    asVec: string | string[] = [],
    asMeta: string | string[] = []
  ) {
    super(filePathOrBlob)
    this.docTransform = DocTransform.create(asVec, asMeta)
  }

  public async load(): Promise<Document[]> {
    let text: string
    let metadata: Record<string, string>
    if (typeof this.filePathOrBlob === 'string') {
      const { readFile } = await TextLoader.imports()
      text = await readFile(this.filePathOrBlob, 'utf8')
      metadata = { source: this.filePathOrBlob }
    } else {
      text = await this.filePathOrBlob.text()
      metadata = { source: 'blob', blobType: this.filePathOrBlob.type }
    }

    return await this.parse2(text, metadata)
  }

  private async parse2(
    raw: string,
    metabase: Record<string, string>
  ): Promise<Document[]> {
    const json = JSON.parse(raw.trim())
    if (!Array.isArray(json)) throw new Error('JSON数据格式错误，不是数组')

    if (json.length === 0) return []

    return json.reduce((result, row) => {
      let docs = this.docTransform.exec(row, metabase)
      result.push(...docs)
      return result
    }, [] as Document[])
  }
}
