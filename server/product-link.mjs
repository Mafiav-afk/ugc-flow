const decode = (value = '') => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim()
const meta = (html, key) => decode(html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'))?.[1] || '')
const absolute = (value, base) => { try { return value ? new URL(value, base).toString() : '' } catch { return '' } }
export function parseProductPage(html, sourceUrl) {
  const name = meta(html, 'og:title') || meta(html, 'twitter:title') || decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '')
  const sellingPoints = meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description')
  const image = absolute(meta(html, 'og:image') || meta(html, 'twitter:image'), sourceUrl)
  return { url: sourceUrl, name: name.slice(0, 180), sellingPoints: sellingPoints.slice(0, 800), image }
}
export async function resolveProductLink(value, signal) {
  let url; try { url = new URL(value) } catch { throw new Error('请输入有效的产品链接') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('产品链接必须使用 http/https')
  if (/^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1\]?)/i.test(url.hostname)) throw new Error('产品链接不能指向本机或内网地址')
  const response = await fetch(url, { signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 UGC-Flow/1.3', accept: 'text/html,application/xhtml+xml' } })
  if (!response.ok) throw new Error(`产品页面读取失败 (${response.status})`)
  const result = parseProductPage((await response.text()).slice(0, 2_000_000), response.url)
  if (!result.name && !result.sellingPoints && !result.image) throw new Error('页面未提供可识别的商品信息，请手动填写并上传参考图')
  return result
}
