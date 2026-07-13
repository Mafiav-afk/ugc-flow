const FALLBACK_SHOTS = ['用具体痛点直视镜头开场。','产品完整进入画面并成为答案。','在真实场景说明旧方法的麻烦。','近景完整演示核心动作与物理变化。','在相同条件下展示可验证结果。','补充第二种真实使用方式或适用人群。','快切展示材质、结构、尺寸与收纳。','产品留在画面内，用朋友分享式轻 CTA 结束。']

export function buildDemoStrategy(brief) {
  const replication = brief.replication || {}
  return {
    format: brief.format && brief.format !== '自动匹配最佳格式' ? `${brief.format} · 品类复刻` : '意外发现 · 真实演示',
    mechanism: replication.structure || '用具体痛点制造好奇，让产品演示成为答案，再用可见证据降低疑虑。',
    hook: replication.shots?.[0] || `还在为${brief.sellingPoints?.split(/[，,]/)[0] || '这个问题'}反复折腾？`,
    shots: Array.from({ length: 8 }, (_, index) => replication.shots?.[index] || FALLBACK_SHOTS[index]),
    metrics: ['3 秒留存', '完播率', '分享率', '商品点击率'],
    replication: { templateId: brief.templateId || null, category: brief.category || '通用', sourceType: replication.sourceType || '品类通用结构', variableSlots: replication.variableSlots || ['钩子','场景','第一证明','CTA'] },
  }
}

export function buildDemoProduct(brief) {
  const points = String(brief.sellingPoints || '').split(/[，,、]/).map((item) => item.trim()).filter(Boolean)
  return { summary: `面向${brief.audience || '目标消费者'}的${brief.name}，核心沟通点为${points.slice(0, 3).join('、') || '真实可见的使用价值'}。`, sellingPoints: points, risks: brief.notes ? [brief.notes] : ['所有客观声明需要真实证据支持'] }
}

export const DEMO_ASSET = '/assets/demo-ugc-frame.png'
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
