import type { HNSWLib2 } from '../vectorstores/hnswlib.js'
import type { Document } from 'langchain/document'

import Debug from 'debug'

const debug = Debug('tms-llm-kit:retrieve:pipeline')

export interface PointerFilter {
  [pointer: string]: any
}

export abstract class RetrievePipeline {
  _next: RetrievePipeline | undefined

  constructor(public vectorStore?: HNSWLib2) {}

  abstract run(args: any): Promise<Document<Record<string, any>>[]>

  set next(sibling: RetrievePipeline | undefined) {
    this._next = sibling
  }

  get next() {
    return this._next
  }
}
