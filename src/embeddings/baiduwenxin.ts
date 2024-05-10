/******************************
 * 百度文心
 ******************************/
import { EmbeddingsParams } from '@langchain/core/embeddings'

import Debug from 'debug'
import fs from 'fs'
import { Embeddings2 } from './types.js'
import { waitFor } from '../utils/index.js'

const debug = Debug('tms-llm-kit:embeddings:baiduwenxin')

const OAUTH_BASE_URL =
  'https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials'

const CHAT_API_URL =
  'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant'

const EMBEDDING_API_URL =
  'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/embeddings/embedding-v1'
/**
 * 保存最近一次获取的access_token
 */
const ACCESS_TOKEN_FILE = 'access_token.json'

export type ChatInputMessage = {
  role: string
  content: string
}

/**
 *（1）文本数量不超过16
 *（2）每个文本长度不超过 384个token
 *（3）输入文本不能为空，如果为空会报错
 */
export type EmbeddingInput = string[]

export async function createWenxinModel(): Promise<WenxinModel> {
  const { BAIDUWENXIN_API_KEY, BAIDUWENXIN_SECRET_KEY } = process.env
  if (!BAIDUWENXIN_API_KEY || !BAIDUWENXIN_SECRET_KEY)
    throw new Error('没有指定连接参数')

  let accessToken
  if (fs.existsSync(ACCESS_TOKEN_FILE)) {
    let text = fs.readFileSync(ACCESS_TOKEN_FILE)
    let json = JSON.parse(text.toString('utf-8'))
    let { expireAt, access_token } = json
    let now = Date.now() / 1000
    if (now < expireAt - 60) {
      accessToken = access_token
      debug('存在的access_token未过期，继续使用')
    }
  }
  if (!accessToken) {
    let oauthUrl = new URL(OAUTH_BASE_URL)
    oauthUrl.searchParams.append('client_id', BAIDUWENXIN_API_KEY)
    oauthUrl.searchParams.append('client_secret', BAIDUWENXIN_SECRET_KEY)

    let result = await fetch(oauthUrl.toString())

    let { status, statusText } = result
    debug('获取访问凭证返回结果：\n%O', { status, statusText })

    if (status === 200) {
      let data = await result.json()

      let { access_token, expires_in } = data
      data.expireAt = Math.floor(Date.now() / 1000) + expires_in
      fs.writeFileSync(ACCESS_TOKEN_FILE, JSON.stringify(data))

      accessToken = access_token
    } else {
      throw new Error('获取access_token失败，原因：' + statusText)
    }
  }

  const model = new WenxinModel(accessToken)
  return model
}

class WenxinModel {
  constructor(public accessToken: string) {}

  async embedding(input: EmbeddingInput) {
    debug(`准备${input.length}对个文档执行嵌入`)
    let url = `${EMBEDDING_API_URL}?access_token=${this.accessToken}`
    let rsp = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ input }),
    })
    let { status, statusText } = rsp

    debug('Embedding返回结果：\n%O', { status, statusText })

    const json = await rsp.json()
    const { error_code, error_msg, data } = json

    if (error_code) {
      debug('Embedding发生错误：code=%s,msg=%s', error_code, error_msg)
      throw new Error('Embedding发生错误：' + error_msg)
    }

    return data
  }
}

export class BaiduwenxinEmbeddings extends Embeddings2 {
  model: any

  constructor(params?: EmbeddingsParams) {
    super(params ?? {})
  }

  private async getModel() {
    if (!this.model) this.model = await createWenxinModel()
    return this.model
  }

  get maxChunkSize() {
    return 384
  }
  /**
   * （1）文本数量不超过16
   * （2）每个文本长度不超过 384个token
   * （3）输入文本不能为空，如果为空会报错
   * @param documents
   * @returns
   */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    let total = documents.length
    let batch = Math.ceil(total / 16)
    let model = await this.getModel()
    let embeddings: number[][] = []
    for (let i = 0; i < batch; i++) {
      let start = i * 16
      let end = start + 16
      let docs = documents.slice(start, end)
      let result = await model.embedding(docs)
      await waitFor(100)
      if (result && Array.isArray(result)) {
        embeddings.push(...result.map((o: any) => o.embedding))
      } else {
        console.log('数据错误：', result)
      }
    }
    return embeddings
  }

  async embedQuery(doc: string): Promise<number[]> {
    let embeddings = await this.embedDocuments([doc])
    return embeddings[0]
  }
}
