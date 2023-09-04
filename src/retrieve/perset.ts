import { Document } from 'langchain/document'
import { HNSWLib2 } from '../vectorstores/hnswlib.js'
import { LLMAnswer, MetadataSearch, VectorSearch } from './pipeline.js'
import { getEmbedding } from '../embeddings/index.js'

abstract class RetrievePerset {
  constructor(public name: string, public vectorStore: HNSWLib2) {}

  abstract run(text?: string): Promise<Document<Record<string, any>>[]>
}

class VectorDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('vector-doc', vectorStore)
  }
  async run(text: string): Promise<Document<Record<string, any>>[]> {
    const { filter, k } = this.options
    let pipeline = new VectorSearch(this.vectorStore, { filter, k })
    let result = await pipeline.run(text)
    return result
  }
}

class NonvecDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('nonvec-doc', vectorStore)
  }
  async run(text: string): Promise<Document<Record<string, any>>[]> {
    const { filter, k, nonvecMatch, nonvecFilter: nvFilter } = this.options
    let pipeline = new VectorSearch(this.vectorStore, { filter, k })
    let pipeline2 = new MetadataSearch(this.vectorStore, {
      matchBy: nonvecMatch,
      filter: nvFilter,
      fromNonvecStore: true,
    })
    pipeline.next = pipeline2
    let result = await pipeline.run(text)
    return result
  }
}

class LlmAnswer extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('llm-answer', vectorStore)
  }
  async run(text: string): Promise<Document<Record<string, any>>[]> {
    const { filter, k } = this.options
    let pipeline = new VectorSearch(this.vectorStore, { filter, k })
    let pipeline2 = new LLMAnswer(text)
    pipeline.next = pipeline2
    let result = await pipeline.run(text)
    return result
  }
}

class MetaVectorDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('meta-vector-doc', vectorStore)
  }
  async run(): Promise<Document<Record<string, any>>[]> {
    const { filter } = this.options
    let pipeline = new MetadataSearch(this.vectorStore, { filter })
    let result = await pipeline.run()
    return result
  }
}

class MetaNonvecDoc extends RetrievePerset {
  constructor(vectorStore: HNSWLib2, public options: Record<string, any>) {
    super('meta-nonvec-doc', vectorStore)
  }
  async run(): Promise<Document<Record<string, any>>[]> {
    const { filter } = this.options
    let pipeline = new MetadataSearch(this.vectorStore, {
      filter,
      fromNonvecStore: true,
    })
    let result = await pipeline.run()
    return result
  }
}

export async function runPerset(name: string, options: Record<string, any>) {
  let persetClass: any
  switch (name) {
    case 'vector-doc':
      persetClass = VectorDoc
      break
    case 'nonvec-doc':
      persetClass = NonvecDoc
      break
    case 'llm-answer':
      persetClass = LLMAnswer
      break
    case 'meta-vector-doc':
      persetClass = MetaVectorDoc
      break
    case 'meta-nonvec-doc':
      persetClass = MetaNonvecDoc
      break
  }
  if (!persetClass) throw new Error('指定了无效的预制操作：' + name)

  const embedding = await getEmbedding(options.model)
  /**
   * 从指定的数据库中加载数据
   */
  const vectorStore = await HNSWLib2.load(options.store, embedding)

  const perset = new persetClass(vectorStore, options)

  return await perset.run(options.text)
}
