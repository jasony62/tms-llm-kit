import { ChatBaiduWenxin } from 'langchain/chat_models/baiduwenxin'
import { ChatXunfeiSpark } from './xunfeispark.js'

/**
 * 连接大模型
 */

const LangModels: any = {}

export function useLangModel(engine: string) {
  if (!engine || typeof engine !== 'string')
    throw new Error('没有指定语言大模型的名称')

  let llm = LangModels[engine]
  if (llm) return llm

  switch (engine) {
    case 'baiduwenxin':
      {
        const { BAIDUWENXIN_API_KEY, BAIDUWENXIN_SECRET_KEY } = process.env
        llm = new ChatBaiduWenxin({
          baiduApiKey: BAIDUWENXIN_API_KEY,
          baiduSecretKey: BAIDUWENXIN_SECRET_KEY,
        })
      }
      break
    case 'xunfeispark':
      {
        const {
          XUNFEISPARK_API_KEY,
          XUNFEISPARK_SECRET_KEY,
          XUNFEISPARK_APP_ID,
        } = process.env
        llm = new ChatXunfeiSpark({
          xunfeiApiKey: XUNFEISPARK_API_KEY,
          xunfeiSecretKey: XUNFEISPARK_SECRET_KEY,
          xunfeiAppId: XUNFEISPARK_APP_ID,
        })
      }
      break
    default:
      throw new Error(`不支持的语言大模型【${engine}】`)
  }

  LangModels[engine] = llm

  return llm
}
