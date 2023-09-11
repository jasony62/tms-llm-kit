import { TmwCollectionLoader } from '../document_loaders/web/tmw.js'
import { MongodbCollectionLoader } from '../document_loaders/db/mongodb.js'
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
): Promise<Document[]> {
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
/**
 * 从mongodb中获取素材
 * @param url
 * @param dbName
 * @param clName
 * @param vecField
 * @param metaField
 * @param storePath
 * @param modelName
 * @param options
 * @returns
 */
export async function buildFromMongo(
  url: string,
  dbName: string,
  clName: string,
  vecField: string,
  metaField: string,
  storePath?: string,
  modelName?: string,
  options?: any
): Promise<Document[]> {
  const loader = new MongodbCollectionLoader(
    url,
    dbName,
    clName,
    vecField,
    metaField
  )
  const docs = await loader.load()

  if (storePath && modelName) {
    let { chunkSize, chunkOverlap } = options ?? {}
    await createStorer(modelName, storePath).store(
      docs,
      {
        chunkSize,
        chunkOverlap,
      },
      loader
    )
  }

  return docs
}
