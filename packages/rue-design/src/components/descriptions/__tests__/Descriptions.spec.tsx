import { afterEach, describe, expect, it } from 'vitest'
import { render, setReactiveScheduling } from '@rue-js/rue'
import { mountContainer, waitForContent } from '../../../../../runtime/__tests__/page-test-utils'
import Descriptions from '../index'

setReactiveScheduling('sync')

const initialViewportWidth = window.innerWidth
const mountedContainers: HTMLDivElement[] = []

const mountTestContainer = () => {
  const container = mountContainer()
  mountedContainers.push(container)
  return container
}

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

afterEach(() => {
  for (const container of mountedContainers) {
    render(null as any, container)
  }
  mountedContainers.length = 0
  document.body.innerHTML = ''
  setViewportWidth(initialViewportWidth)
})

describe('Descriptions', () => {
  it('renders items with bordered rows and fills the last row span', async () => {
    const container = mountTestContainer()

    render(
      <Descriptions
        bordered
        column={3}
        items={[
          { key: 'status', label: 'Status', children: 'Running' },
          { key: 'owner', label: 'Owner', children: 'Mina', span: 2 },
          { key: 'address', label: 'Address', children: 'Shanghai HQ' },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      expect(container.innerHTML).toContain('data-rue-descriptions-row-type="horizontal"')
      const rows = container.querySelectorAll('[data-rue-descriptions-row-type="horizontal"]')
      expect(rows).toHaveLength(2)

      const addressContent = container.querySelector(
        '[data-rue-descriptions-item="string:address"][data-rue-descriptions-part="content"]',
      ) as HTMLTableCellElement | null

      expect(container.textContent).toContain('Running')
      expect(container.textContent).toContain('Shanghai HQ')
      expect(addressContent?.colSpan).toBe(5)
    })
  })

  it('supports Descriptions.Item children in vertical mode', async () => {
    const container = mountTestContainer()

    render(
      <Descriptions
        title="Workspace"
        extra={<button className="btn btn-ghost btn-xs">Sync</button>}
        bordered
        layout="vertical"
        column={2}
      >
        <Descriptions.Item label="Project">Nebula</Descriptions.Item>
        <Descriptions.Item label="Owner">Ari</Descriptions.Item>
      </Descriptions>,
      container,
    )

    await waitForContent(() => {
      expect(container.innerHTML).toContain('data-rue-descriptions-row-type="vertical-label"')
      const labelRows = container.querySelectorAll(
        '[data-rue-descriptions-row-type="vertical-label"]',
      )
      const contentRows = container.querySelectorAll(
        '[data-rue-descriptions-row-type="vertical-content"]',
      )
      expect(labelRows).toHaveLength(1)
      expect(contentRows).toHaveLength(1)
      expect(container.textContent).toContain('Workspace')
      expect(container.textContent).toContain('Sync')
      expect(container.textContent).toContain('Nebula')
      expect(container.textContent).toContain('Ari')
    })
  })

  it('renders complex jsx children in plain vertical mode', async () => {
    const container = mountTestContainer()

    render(
      <Descriptions layout="vertical" column={2}>
        <Descriptions.Item label="Headline">Orbit launch week</Descriptions.Item>
        <Descriptions.Item label="Assets">
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-outline badge-sm">KV</span>
            <span className="badge badge-outline badge-sm">Motion</span>
          </div>
        </Descriptions.Item>
      </Descriptions>,
      container,
    )

    await waitForContent(() => {
      expect(container.innerHTML).toContain('data-rue-descriptions-row-type="vertical-label"')
      expect(container.textContent).toContain('Orbit launch week')
      expect(container.textContent).toContain('KV')
      expect(container.textContent).toContain('Motion')
    })
  })

  it('renders label and content from slot-backed Descriptions.Item metadata', async () => {
    const container = mountTestContainer()

    render(
      <Descriptions bordered layout="vertical" column={2}>
        <Descriptions.Item label={<span>Headline</span>}>
          <span>Orbit launch week</span>
        </Descriptions.Item>
        <Descriptions.Item label={<span>Assets</span>}>
          <div className="flex flex-wrap gap-2">
            <span>KV</span>
            <span>Motion</span>
          </div>
        </Descriptions.Item>
      </Descriptions>,
      container,
    )

    await waitForContent(() => {
      expect(container.textContent).toContain('Headline')
      expect(container.textContent).toContain('Assets')
      expect(container.textContent).toContain('Orbit launch week')
      expect(container.textContent).toContain('KV')
      expect(container.textContent).toContain('Motion')
    })
  })

  it('updates responsive column layout after resize', async () => {
    setViewportWidth(520)
    const container = mountTestContainer()

    render(
      <Descriptions
        column={{ xs: 1, md: 2 }}
        items={[
          { key: 'signal', label: 'Signal', children: 'Warm' },
          { key: 'owner', label: 'Owner', children: 'Luna' },
          { key: 'region', label: 'Region', children: 'APAC' },
        ]}
      />,
      container,
    )

    await waitForContent(() => {
      const rows = container.querySelectorAll('[data-rue-descriptions-row-type="horizontal"]')
      expect(rows).toHaveLength(3)
    })

    setViewportWidth(960)

    await waitForContent(() => {
      expect(container.innerHTML).toContain('data-rue-descriptions-row-type="horizontal"')
      const rows = container.querySelectorAll('[data-rue-descriptions-row-type="horizontal"]')
      expect(rows).toHaveLength(2)
    })
  })
})
