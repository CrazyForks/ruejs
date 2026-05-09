import { extend } from '@rue-js/shared'
import {
  type SidebarSection,
  createPersistentSidebarPlayground,
} from './persistentSidebarPlayground'

const withDesignHrefs = (sections: SidebarSection[]): SidebarSection[] => {
  return sections.map(section =>
    extend(section, {
      items: section.items.map(item => {
        if (item.href || item.children?.length) {
          return item
        }
        return extend(item, { href: `/design/${item.id}` })
      }),
    }),
  )
}

export const SECTIONS_BY_TYPE: Record<'design', SidebarSection[]> = {
  design: withDesignHrefs([
    {
      id: 'design1',
      title: '操作 Actions',
      items: [
        {
          id: 'button',
          title: '按钮 Button',
          href: '/design/button',
        },
        {
          id: 'typography',
          title: '排版 Typography',
          href: '/design/typography',
        },
        {
          id: 'dropdown',
          title: '下拉菜单 Dropdown',
        },
        {
          id: 'fab',
          title: '悬浮操作按钮 FAB',
        },
        {
          id: 'modal',
          title: '模态框 Modal',
        },
        {
          id: 'swap',
          title: '切换 Swap',
        },
        {
          id: 'theme-controller',
          title: '主题控制器 Theme Controller',
        },
      ],
    },
    {
      id: 'design2',
      title: '数据展示 Data Display',
      items: [
        {
          id: 'accordion',
          title: '手风琴 Accordion',
          href: '/design/accordion',
        },
        {
          id: 'avatar',
          title: '头像 Avatar',
          href: '/design/avatar',
        },
        {
          id: 'badge',
          title: '徽标 Badge',
          href: '/design/badge',
        },
        {
          id: 'card',
          title: '卡片 Card',
          href: '/design/card',
        },
        {
          id: 'carousel',
          title: '轮播 Carousel',
          href: '/design/carousel',
        },
        {
          id: 'chat',
          title: '聊天气泡 Chat',
          href: '/design/chat',
        },
        {
          id: 'collapse',
          title: '折叠面板 Collapse',
          href: '/design/collapse',
        },
        {
          id: 'countdown',
          title: '倒计时 Countdown',
          href: '/design/countdown',
        },
        {
          id: 'diff',
          title: '对比 Diff',
          href: '/design/diff',
        },
        {
          id: 'hover-3d',
          title: '悬浮 3D 卡片 Hover 3D',
          href: '/design/hover-3d',
        },
        {
          id: 'hover-gallery',
          title: '悬浮画廊 Hover Gallery',
          href: '/design/hover-gallery',
        },
        {
          id: 'kbd',
          title: '键盘提示 Kbd',
          href: '/design/kbd',
        },
        {
          id: 'list',
          title: '列表 List',
          href: '/design/list',
        },
        {
          id: 'stat',
          title: '统计 Stat',
          href: '/design/stat',
        },
        {
          id: 'status',
          title: '状态 Status',
          href: '/design/status',
        },
        {
          id: 'table',
          title: '表格 Table',
          href: '/design/table',
        },
        {
          id: 'text-rotate',
          title: '文本轮播 Text Rotate',
          href: '/design/text-rotate',
        },
        {
          id: 'timeline',
          title: '时间线 Timeline',
          href: '/design/timeline',
        },
      ],
    },
    {
      id: 'design3',
      title: '导航 Navigation',
      items: [
        {
          id: 'breadcrumbs',
          title: '面包屑 Breadcrumbs',
          href: '/design/breadcrumbs',
        },
        {
          id: 'dock',
          title: '底部导航 Dock',
          href: '/design/dock',
        },
        {
          id: 'link',
          title: '链接 Link',
          href: '/design/link',
        },
        {
          id: 'menu',
          title: '菜单 Menu',
          href: '/design/menu',
        },
        {
          id: 'navbar',
          title: '导航栏 Navbar',
        },
        {
          id: 'pagination',
          title: '分页 Pagination',
        },
        {
          id: 'steps',
          title: '步骤 Steps',
        },
        {
          id: 'tabs',
          title: '选项卡 Tabs',
          href: '/design/tabs',
        },
      ],
    },
    {
      id: 'design4',
      title: '反馈 Feedback',
      items: [
        {
          id: 'alert',
          title: '提示 Alert',
          href: '/design/alert',
        },
        {
          id: 'loading',
          title: '加载 Loading',
        },
        {
          id: 'progress',
          title: '进度条 Progress',
        },
        {
          id: 'radial-progress',
          title: '环形进度 Radial Progress',
        },
        {
          id: 'skeleton',
          title: '骨架屏 Skeleton',
        },
        {
          id: 'toast',
          title: '轻提示 Toast',
        },
        {
          id: 'tooltip',
          title: '工具提示 Tooltip',
        },
      ],
    },
    {
      id: 'design5',
      title: '数据输入 Data Input',
      items: [
        {
          id: 'calendar',
          title: '日历 Calendar',
          href: '/design/calendar',
        },
        {
          id: 'checkbox',
          title: '复选框 Checkbox',
        },
        {
          id: 'fieldset',
          title: '字段集 Fieldset',
        },
        {
          id: 'file-input',
          title: '文件输入 File Input',
        },
        {
          id: 'filter',
          title: '筛选器 Filter',
        },
        {
          id: 'label',
          title: '标签 Label',
        },
        {
          id: 'radio',
          title: '单选框 Radio',
        },
        {
          id: 'range',
          title: '范围选择 Range',
        },
        {
          id: 'rating',
          title: '评分 Rating',
        },
        {
          id: 'select',
          title: '选择器 Select',
        },
        {
          id: 'input',
          title: '输入框 Input',
        },
        {
          id: 'textarea',
          title: '文本域 Textarea',
        },
        {
          id: 'toggle',
          title: '开关 Toggle',
        },
        {
          id: 'validator',
          title: '校验器 Validator',
        },
      ],
    },
    {
      id: 'design6',
      title: '布局 Layout',
      items: [
        {
          id: 'divider',
          title: '分隔线 Divider',
          href: '/design/divider',
        },
        {
          id: 'drawer',
          title: '抽屉侧边栏 Drawer',
        },
        {
          id: 'footer',
          title: '页脚 Footer',
          href: '/design/footer',
        },
        {
          id: 'hero',
          title: '主视觉区 Hero',
        },
        {
          id: 'indicator',
          title: '指示器 Indicator',
        },
        {
          id: 'join',
          title: '组合项 Join',
        },
        {
          id: 'mask',
          title: '蒙版 Mask',
        },
        {
          id: 'stack',
          title: '堆叠 Stack',
        },
      ],
    },
    {
      id: 'design7',
      title: '样机 Mockup',
      items: [
        {
          id: 'mockup-browser',
          title: '浏览器样机 Mockup Browser',
        },
        {
          id: 'mockup-code',
          title: '代码样机 Mockup Code',
        },
        {
          id: 'mockup-phone',
          title: '手机样机 Mockup Phone',
        },
        {
          id: 'mockup-window',
          title: '窗口样机 Mockup Window',
        },
      ],
    },
  ]),
}

export default createPersistentSidebarPlayground({
  sections: SECTIONS_BY_TYPE.design,
})
