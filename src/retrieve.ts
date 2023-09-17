import 'dotenv/config'
import { program } from 'commander'
import fs from 'fs'
import { runPerset } from './retrieve/perset.js'
import { parseJsonOptions } from './utils/index.js'

program.requiredOption('--store <directory>', '向量数据库的存储位置')
program.requiredOption(
  '--model <model>',
  '使用的模型名称，支持：baiduwenxin和xunfeispark'
)
program.option('--text <text>', '要在向量数据库中检索的文本')
program.option('--num-retrieve <numRetrieve>', '返回匹配文档的数量', '1')
program.option(
  '--perset <perset>',
  '预制检索模式，支持：vector-doc，assoc-doc，feed-llm，meta-vector-doc，meta-assoc-doc'
)
program.option(
  '--filter <filter>',
  '向量数据库文档元数据筛选条件',
  parseJsonOptions
)
program.option(
  '--assoc-match <assocMatch...>',
  '向量数据库中搜索的文档作为关联数据库搜索时匹配条件的字段，空格分隔多个字段'
)
program.option(
  '--assoc-filter <assocFilter>',
  '关联文档搜索时要匹配的条件，JSON格式',
  parseJsonOptions
)
program.option('--as-doc <asDoc...>', '作为文档处理的字段。')
program.option('--retrieve-object', '作为文档处理的字段。')
program.option('--as-meta <asMeta...>', '作为元数据处理的字段。')

program.parse()
const options = program.opts()

const { store, model, text } = options

// if (!text) {
//   console.log(`没有指定要检索的文本`)
//   process.exit(0)
// }

if (!fs.existsSync(store)) {
  console.log(`指定的向量数据库【${store}】不存在`)
  process.exit(0)
}

let result = await runPerset(options.perset, options, text, model)

console.log('返回的答案：\n%s', JSON.stringify(result, null, 2))
