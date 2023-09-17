import JSONPointer from 'jsonpointer'
import { Document } from 'langchain/document'

/**
 * 将filter/assocFilter参数转换为对象
 * @param value
 * @returns
 */
export function parseJsonOptions(value: string) {
  let obj = value ? JSON.parse(value) : undefined
  if (!obj || typeof obj !== 'object') return undefined
  return obj
}
/**
 * 将对象的字段名修订为jsonpointer格式
 * 这是一个简化版本，只检查了第一个字符否是为`/`
 *
 * @param obj
 * @returns
 */
export function reviseJPObject(obj: Record<string, any>): Record<string, any> {
  return Object.keys(obj).reduce((f, k) => {
    if (k.indexOf('/') !== 0) f[`/${k}`] = obj[k]
    else f[k] = obj[k]
    return f
  }, {} as Record<string, any>)
}
/**
 * 将数组元素修订为jsonpointer格式
 * @param arr
 */
export function reviseJPArray(arr: string[]): string[] {
  return arr.map((k) => (k.indexOf('/') === 0 ? k : `/${k}`))
}
/**
 * 指定文档中的字段列表参数
 */
export class DocFieldsOption {
  private constructor(
    private _ptNames: string[],
    private _pts: JSONPointer[]
  ) {}

  get ptNames() {
    return this._ptNames
  }

  get pts() {
    return this._pts
  }
  /**
   * 从指定的对象中，根据字段列表生成对象
   * @param rawObj
   */
  extract(rawObj: any, target?: any) {
    if (!rawObj || typeof rawObj !== 'object') return {}

    if (target && target === 'object') {
      this.pts.forEach((pt) => pt.set(target, pt.get(rawObj)))
      return target
    } else {
      return this.pts.reduce((t, pt) => {
        pt.set(t, pt.get(rawObj))
        return t
      }, {} as Record<string, any>)
    }
  }

  static create(data: string | string[] | DocFieldsOption) {
    if (!data) throw Error('没有指定值')
    if (typeof data !== 'string' && (!Array.isArray(data) || data.length === 0))
      throw new Error('无效的向量字段表示')
    const arr = typeof data === 'string' ? data.split(',') : data
    const pts = reviseJPArray(arr)
    const compileed = pts.map((pt) => JSONPointer.compile(pt))
    return new DocFieldsOption(pts, compileed)
  }
}
/**
 * 根据指定的参数将原始数据对象转为langchain文档
 */
export class DocTransform {
  private constructor(
    public vecFields: DocFieldsOption,
    public metaFields?: DocFieldsOption
  ) {}
  /**
   * 执行转换
   *
   * @param rawData 原始数据
   * @param metabase 基础元数据
   * @returns
   */
  public exec(rawData: any, metabase?: Record<string, any>): Document[] {
    return this.vecFields.pts.map((pt, index) => {
      let metadata = this.metaFields?.extract(rawData)
      return new Document({
        pageContent: pt.get(rawData),
        metadata: {
          ...metabase,
          ...metadata,
          _pageContentSource: this.vecFields.ptNames[index],
        },
      })
    })
  }

  static create(asVec: string | string[], asMeta?: string | string[]) {
    const vecFields = DocFieldsOption.create(asVec)
    const metaFields = asMeta?.length
      ? DocFieldsOption.create(asMeta)
      : undefined
    return new DocTransform(vecFields, metaFields)
  }
}
