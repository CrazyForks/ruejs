import { type FC } from '@rue-js/rue'

const About: FC = () => (
  <section class="panel">
    <p class="eyebrow">second route</p>
    <h1>About Static Rue</h1>
    <p class="lede">
      The build script renders multiple URLs and writes route-shaped HTML files into dist/client.
    </p>
    <div class="status">
      <span>Route</span>
      <strong>/about</strong>
    </div>
  </section>
)

export default About
