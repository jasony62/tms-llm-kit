import { CallbackManagerForLLMRun } from 'langchain/callbacks'
import {
  BaseChatModel,
  BaseChatModelParams,
} from '@langchain/core/language_models/chat_models'
import { AIMessage, BaseMessage, ChatMessage } from '@langchain/core/messages'
import { ChatGeneration, ChatResult } from '@langchain/core/outputs'
import { createHmac } from 'crypto'
import WebSocket from 'ws'

import Debug from 'debug'

const debug = Debug('chat_models:xunfeispark')

export type SparkMessageRole = 'assistant' | 'user'

interface SparkMessage {
  role: SparkMessageRole
  content: string
}

declare interface XunfeiSparkChatInput {
  /**
   * API key to use when making requests. Defaults to the value of
   * `XUNFEI_API_KEY` environment variable.
   */
  xunfeiApiKey?: string

  /**
   * Secret key to use when making requests. Defaults to the value of
   * `XUNFEI_SECRET_KEY` environment variable.
   */
  xunfeiSecretKey?: string

  /**
   * 连接讯飞星火api的appid参数
   * `XUNFEI_APP_ID` environment variable.
   */
  xunfeiAppId?: string
  /**
   * ID of the end-user who made requests.
   */
  userId?: string
  /**
   * api版本
   */
  apiVersion?: string
}

interface TokenUsage {
  question_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

function getEnvironmentVariable(name: string): string | undefined {
  // Certain Deno setups will throw an error if you try to access environment variables
  // https://github.com/hwchase17/langchainjs/issues/1412
  try {
    return typeof process !== 'undefined'
      ? // eslint-disable-next-line no-process-env
        process.env?.[name]
      : undefined
  } catch (e) {
    return undefined
  }
}

function extractGenericMessageCustomRole(message: ChatMessage) {
  if (message.role !== 'assistant' && message.role !== 'user') {
    console.warn(`Unknown message role: ${message.role}`)
  }

  return message.role as SparkMessageRole
}

function messageToSparkRole(message: BaseMessage): SparkMessageRole {
  const type = message._getType()
  switch (type) {
    case 'ai':
      return 'assistant'
    case 'human':
      return 'user'
    case 'system':
      throw new Error('System messages not supported')
    case 'function':
      throw new Error('Function messages not supported')
    case 'generic': {
      if (!ChatMessage.isInstance(message))
        throw new Error('Invalid generic chat message')
      return extractGenericMessageCustomRole(message)
    }
    default:
      throw new Error(`Unknown message type: ${type}`)
  }
}

export class ChatXunfeiSpark extends BaseChatModel {
  xunfeiApiKey?: string

  xunfeiSecretKey?: string

  xunfeiAppId?: string

  apiVersion = 'v2.1'

  userId?: string

  chatApiUrl: string

  constructor(fields?: Partial<XunfeiSparkChatInput> & BaseChatModelParams) {
    super(fields ?? {})

    this.xunfeiApiKey =
      fields?.xunfeiApiKey ?? getEnvironmentVariable('XUNFEI_API_KEY')
    if (!this.xunfeiApiKey) {
      throw new Error('Xunfei API key not found')
    }

    this.xunfeiSecretKey =
      fields?.xunfeiSecretKey ?? getEnvironmentVariable('XUNFEI_SECRET_KEY')
    if (!this.xunfeiSecretKey) {
      throw new Error('Xunfei Secret key not found')
    }

    this.xunfeiAppId =
      fields?.xunfeiAppId ?? getEnvironmentVariable('XUNFEI_APP_ID')
    if (!this.xunfeiAppId) {
      throw new Error('Xunfei AppID not found')
    }

    this.apiVersion = fields?.apiVersion ?? this.apiVersion

    this.chatApiUrl = `wss://spark-api.xf-yun.com/${this.apiVersion}/chat`

    this.userId = fields?.userId ?? this.userId
  }

  makeAuthorization(
    method: string,
    hostname: string,
    pathname: string,
    date: string
  ) {
    // 利用上方的date动态拼接生成字符串tmp，这里以星火url为例，实际使用需要根据具体的请求url替换host和path。
    let tmp = `host: ${hostname}\n`
    tmp += `date: ${date}\n`
    tmp += `${method} ${pathname} HTTP/1.1`

    // 利用hmac-sha256算法结合APISecret对上一步的tmp签名
    const hmac = createHmac('sha256', this.xunfeiSecretKey ?? '')
    hmac.update(tmp)
    let tmpsha = hmac.digest()

    // 将上方的tmp_sha进行base64编码生成signature
    let signature = tmpsha.toString('base64')

    // 利用上面生成的signature，拼接下方的字符串生成authorization_origin
    let authorization_origin = `api_key="${this.xunfeiApiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`

    // 最后再将上方的authorization_origin进行base64编码,生成最终的authorization
    let authorization = Buffer.from(authorization_origin, 'utf-8').toString(
      'base64'
    )

    return authorization
  }

  makeApiFullUrl(baseUrl: URL, method = 'GET'): string {
    let { hostname, pathname } = baseUrl

    let date = new Date().toUTCString()
    let authorization = this.makeAuthorization(method, hostname, pathname, date)

    let url = new URL(baseUrl)
    url.searchParams.set('authorization', authorization)
    url.searchParams.set('date', date)
    url.searchParams.set('host', hostname)

    let url2 = url.toString()

    return url2
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const messagesMapped: SparkMessage[] = messages.map((message) => ({
      role: messageToSparkRole(message),
      content: message.text,
    }))

    let url = this.makeApiFullUrl(new URL(this.chatApiUrl))
    const ws = new WebSocket(url)

    let input = {
      header: {
        app_id: this.xunfeiAppId,
        uid: this.userId,
      },
      parameter: {
        chat: {
          domain: 'generalv2',
          temperature: 0.1,
          max_tokens: 1024,
        },
      },
      payload: {
        message: {
          text: messagesMapped,
        },
      },
    }
    return new Promise((resolve) => {
      let text = ''
      let tokenUsage: TokenUsage

      ws.on('error', console.error)

      ws.on('open', function open() {
        ws.send(JSON.stringify(input))
      })

      ws.on('message', (data: any) => {
        let result = JSON.parse(data)
        let { payload } = result
        if (payload) {
          let { choices, usage } = payload
          if (Array.isArray(choices.text) && choices.text.length) {
            text += choices?.text[0].content
          }
          tokenUsage = usage?.text
        }
      })

      ws.on('close', function close() {
        const generations: ChatGeneration[] = []

        generations.push({
          text,
          message: new AIMessage(text),
        })
        resolve({
          generations,
          llmOutput: { tokenUsage },
        })
      })
    })
  }
  _combineLLMOutput?(
    ...llmOutputs: (Record<string, any> | undefined)[]
  ): Record<string, any> | undefined {
    return []
  }
  _llmType(): string {
    return 'xunfeispark'
  }
}
