import jsonpointer from 'jsonpointer'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { Document } from 'langchain/document'

export class JSONLoader extends TextLoader {
  public contentPts: string[]
  public metaPts: string[]

  constructor(
    filePathOrBlob: string | Blob,
    contentPts: string | string[] = [],
    metaPts: string | string[] = []
  ) {
    super(filePathOrBlob)
    this.contentPts = Array.isArray(contentPts)
      ? contentPts
      : contentPts.split(',')
    this.metaPts = Array.isArray(metaPts) ? metaPts : metaPts.split(',')
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

  protected async parse2(
    raw: string,
    metabase: Record<string, string>
  ): Promise<Document[]> {
    const json = JSON.parse(raw.trim())
    if (!Array.isArray(json)) throw new Error('JSON数据格式错误，不是数组')

    if (json.length === 0) return []

    const documents: Document[] = []
    const compiledPointers1 = this.contentPts.map((pointer) => {
      return /^\//.test(pointer)
        ? jsonpointer.compile(pointer)
        : jsonpointer.compile('/' + pointer)
    })
    const compiledPointers2 = this.metaPts.map((pointer) => {
      return /^\//.test(pointer)
        ? jsonpointer.compile(pointer)
        : jsonpointer.compile('/' + pointer)
    })

    json.forEach((row) => {
      compiledPointers1.forEach((pt, index) => {
        let pageContent = pt.get(row)
        let metadata = {
          ...metabase,
          // line: documents.length + 1,
          _pageContentSource: this.contentPts[index],
        }
        compiledPointers2.forEach((pt) => {
          pt.set(metadata, pt.get(row))
        })
        let doc = new Document({ pageContent, metadata })
        documents.push(doc)
      })
    })

    return documents
  }
}
