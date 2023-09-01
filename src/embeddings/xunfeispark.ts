/******************************
 * 讯飞星火
 ******************************/
import { createHmac } from 'crypto'
import { EmbeddingsParams } from 'langchain/embeddings/base'
import { Embeddings2 } from './types.js'

import Debug from 'debug'
import { resolve } from 'path'

const debug = Debug('embeddings:xunfeispark')

interface EmbeddingResult {
  header: {
    code: number
    message: string
    sid: string
  }
  payload: {
    text: {
      vector: string
    }
  }
}
/**
 *
 * @returns
 */
export function createSparkModel(): SparkModel {
  let { XUNFEISPARK_SECRET_KEY, XUNFEISPARK_API_KEY, XUNFEISPARK_APP_ID } =
    process.env

  if (!XUNFEISPARK_SECRET_KEY || !XUNFEISPARK_API_KEY || !XUNFEISPARK_APP_ID)
    throw new Error('未提供模型连接参数')

  let model = new SparkModel(
    XUNFEISPARK_SECRET_KEY,
    XUNFEISPARK_API_KEY,
    XUNFEISPARK_APP_ID
  )

  return model
}

class SparkModel {
  private _apiUrl: {
    url: string
    createAt: number
  }

  constructor(
    public secretKey: string,
    public apiKey: string,
    public appId: string
  ) {
    this._apiUrl = { url: '', createAt: 0 }
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
    const hmac = createHmac('sha256', this.secretKey)
    hmac.update(tmp)
    let tmpsha = hmac.digest()

    // 将上方的tmp_sha进行base64编码生成signature
    let signature = tmpsha.toString('base64')

    // 利用上面生成的signature，拼接下方的字符串生成authorization_origin
    let authorization_origin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`

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

  async embedding(text: string) {
    let url
    if (this._apiUrl.url) {
      url = this._apiUrl.url
    } else {
      url = this.makeApiFullUrl(
        new URL(
          'https://knowledge-retrieval.cn-huabei-1.xf-yun.com/v1/aiui/embedding/query'
        ),
        'POST'
      )
      this._apiUrl.url = url
      this._apiUrl.createAt = Date.now()
    }

    const posted = {
      header: {
        app_id: this.appId,
      },
      payload: {
        text,
      },
    }

    const rsp = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(posted),
    })

    const json: EmbeddingResult = await rsp.json()
    if (json.header.code !== 0) {
      debug('操作异常\n%O', json.header)
      throw new Error(json.header.message)
    }
    if (json.payload) {
      let { vector } = json.payload.text
      return JSON.parse(vector)
    } else {
      debug('返回结果异常\n%O', json)
      throw new Error('[embedding:xunfeispark] 请求返回结果异常')
    }
  }
}

async function waitFor(ms: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true)
    }, ms)
  })
}

export class XunfeisparkEmbeddings extends Embeddings2 {
  /**
   *
   */
  _model: SparkModel | undefined

  constructor(params?: EmbeddingsParams) {
    super(params ?? {})
  }

  private async getModel(): Promise<SparkModel> {
    if (!this._model) this._model = await createSparkModel()
    return this._model
  }

  get maxChunkSize() {
    return 256
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    let vectors = []
    let i = 0
    for (let doc of documents) {
      let vector = await this.embedQuery(doc)
      if (vector) {
        vectors.push(vector)
        debug(`完成第个【${++i}】文档`)
        await waitFor(50)
      }
    }
    return vectors
  }

  async embedQuery(document: string): Promise<number[]> {
    const model = await this.getModel()
    let vector = await model.embedding(document)
    return vector
  }
}
