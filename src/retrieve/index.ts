import jsonpointer from 'jsonpointer'
import { HNSWLib2 } from '../vectorstores/hnswlib.js'
import { Document } from 'langchain/document'
import { ChatBaiduWenxin } from 'langchain/chat_models/baiduwenxin'
import { LLMChain } from 'langchain/chains'
import { PromptTemplate } from 'langchain/prompts'
import { ChatXunfeiSpark } from '../chat_models/xunfeispark.js'

interface PointerFilter {
  [pointer: string]: any
}

abstract class SearchPipeline {
  _next: SearchPipeline | undefined

  constructor(public vectorStore?: HNSWLib2) {}

  abstract run(args: any): Promise<Document<Record<string, any>>[]>

  set next(sibling: SearchPipeline | undefined) {
    this._next = sibling
  }

  get next() {
    return this._next
  }
}

interface SimilaritySearchOptions {
  filter: PointerFilter
  k: number
}

/**
 *
 * @param filter
 * @returns
 */
function compilePointerFilter(
  filter: PointerFilter
): (doc: Document) => boolean {
  const rules = Object.keys(filter).map((k) => {
    let cp = jsonpointer.compile(k)
    return (metadata: any) => {
      return cp.get(metadata) === filter[k]
    }
  })
  const fnFilter = (doc: any) => {
    return rules.every((rule) => rule(doc.metadata))
  }
  return fnFilter
}
/**
 * 相似度搜索
 */
export class SimilaritySearch extends SearchPipeline {
  filter: PointerFilter | undefined

  k = 1

  constructor(vectorStore: HNSWLib2, options?: SimilaritySearchOptions) {
    super(vectorStore)

    if (options?.filter) {
      const { filter } = options
      this.filter = typeof filter === 'string' ? JSON.parse(filter) : filter
    }
    if (options?.k) {
      this.k = +options.k
    }
  }

  /**
   * 执行操作
   * @param text
   * @returns
   */
  async run(text: string): Promise<Document<Record<string, any>>[]> {
    const result = await this.vectorStore?.similaritySearch(
      text,
      this.k,
      this.filter ? compilePointerFilter(this.filter) : undefined
    )
    if (this.next) {
      return await this.next.run(result)
    }

    return result!
  }
}

interface MetadataSearchOptions {
  filter?: PointerFilter
  matchBy?: string[]
  fromNonvecStore?: boolean
}

export class MetadataSearch extends SearchPipeline {
  filter: PointerFilter | undefined

  matchBy: string[] | undefined

  matchByPointers: jsonpointer[] | undefined

  fromNonvecStore = false

  constructor(vectorStore: HNSWLib2, options?: MetadataSearchOptions) {
    super(vectorStore)
    if (options?.filter) {
      const { filter } = options
      this.filter = typeof filter === 'string' ? JSON.parse(filter) : filter
    }
    if (options?.matchBy) {
      this.matchBy = options.matchBy
      this.matchByPointers = options.matchBy.map((p) => jsonpointer.compile(p))
    }
    if (options?.fromNonvecStore === true) {
      this.fromNonvecStore = true
    }
  }
  /**
   *
   * @param args
   * @returns
   */
  async run(
    documents?: Document<Record<string, any>>[]
  ): Promise<Document<Record<string, any>>[]> {
    let result
    if (Array.isArray(documents)) {
      for (let doc of documents) {
        let matcher: PointerFilter = {}
        this.matchByPointers?.forEach((p, index) => {
          if (this.matchBy) matcher[this.matchBy[index]] = p.get(doc.metadata)
        })
        if (this.filter) {
          matcher = {
            ...matcher,
            ...this.filter,
          }
        }
        let docs = await this.vectorStore?.metadataSearch(matcher, {
          fromNonvecStore: this.fromNonvecStore,
        })
        if (docs) {
          if (result) {
            result.push(...docs)
          } else {
            result = docs
          }
        }
      }
    } else if (this.filter) {
      result = await this.vectorStore?.metadataSearch(this.filter, {
        fromNonvecStore: this.fromNonvecStore,
      })
    }

    if (this.next) {
      return await this.next.run(result)
    }
    return result ?? []
  }
}
interface LLMAnswerOptions {
  modelName: string
  verbose: boolean
}
/**
 *
 */
export class LLMAnswer extends SearchPipeline {
  modelName = 'baiduwenxin'
  verbose = false
  constructor(public question: string, options?: LLMAnswerOptions) {
    super()
    if (options?.verbose === true) this.verbose = true
    if (options?.modelName) this.modelName = options.modelName
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
  async run(
    documents?: Document<Record<string, any>>[]
  ): Promise<Document<Record<string, any>>[]> {
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
      }

      if (llm) {
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
