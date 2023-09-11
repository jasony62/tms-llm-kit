import 'dotenv/config'
import { program } from 'commander'
import fs from 'fs'
import { runPerset } from './retrieve/perset.js'

/**
 * 将json格式的参数转为json对象
 * @param value
 * @returns
 */
function parseJsonOption(value: string) {
  return value ? JSON.parse(value) : undefined
}

program.requiredOption('--store <directory>', '向量数据库的存储位置')
program.requiredOption(
  '--model <model>',
  '使用的模型名称，支持：baiduwenxin和xunfeispark'
)
program.option('--text <text>', '要在向量数据库中检索的文本')
program.option('-k <neighbors>', '返回匹配文档的数量', '1')
program.option(
  '--perset <perset>',
  '预制检索模式，支持：vector-doc，nonvec-doc，llm-answer，meta-vector-doc，meta-nonvec-doc'
)
program.option(
  '--filter <filter>',
  '向量数据库文档元数据筛选条件',
  parseJsonOption
)
program.option(
  '--nonvec-match <nvMatch...>',
  '向量数据库中搜索的文档，作为非向量数据库搜索时匹配条件的字段，空格分隔多个字段'
)
program.option(
  '--nonvec-filter <nvFilter>',
  '非向量数据库搜索时要匹配的条件，JSON格式',
  parseJsonOption
)
program.option('--as-doc <asDoc...>', '作为文档处理的字段。')
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
