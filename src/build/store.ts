import { Document } from 'langchain/document'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { HNSWLib } from 'langchain/vectorstores/hnswlib'
import { getEmbedding } from '../embeddings/index.js'
import { BaseDocumentLoader } from 'langchain/document_loaders'
import fs from 'fs'

import Debug from 'debug'

const debug = Debug('tms-llm-kit:build:store')

interface StoreOptions {
  chunkSize: number
  chunkOverlap: number
}
/**
 * 存储文档
 */
export class Store {
  constructor(public modelName: string, public storePath: string) {}

  async store(
    docs: Document[],
    options: StoreOptions,
    loader?: BaseDocumentLoader
  ) {
    const embedding = await getEmbedding(this.modelName)

    if (embedding) {
      debug('获得可用的嵌入工具')
      let { chunkSize, chunkOverlap } = options
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize:
          chunkSize < embedding.maxChunkSize
            ? chunkSize
            : embedding.maxChunkSize,
        chunkOverlap,
        keepSeparator: false,
      })
      const chunks = await splitter.splitDocuments(docs)
      debug(`完成文本分块，共有${chunks.length}个文本块`)

      // Load the docs into the vector store
      const vectorStore = await HNSWLib.fromDocuments(chunks, embedding)

      await vectorStore.save(this.storePath)
      debug('完成创建向量数据库')

      // 保存使用的模型信息
      fs.writeFileSync(
        `${this.storePath}/model.json`,
        JSON.stringify({ name: this.modelName })
      )

      // 保存loader的基本信息
      if (loader) {
        const filepath = `${this.storePath}/loader.json`
        fs.writeFileSync(filepath, JSON.stringify(loader))
      }
    }
  }
}
/**
 * 创建文档向量存储器
 *
 * @param modelName 语言大模型名称
 * @param storePath 向量数据库存储位置
 * @returns
 */
export function createStorer(modelName: string, storePath: string) {
  return new Store(modelName, storePath)
}
