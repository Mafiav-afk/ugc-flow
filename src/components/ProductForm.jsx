import { ChevronDown, ImagePlus, Trash2, Upload } from 'lucide-react'

export function Field({ label, required, children }) { return <label className="field"><span>{label}{required ? <b> *</b> : null}</span>{children}</label> }
const readFile = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file) })

export function ProductForm({ brief, setBrief, notify }) {
  const update = (key, value) => setBrief((current) => ({ ...current, [key]: value }))
  async function addFiles(event) {
    const files = [...event.target.files], accepted = []
    for (const file of files) {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { notify(`${file.name} 不是支持的图片格式`, 'error'); continue }
      if (file.size > 10 * 1024 * 1024) { notify(`${file.name} 超过 10 MB`, 'error'); continue }
      accepted.push({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type, dataUrl: await readFile(file) })
    }
    if (accepted.length) setBrief((current) => ({ ...current, assets: [...(current.assets || []), ...accepted].slice(0, 4) }))
    event.target.value = ''
  }
  return <section className="product-panel panel"><div className="section-title">产品信息</div><div className="form-body">
    <Field label="产品名称" required><div className="counted-control"><input maxLength={60} value={brief.name} onChange={(event) => update('name', event.target.value)} placeholder="例如：夏季清爽防晒喷雾 SPF50+"/><small>{brief.name.length}/60</small></div></Field>
    <Field label="产品类目"><div className="select-wrap"><select value={brief.category || ''} onChange={(event) => update('category', event.target.value)}><option value="">选择产品类目</option><option>美妆个护 / 防晒</option><option>食品饮料</option><option>家居生活</option><option>母婴宠物</option><option>数码家电</option></select><ChevronDown size={14}/></div></Field>
    <Field label="核心卖点（3–5 个）" required><div className="counted-control"><textarea maxLength={200} value={brief.sellingPoints} onChange={(event) => update('sellingPoints', event.target.value)} placeholder={'SPF50+ PA++++ 高倍防护\n清爽不油腻，快速成膜\n防水防汗，长效防晒'}/><small>{brief.sellingPoints.length}/200</small></div></Field>
    <Field label="目标人群"><div className="counted-control"><input maxLength={100} value={brief.audience} onChange={(event) => update('audience', event.target.value)} placeholder="18–35 岁女性，户外活动、通勤、旅行人群"/><small>{brief.audience.length}/100</small></div></Field>
    <Field label="使用场景"><div className="counted-control"><input maxLength={100} value={brief.scenarios || ''} onChange={(event) => update('scenarios', event.target.value)} placeholder="海边度假、户外运动、日常通勤、军训、旅行"/><small>{(brief.scenarios || '').length}/100</small></div></Field>
    <Field label="品牌调性"><div className="counted-control"><input maxLength={50} value={brief.tone || ''} onChange={(event) => update('tone', event.target.value)} placeholder="清爽、专业、安心、时尚"/><small>{(brief.tone || '').length}/50</small></div></Field>
    <Field label="参考素材（可选）"><label className="upload" htmlFor="asset-upload"><input id="asset-upload" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={addFiles}/><Upload size={16}/><strong>＋ 上传参考素材</strong><small>支持图片，最多 4 个，单个不超过 10 MB</small></label></Field>
    {brief.assets?.length ? <div className="asset-list">{brief.assets.map((asset) => <div className="asset-item" key={asset.id}><span className="asset-thumb">{asset.dataUrl || asset.url ? <img src={asset.dataUrl || asset.url} alt=""/> : <ImagePlus size={16}/>}</span><span><strong>{asset.name}</strong><small>{asset.url ? '链接主图' : `${Math.max(1, Math.round(asset.size / 1024))} KB`}</small></span><button aria-label={`移除 ${asset.name}`} onClick={() => update('assets', brief.assets.filter((item) => item.id !== asset.id))}><Trash2 size={14}/></button></div>)}</div> : null}
  </div></section>
}
