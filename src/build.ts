import 'dotenv/config'
import { program } from 'commander'
import fs from 'fs'
import path from 'path'

import { BaseDocumentLoader } from 'langchain/document_loaders'
import { SynchronousInMemoryDocstore } from 'langchain/stores/doc/in_memory'
import { Document } from 'langchain/document'
import { createStorer } from './build/store.js'

import Debug from 'debug'

const debug = Debug('load')

program.requiredOption('-t, --type <modelName>', '文件类型，json或csv或wikijs')
program.option('-f, --file <file>', '要加载的文件')
program.option('--url <url>', 'wikijs的api地址')
program.option('--as-vec <asVec>', '作为向量处理的字段。')
program.option('--as-doc <asDoc>', '作为文档处理的字段。')
program.option('--as-meta <asMeta>', '作为元数据处理的字段。')
program.option('--store <store>', '向量数据库的存储位置')
program.option(
  '--model <model>',
  '使用的模型名称，支持：baiduwenxin和xunfeispark'
)
program.option('--chunk-size <chunkSize>', '拆分后的文本块大小')
program.option('--chunk-overlap <chunkOverlap>', '拆分后的文本块最大重叠大小')
program.option('--db-name <dbName>', '数据库名称')
program.option('--cl-name <clName>', '集合名称')

program.parse()
const options = program.opts()

const { type: LoaderType, file: FilePath } = options
if (!['json', 'csv', 'wikijs', 'tmw', 'mongodb'].includes(LoaderType)) {
  console.log('没有指定要加载的资料源类型')
  process.exit(0)
}

if (/json|csv/.test(LoaderType)) {
  if (!fs.existsSync(FilePath)) {
    console.log('指定的文件不存在')
    process.exit(0)
  }
}

/**
 * 要进行向量化的资料
 */
const { asVec: VecField, asMeta: MetaField } = options

debug(`加载类型为【${LoaderType}】的数据`)

let loader: BaseDocumentLoader | undefined
let loaderSource: Record<string, any> | false
switch (LoaderType) {
  case 'json':
    const { JSONLoader } = await import('./document_loaders/fs/json.js')
    loader = new JSONLoader(FilePath, VecField, MetaField)
    break
  case 'csv':
    {
      const { CSVLoader } = await import('./document_loaders/fs/csv.js')
      let options = {
        column: VecField ?? undefined,
        meta: MetaField ?? undefined,
      }
      loader = new CSVLoader(FilePath, options)
    }
    break
  case 'wikijs':
    const { WikijsPageLoader } = await import(
      './document_loaders/web/wikijs.js'
    )
    const wikiUrl = options.url
    const wikijsApiKey = process.env.WIKIJS_API_KEY
    if (wikiUrl && wikijsApiKey) {
      loader = new WikijsPageLoader(wikiUrl, wikijsApiKey)
    }
    break
  case 'tmw':
    const { TmwCollectionLoader } = await import(
      './document_loaders/web/tmw.js'
    )
    const tmwUrl = options.url
    const tmwAccessToken = process.env.TMW_ACCESS_TOKEN
    if (tmwUrl && tmwAccessToken) {
      loader = new TmwCollectionLoader(
        tmwUrl,
        tmwAccessToken,
        VecField,
        MetaField
      )
    }
    break
  case 'mongodb':
    const { MongodbCollectionLoader } = await import(
      './document_loaders/db/mongodb.js'
    )
    const { url, dbName, clName } = options
    if (url && dbName && clName) {
      loader = new MongodbCollectionLoader(
        url,
        dbName,
        clName,
        VecField,
        MetaField
      )
    }
    break
}

if (!loader) {
  console.log('创建加载器失败')
  process.exit(0)
}

const docs = await loader.load()
console.log('加载结果：\n', docs)

const { store: StorePath, model: ModelName } = options

if (StorePath && ModelName) {
  let { chunkSize, chunkOverlap } = options
  await createStorer(ModelName, StorePath).store(
    docs,
    {
      chunkSize,
      chunkOverlap,
    },
    LoaderType === 'mongodb' ? loader : undefined
  )
}
/**
 * 要进行文档化的资料
 */
const { asDoc: DocField } = options
if (DocField) {
  switch (LoaderType) {
    case 'json':
      const { JSONLoader } = await import('./document_loaders/fs/json.js')
      loader = new JSONLoader(FilePath, DocField, MetaField)
      break
    case 'csv':
      {
        const { CSVLoader } = await import('./document_loaders/fs/csv.js')
        let options = {
          column: DocField ?? undefined,
          meta: MetaField ?? undefined,
        }
        loader = new CSVLoader(FilePath, options)
      }
      break
  }

  const docs2 = await loader.load()
  console.log('加载结果：\n', docs2)

  let docstore2: SynchronousInMemoryDocstore = new SynchronousInMemoryDocstore()
  const toSave: Record<string, Document> = {}
  for (let i = 0; i < docs2.length; i += 1) {
    toSave[i] = docs2[i]
  }
  docstore2.add(toSave)
  await fs.writeFileSync(
    path.join(StorePath, 'docstore-nonvec.json'),
    JSON.stringify(Array.from(docstore2._docs.entries()))
  )
}
