import { Box, CloudUpload, Image, KeyRound, Sparkles, Video } from 'lucide-react'
import { MERCHANT_TEMPLATES } from './data/merchantTemplates'

export const FORMATS = ['自动匹配最佳格式', '震惊反应 + 演示', '意外发现', 'What worked for me', '通知即笑点', '趋势模板批量克隆', '产品即演示', '产品即游戏', '挑战测试', '具体痛点', '旧方法对比', '看着小但能装', '过程记录']
export const INITIAL_BRIEF = { name: '', category: '', sellingPoints: '', audience: '', scenarios: '', tone: '', format: FORMATS[0], url: '', notes: '', assets: [] }
export const INITIAL_CONFIG = {
  provider: 'compatible', demoMode: true, agentProvider: 'codex', imageSource: 'agent', baseUrl: '', apiKey: '',
  imageProtocol: 'auto', videoProtocol: 'auto', authMode: 'bearer', queryKeyName: 'key',
  imageModel: 'gpt-image-2', imageModels: 'gpt-image-2, gpt-image-1.5, gpt-image-1', videoModel: 'sora-2', videoModels: 'sora-2, sora-2-pro',
  videoProfile: 'sora-2', videoDuration: '12', videoResolution: '720x1280', videoAspectRatio: '9:16', videoMode: '', videoAudio: true, videoReferenceUrl: '', videoReferencePolicy: 'auto-t2v',
  modelsPath: '/models', imagePath: '/images/edits\n/images/generations', imageStatusPath: '/media/status?task_id={id}', videoPath: '/videos', videoStatusPath: '/videos/{id}', videoContentPath: '/videos/{id}/content',
  imageBaseUrl: '', imageApiKey: '', videoBaseUrl: '', videoApiKey: '', imageParamsJson: '', videoParamsJson: '', notifyUrl: '', authHeader: 'Authorization', authPrefix: 'Bearer ',
  referenceUploadUrl: '', referenceUploadProtocol: 'multipart', referenceUploadField: 'file', referenceUploadResponsePath: '', referenceUploadApiKey: '', referenceUploadAuthMode: 'bearer', referenceUploadAuthHeader: '', referenceUploadAuthPrefix: '', referenceUploadPublicUrl: '',
}
export const STAGES = [
  ['商品分析', 'Codex / Claude 调用商家 Skill', Box], ['爆款策略', '使用现有智能体额度生成 8 镜头', Sparkles],
  ['角色参考', '生成真实手机自拍风格角色图', Image], ['产品锁定', '锁定包装文字与产品外观', KeyRound],
  ['视频生成', '合成 8 镜头、15 秒竖屏视频', Video], ['成片', '导出视频与完整提示词', CloudUpload],
]
export const DEFAULT_SHOTS = ['反应钩子：先制造好奇', '产品出现：给出答案', '场景铺垫：具体痛点', '核心演示：功能与物理细节', '效果证明：真实反应', '第二用法：扩展使用场景', '细节快切：质感展示', '轻 CTA：像朋友一样推荐']
export const TEMPLATES = MERCHANT_TEMPLATES
