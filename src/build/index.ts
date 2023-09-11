import { TmwCollectionLoader } from '../document_loaders/web/tmw.js'
import { createStorer } from './store.js'
import { Document } from 'langchain/document'
/**
 * 从tmw获取素材构造数据库
 *
 * @param tmwUrl
 * @param accessToken
 * @param vecField
 * @param metaField
 */
export async function buildFromTmw(
  tmwUrl: string,
  accessToken: string,
  vecField: string,
  metaField: string,
  storePath?: string,
  modelName?: string,
  options?: any
): Promise<Document<Record<string, any>>[]> {
  let loader = new TmwCollectionLoader(tmwUrl, accessToken, vecField, metaField)

  const docs = await loader.load()
  if (storePath && modelName) {
    let { chunkSize, chunkOverlap } = options ?? {}
    await createStorer(modelName, storePath).store(docs, {
      chunkSize,
      chunkOverlap,
    })
  }

  return docs
}
