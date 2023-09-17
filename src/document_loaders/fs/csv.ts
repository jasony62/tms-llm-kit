import { TextLoader } from 'langchain/document_loaders'
import { Document } from 'langchain/document'
import { DocTransform } from '../../utils/index.js'
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

export class CSVLoader extends TextLoader {
  docTransform: DocTransform
  separator = ','

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
    const { dsvFormat } = await CSVLoaderImports()
    const psv = dsvFormat(this.separator)
    const parsed = psv.parse(raw.trim())

    return parsed.reduce((result, row) => {
      let docs = this.docTransform.exec(row, metabase)
      result.push(...docs)
      return result
    }, [] as Document[])
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
