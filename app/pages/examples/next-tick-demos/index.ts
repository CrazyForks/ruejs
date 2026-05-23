import { type FC } from '@rue-js/rue'
import ChatScrollDemo from './ChatScrollDemo'
import chatScrollSource from './ChatScrollDemo.tsx?raw'
import DomReadDemo from './DomReadDemo'
import domReadSource from './DomReadDemo.tsx?raw'
import FilterFocusDemo from './FilterFocusDemo'
import filterFocusSource from './FilterFocusDemo.tsx?raw'
import FocusErrorFieldDemo from './FocusErrorFieldDemo'
import focusErrorFieldSource from './FocusErrorFieldDemo.tsx?raw'
import ModalMeasureListDemo from './ModalMeasureListDemo'
import modalMeasureListSource from './ModalMeasureListDemo.tsx?raw'
import PanelMeasureDemo from './PanelMeasureDemo'
import panelMeasureSource from './PanelMeasureDemo.tsx?raw'
import TableFilterScrollDemo from './TableFilterScrollDemo'
import tableFilterScrollSource from './TableFilterScrollDemo.tsx?raw'

export type NextTickScenario = {
  title: string
  summary: string
  businessCases: string[]
  source: string
  Demo: FC
}

export const retainedScenarios: NextTickScenario[] = [
  {
    title: '读取最新 DOM 文本',
    summary: '基础场景：状态更新后同步读 DOM 会拿到旧值，await nextTick() 后才是最新文本。',
    businessCases: ['基础认知', '调试刷新顺序', 'DOM 同步读取'],
    source: domReadSource,
    Demo: DomReadDemo,
  },
]

export const businessScenarios: NextTickScenario[] = [
  {
    title: '消息流自动滚动',
    summary: '新增聊天、订单轨迹或系统通知后，等待列表完成渲染，再滚动到最底部。',
    businessCases: ['客服聊天', '订单时间线', '系统日志'],
    source: chatScrollSource,
    Demo: ChatScrollDemo,
  },
  {
    title: '打开面板后自动聚焦',
    summary: '搜索弹层、筛选抽屉、编辑表单打开后，要在 DOM 挂载完成后再 focus 输入框。',
    businessCases: ['高级筛选', '搜索抽屉', '新增表单'],
    source: filterFocusSource,
    Demo: FilterFocusDemo,
  },
  {
    title: '展开后测量高度',
    summary: '手风琴、详情抽屉展开后，需要在布局刷新完成后测量高度以驱动滚动和动画。',
    businessCases: ['订单详情', '商品详情', '折叠面板'],
    source: panelMeasureSource,
    Demo: PanelMeasureDemo,
  },
  {
    title: '表格筛选后滚到首条结果',
    summary: '切换订单筛选条件后，等待表格结果刷新，再自动滚到新的首条命中记录。',
    businessCases: ['风控台账', '售后列表', '工单筛选'],
    source: tableFilterScrollSource,
    Demo: TableFilterScrollDemo,
  },
  {
    title: '提交后聚焦错误字段',
    summary: '表单提交后，等错误样式和提示渲染完成，再自动 focus 第一个错误输入框。',
    businessCases: ['开户表单', '地址编辑', '审批提单'],
    source: focusErrorFieldSource,
    Demo: FocusErrorFieldDemo,
  },
  {
    title: '弹窗打开后测量列表高度',
    summary: '批量发送或通知弹窗打开后，等列表挂载完成，再测量高度决定布局策略。',
    businessCases: ['消息中心', '批量通知', '营销弹窗'],
    source: modalMeasureListSource,
    Demo: ModalMeasureListDemo,
  },
]
