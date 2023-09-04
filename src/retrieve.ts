import 'dotenv/config'
import { program } from 'commander'
import fs from 'fs'

import Debug from 'debug'
import { HNSWLib2 } from './vectorstores/hnswlib.js'
import { getEmbedding } from './embeddings/index.js'
import {
  LLMAnswer,
  MetadataSearch,
  SimilaritySearch,
} from './retrieve/index.js'
import { Document } from 'langchain/document'

const debug = Debug('search')

program.option('--store <store>', '向量数据库的存储位置')
program.option(
  '--model <model>',
  '使用的模型名称，支持：baiduwenxin和xunfeispark'
)
program.option('--text <text>', '检索的文本')
program.option('-k <neighbors>', '返回匹配文档的数量', '1')
program.option('--perset <perset>', '预制检索模式')
program.option('--filter <filter>', '文档筛选条件')
program.option('--nonvec-match <nvMatch>', '本地搜索时要匹配的字段，逗号分隔')
program.option('--nonvec-filter <nvFilter>', '本地搜索时要匹配的条件，JSON格式')

program.parse()
const options = program.opts()

const { store: StorePath, model: ModelName } = options

if (!fs.existsSync(StorePath)) {
  console.log(`指定的向量数据库【${StorePath}】不存在`)
  process.exit(0)
}

const embedding = await getEmbedding(ModelName)
/**
 * 从指定的数据库中加载数据
 */
const vectorStore = await HNSWLib2.load(StorePath, embedding)

const { perset } = options
/**
 * 检索条件
 */
const { filter: FilterString } = options
const filter = FilterString ? JSON.parse(FilterString) : undefined

let result: Document<Record<string, any>>[] | undefined
if (perset === 'vector-answer') {
  const { text, k } = options
  let pipeline = new SimilaritySearch(vectorStore, { filter, k })
  result = await pipeline.run(text)
} else if (perset === 'nonvec-answer') {
  const { text, k, nonvecMatch, nonvecFilter: NonvecFilterStr } = options
  const nvFilter = NonvecFilterStr ? JSON.parse(NonvecFilterStr) : undefined
  let pipeline = new SimilaritySearch(vectorStore, { filter, k })
  let pipeline2 = new MetadataSearch(vectorStore, {
    matchBy: nonvecMatch.split(','),
    filter: nvFilter,
    fromNonvecStore: true,
  })
  pipeline.next = pipeline2
  result = await pipeline.run(text)
} else if (perset === 'llm-answer') {
  const { text, k } = options
  let pipeline = new SimilaritySearch(vectorStore, { filter, k })
  let pipeline2 = new LLMAnswer(text)
  pipeline.next = pipeline2
  result = await pipeline.run(text)
} else if (perset === 'metadata') {
  let pipeline = new MetadataSearch(vectorStore, { filter })
  result = await pipeline.run()
} else if (perset === 'nonvec-metadata') {
  let pipeline = new MetadataSearch(vectorStore, {
    filter,
    fromNonvecStore: true,
  })
  result = await pipeline.run()
}

console.log('返回的答案：\n%s', JSON.stringify(result, null, 2))