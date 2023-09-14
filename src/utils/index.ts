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
export function reviceJPArray(arr: string[]): string[] {
  return arr.map((k) => (k.indexOf('/') === 0 ? k : `/${k}`))
}
