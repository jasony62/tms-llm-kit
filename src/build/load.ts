import { BaseDocumentLoader } from 'langchain/document_loaders/base'
import { reviseJPArray } from '../utils/index.js'

/**
 *
 */
export async function runLoad(LoaderType: string, options: any) {
  let { asVec, asMeta, file: FilePath, url } = options

  if (asVec) asVec = reviseJPArray(asVec)
  if (asMeta) asMeta = reviseJPArray(asMeta)

  let loader: BaseDocumentLoader | undefined
  switch (LoaderType) {
    case 'json':
      {
        const { JSONLoader } = await import('../document_loaders/fs/json.js')
        loader = new JSONLoader(FilePath, asVec, asMeta)
      }
      break
    case 'csv':
      {
        const { CSVLoader } = await import('../document_loaders/fs/csv.js')
        loader = new CSVLoader(FilePath, asVec, asMeta)
      }
      break
    case 'wikijs':
      {
        const { WikijsPageLoader } = await import(
          '../document_loaders/web/wikijs.js'
        )
        const wikijsApiKey = process.env.WIKIJS_API_KEY
        if (url && wikijsApiKey) {
          loader = new WikijsPageLoader(url, wikijsApiKey, asVec, asMeta)
        }
      }
      break
    case 'tmw':
      {
        const { TmwCollectionLoader } = await import(
          '../document_loaders/web/tmw.js'
        )
        const tmwAccessToken = process.env.TMW_ACCESS_TOKEN
        if (url && tmwAccessToken) {
          loader = new TmwCollectionLoader(url, tmwAccessToken, asVec, asMeta)
        }
      }
      break
    case 'mongodb':
      {
        const { MongodbCollectionLoader } = await import(
          '../document_loaders/db/mongodb.js'
        )
        const { dbName, clName } = options
        if (url && dbName && clName) {
          loader = new MongodbCollectionLoader(
            url,
            dbName,
            clName,
            asVec,
            asMeta
          )
        }
      }
      break
  }

  if (!loader) {
    console.log('创建加载器失败')
    throw new Error('创建加载器失败')
  }

  const docs = await loader.load()

  return { docs, loader }
}
