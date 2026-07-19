import { type FC } from '@rue-js/rue'

export interface UserPanelProps {
  layout: string
  /** Injected by the trusted server-island adapter from the request session. */
  username?: string
}

const UserPanel: FC<UserPanelProps> = props => (
  <section data-layout={props.layout}>
    <h2>{`Welcome, ${props.username ?? 'Guest'}`}</h2>
    <p>This HTML came from the isolated server-island request.</p>
  </section>
)

export default UserPanel
