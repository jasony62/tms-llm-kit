import 'dotenv/config'
import { program } from 'commander'
import fs from 'fs'
import path from 'path'

import { SynchronousInMemoryDocstore } from 'langchain/stores/doc/in_memory'
import { Document } from 'langchain/document'
import { createStorer } from './build/store.js'
import { runLoad } from './build/load.js'

program.requiredOption('-t, --type <modelName>', '文件类型，json或csv或wikijs')
program.option('-f, --file <file>', '要加载的文件')
program.option('--url <url>', 'wikijs的api地址')
program.option(
  '--as-vec <asVec...>',
  '作为向量处理的字段列表，空格分隔多个字段。'
)
program.option(
  '--as-meta <asMeta...>',
  '作为元数据处理的字段，空格分隔多个字段。'
)
program.option(
  '--as-assoc <asAssoc...>',
  '作为文档处理的字段，空格分隔多个字段。'
)
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
const { docs, loader } = await runLoad(LoaderType, options)
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
    ['mongodb', 'wikijs'].includes(LoaderType) ? loader : undefined
  )
}
/**
 * 要进行文档化的资料
 */
const { asAssoc } = options
if (asAssoc && ['json', 'csv'].includes(LoaderType)) {
  let { docs: assocDocs } = await runLoad(LoaderType, {
    ...options,
    asVec: asAssoc,
  })

  console.log('关联文档加载结果：\n', assocDocs)

  let docstore: SynchronousInMemoryDocstore = new SynchronousInMemoryDocstore()
  const toSave: Record<string, Document> = {}
  for (let i = 0; i < assocDocs.length; i += 1) {
    toSave[i] = assocDocs[i]
  }
  docstore.add(toSave)
  await fs.writeFileSync(
    path.join(StorePath, 'docstore-assoc.json'),
    JSON.stringify(Array.from(docstore._docs.entries()))
  )
}
