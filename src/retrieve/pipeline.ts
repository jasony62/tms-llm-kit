import jsonpointer from 'jsonpointer'
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

/**
 * 将筛选条件编译为检查规则方法
 *
 * @param filter
 * @returns
 */
export function compilePointerFilter(
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
