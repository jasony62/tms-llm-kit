import { TextLoader } from 'langchain/document_loaders'
import { Document } from 'langchain/document'
/**
 * Loads a CSV file into a list of documents.
 * Each document represents one row of the CSV file.
 *
 * When `column` is not specified, each row is converted into a key/value pair
 * with each key/value pair outputted to a new line in the document's pageContent.
 *
 * @example
 * // CSV file:
 * // id,html
 * // 1,<i>Corruption discovered at the core of the Banking Clan!</i>
 * // 2,<i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * const loader = new CSVLoader("path/to/file.csv");
 * const docs = await loader.load();
 *
 * // docs[0].pageContent:
 * // id: 1
 * // html: <i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * When `column` is specified, one document is created for each row, and the
 * value of the specified column is used as the document's pageContent.
 *
 * @example
 * // CSV file:
 * // id,html
 * // 1,<i>Corruption discovered at the core of the Banking Clan!</i>
 * // 2,<i>Corruption discovered at the core of the Banking Clan!</i>
 *
 * const loader = new CSVLoader("path/to/file.csv", "html");
 * const docs = await loader.load();
 *
 * // docs[0].pageContent:
 * // <i>Corruption discovered at the core of the Banking Clan!</i>
 */

type CSVLoaderOptions = {
  column?: string
  meta?: string
  separator?: string
}

export class CSVLoader extends TextLoader {
  protected options: CSVLoaderOptions = {}

  constructor(
    filePathOrBlob: string | Blob,
    options?: CSVLoaderOptions | string
  ) {
    super(filePathOrBlob)
    if (typeof options === 'string') {
      this.options = { column: options }
    } else {
      this.options = options ?? this.options
    }
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
    const { column, meta, separator = ',' } = this.options

    if (!column) throw new Error('没有指定作为文档内容的列名称')

    const { dsvFormat } = await CSVLoaderImports()
    const psv = dsvFormat(separator)
    const parsed = psv.parse(raw.trim())

    const documents: Document[] = []

    const metaCols = meta ? meta.split(',') : null
    const cntCols = column.split(',')

    for (let cntCol of cntCols) {
      if (!parsed.columns.includes(cntCol)) {
        throw new Error(`Column ${cntCol} not found in CSV file.`)
      }
      parsed.forEach((row) => {
        let pageContent = row[cntCol]!
        let metadata: any = {
          ...metabase,
          // line: documents.length + 1,
          _pageContentSource: cntCol,
        }
        if (metaCols) {
          metaCols.forEach((col) => (metadata[col] = row[col]))
        }
        let doc = new Document({
          pageContent,
          metadata,
        })
        documents.push(doc)
      })
    }

    return documents
  }
}

async function CSVLoaderImports() {
  try {
    const { dsvFormat } = await import('d3-dsv')
    return { dsvFormat }
  } catch (e) {
    console.error(e)
    throw new Error(
      'Please install d3-dsv as a dependency with, e.g. `yarn add d3-dsv@2`'
    )
  }
}
