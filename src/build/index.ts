import { TmwCollectionLoader } from '../document_loaders/web/tmw.js'
import { MongodbCollectionLoader } from '../document_loaders/db/mongodb.js'
import { createStorer } from './store.js'
import { Document } from 'langchain/document'
/**
 * 从tmw获取素材构造数据库
 *
 * @param tmwUrl
 * @param accessToken
 * @param vecFields
 * @param metaFields
 */
export async function buildFromTmw(
  tmwUrl: string,
  accessToken: string,
  vecFields: string[] | string,
  metaFields: string[] | string,
  storePath?: string,
  modelName?: string,
  options?: any
): Promise<Document[]> {
  let loader = new TmwCollectionLoader(
    tmwUrl,
    accessToken,
    vecFields,
    metaFields
  )

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
 * @param vecFields
 * @param metaFields
 * @param storePath
 * @param modelName
 * @param options
 * @returns
 */
export async function buildFromMongo(
  url: string,
  dbName: string,
  clName: string,
  vecFields: string[] | string,
  metaFields: string[] | string,
  storePath?: string,
  modelName?: string,
  options?: any
): Promise<Document[]> {
  const loader = new MongodbCollectionLoader(
    url,
    dbName,
    clName,
    vecFields,
    metaFields
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
