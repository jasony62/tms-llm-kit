import { Document } from 'langchain/document'

/**
 *
 */
export interface MetaFilter {
  [pointer: string]: any
}
/**
 * 数据检索服务中的搜索器
 */
export interface RetrieveService {
  /**
   *
   * @param query 检索内容
   * @param k 返回匹配的数量
   * @param filter 结果过滤条件
   */
  similaritySearch(
    query: string,
    k: number,
    filter?: (doc: Document<Record<string, any>>) => boolean
  ): Promise<Document[]>
  /**
   *
   * @param filter
   * @param options
   */
  metadataSearch(filter: MetaFilter, options: any): Promise<Document[]>
}
