import { type FC } from '@rue-js/rue'
import ExamplePlayground from './ExamplePlayground'

type HomeSplitExamplePageOptions = {
  title: string
  source: string
  Demo: FC
  codeCardClassName?: string
}

const createHomeSplitExamplePage = (options: HomeSplitExamplePageOptions): FC => {
  const ExamplePage: FC = () => {
    const Demo = options.Demo

    return (
      <ExamplePlayground
        title={options.title}
        source={options.source}
        codeCardClassName={options.codeCardClassName}
      >
        <Demo />
      </ExamplePlayground>
    )
  }

  return ExamplePage
}

export default createHomeSplitExamplePage
