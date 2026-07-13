import { Clock, FolderOpen, LayoutTemplate, Search, Trash2, X } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { TEMPLATES } from '../constants'
import { TEMPLATE_CATEGORIES } from '../data/merchantTemplates'

export function SidePanel({ view, projects, onClose, onLoadProject, onDeleteProject, onUseTemplate }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())
  if (!['projects', 'templates'].includes(view)) return null
  const isProjects = view === 'projects'
  const visibleTemplates = isProjects ? [] : TEMPLATES.filter((item) => (category === '全部' || item.category === category) && (!deferredQuery || `${item.name}${item.product}${item.tags.join('')}`.toLowerCase().includes(deferredQuery)))
  return <div className="drawer-backdrop" onClick={onClose}><aside className="drawer template-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div>{isProjects ? <FolderOpen/> : <LayoutTemplate/>}<span><strong>{isProjects ? '项目' : '商家带货模板'}</strong><small>{isProjects ? '保存在本机浏览器中的工作记录' : `${TEMPLATES.length} 套 · ${TEMPLATE_CATEGORIES.length - 1} 个品类 · 全结构复刻`}</small></span></div><button aria-label="关闭侧边面板" onClick={onClose}><X/></button></div>
    {!isProjects ? <div className="template-tools"><label><Search size={15}/><input type="search" aria-label="搜索商家模板" placeholder="搜索商品、品类或场景" value={query} onChange={(event) => setQuery(event.target.value)}/></label><div className="category-tabs">{TEMPLATE_CATEGORIES.map((item) => <button className={category === item ? 'selected' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div></div> : null}
    <div className="drawer-list">{isProjects ? projects.length ? projects.map((project) => <article className="drawer-item" key={project.id}><button className="drawer-item-main" onClick={() => onLoadProject(project)}><span className="drawer-icon"><FolderOpen/></span><span><strong>{project.name}</strong><small><Clock size={12}/>{new Date(project.updatedAt).toLocaleString('zh-CN')}</small><p>{project.brief.sellingPoints || '暂无卖点信息'}</p></span></button><button className="delete-project" aria-label={`删除 ${project.name}`} onClick={() => onDeleteProject(project.id)}><Trash2 size={15}/></button></article>) : <div className="drawer-empty"><FolderOpen/><strong>还没有已保存项目</strong><p>完成一次生成后，项目会自动保存到这里。</p></div> : visibleTemplates.length ? visibleTemplates.map((item) => <article className="drawer-item template-item" key={item.id}><button className="drawer-item-main" onClick={() => onUseTemplate(item)}><span className="drawer-icon"><LayoutTemplate/></span><span><span className="template-meta"><b>{item.category}</b>{item.platform.map((platform) => <i key={platform}>{platform}</i>)}</span><strong>{item.name}</strong><p>{item.desc}</p><small>复刻 8 镜头结构 · 点击使用</small></span></button></article>) : <div className="drawer-empty"><LayoutTemplate/><strong>没有匹配模板</strong><p>换一个关键词或品类试试。</p></div>}</div>
  </aside></div>
}
