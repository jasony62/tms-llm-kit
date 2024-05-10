import { ChatBaiduWenxin } from '@langchain/community/chat_models/baiduwenxin'
import { RetrievePipeline } from '../pipeline.js'
import { ChatXunfeiSpark } from '../../chat_models/xunfeispark.js'
import { Document } from 'langchain/document'
import { PromptTemplate } from '@langchain/core/prompts'
import { LLMChain } from 'langchain/chains'

import Debug from 'debug'
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi'

const debug = Debug('tms-llm-kit:retrieve:pipeline:llmanswer')

interface LLMAnswerOptions {
  modelName?: string
  verbose?: boolean
}
/**
 * 语言大模型生成回复
 */
export class LLMAnswer extends RetrievePipeline {
  modelName
  verbose = false
  constructor(public question: string, options?: LLMAnswerOptions) {
    super()
    this.verbose = options?.verbose === true
    this.modelName = options?.modelName
  }

  baiduwenxin() {
    const { BAIDUWENXIN_API_KEY, BAIDUWENXIN_SECRET_KEY } = process.env
    const llm = new ChatBaiduWenxin({
      baiduApiKey: BAIDUWENXIN_API_KEY,
      baiduSecretKey: BAIDUWENXIN_SECRET_KEY,
      temperature: 0.5,
    })
    return llm
  }

  alibaba_tongyi() {
    const { ALIBABA_TONGYI_APIKEY } = process.env
    const llm = new ChatAlibabaTongyi({
      alibabaApiKey: ALIBABA_TONGYI_APIKEY,
    })
    return llm
  }

  xunfeispark() {
    const { XUNFEISPARK_API_KEY, XUNFEISPARK_SECRET_KEY, XUNFEISPARK_APP_ID } =
      process.env
    const llm = new ChatXunfeiSpark({
      xunfeiApiKey: XUNFEISPARK_API_KEY,
      xunfeiSecretKey: XUNFEISPARK_SECRET_KEY,
      xunfeiAppId: XUNFEISPARK_APP_ID,
    })
    return llm
  }
  /**
   *
   * @param documents
   * @returns
   */
  async run(documents?: Document[]): Promise<Document[]> {
    debug(`指定了${documents?.length ?? 0}个文档作为背景资料`)
    if (Array.isArray(documents) && documents.length) {
      /**
       * 让llm生成答案
       */
      let llm
      switch (this.modelName) {
        case 'baiduwenxin':
          llm = this.baiduwenxin()
          break
        case 'xunfeispark':
          llm = this.xunfeispark()
          break
        case 'alibaba_tongyi':
          llm = this.alibaba_tongyi()
          break
        default:
          debug(`不支持的语言大模型：${this.modelName}`)
      }

      if (llm) {
        debug('开始通过大模型生成回答')
        const prompt = PromptTemplate.fromTemplate(
          '根据给出的资料，回答用户的问题，必须符合用户对答案的要求。\n资料：{stuff}\n\n问题：{question}'
        )
        const chain = new LLMChain({
          llm,
          prompt,
          verbose: this.verbose,
        })
        let stuff = documents.map((doc) => doc.pageContent).join('\n')
        const answer = await chain.call({ stuff, question: this.question })

        return [new Document({ pageContent: answer.text })]
      }
    }

    return []
  }
}
