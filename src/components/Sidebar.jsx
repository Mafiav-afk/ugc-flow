import { Folder, Home, LayoutTemplate, Link, PanelLeftClose, Play, Rocket } from 'lucide-react'
const items = [['workspace', Home, '工作台'], ['projects', Folder, '项目'], ['templates', LayoutTemplate, '模板'], ['api', Link, 'API 接入'], ['deploy', Rocket, '部署']]
function NavButton({ icon: Icon, label, active, onClick }) { return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon size={18}/><span>{label}</span></button> }
export function Sidebar({ activeView, onNavigate }) { return <aside className="sidebar">
  <button className="brand" onClick={() => onNavigate('workspace')}><span className="brand-mark"><Play fill="currentColor" size={18}/></span><span>UGC Flow</span></button>
  <nav>{items.map(([id, Icon, label]) => <NavButton key={id} icon={Icon} label={label} active={activeView === id} onClick={() => onNavigate(id)}/>)}</nav>
  <div className="sidebar-bottom"><NavButton icon={PanelLeftClose} label="收起" onClick={() => onNavigate('workspace')}/></div>
</aside> }
