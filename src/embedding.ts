import 'dotenv/config'
import { program } from 'commander'
import { Embeddings } from 'langchain/embeddings'

import Debug from 'debug'

const debug = Debug('embedding')

program.requiredOption(
  '--model <modelName>',
  '大模型名称，baiduwenxin或xunfeispark'
)
program.option('--text <text>', '要执行嵌入的文本')

program.parse()
const options = program.opts()

const ModelName = options.model
if (!['baiduwenxin', 'xunfeispark'].includes(ModelName)) {
  console.log('没有指定使用的模型，请输入：baiduwenxin或xunfeispark')
  process.exit(0)
}
const { text } = options

debug('输入内容：%s', text)

let embedding: Embeddings | undefined

switch (ModelName) {
  case 'baiduwenxin':
    const { BaiduwenxinEmbeddings } = await import(
      './embeddings/baiduwenxin.js'
    )
    embedding = new BaiduwenxinEmbeddings()
    break
  case 'xunfeispark':
    const { XunfeisparkEmbeddings } = await import(
      './embeddings/xunfeispark.js'
    )
    embedding = new XunfeisparkEmbeddings()
    break
}

if (embedding) {
  let result = await embedding.embedQuery(text)
  console.log('返回结果：\n', result)
}
