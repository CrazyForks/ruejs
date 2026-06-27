import { type FC } from '@rue-js/rue'
import CompilerCounter from './islands/CompilerCounter'

export const CompilerDirectiveFixture: FC = () => (
  <div className="flex flex-wrap gap-3">
    <CompilerCounter client:load label="client:load directive" />
    <CompilerCounter client:visible label="client:visible directive" />
    <CompilerCounter client:interaction="click" label="client:interaction directive" />
  </div>
)
