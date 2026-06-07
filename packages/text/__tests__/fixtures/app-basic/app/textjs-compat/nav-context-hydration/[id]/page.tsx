import { NavInfo } from '../nav-info'

/**
 * Dynamic-segment page for the nav-context-hydration regression fixture.
 *
 * The [id] segment exercises the params-carrying side of __TEXT_RSC_NAV__:
 * both __TEXT_RSC_PARAMS__ and the params field passed to setNavigationContext
 * must reflect the matched segment value so that useParams() returns the right
 * thing during hydration.
 *
 * The test verifies:
 *  1. The SSR HTML renders the correct pathname (e.g. "/textjs-compat/nav-context-hydration/hello")
 *  2. __TEXT_RSC_NAV__ in the HTML payload carries that same pathname
 *  3. __TEXT_RSC_PARAMS__ carries { id: "hello" }
 *
 * Without the __TEXT_RSC_NAV__ fix, getServerSnapshot returns "/" during
 * hydration even though SSR rendered the real pathname, triggering hydration
 * mismatch error #418.
 */
export default function NavContextHydrationDynamicPage() {
  return (
    <div id="nav-context-hydration-dynamic-page">
      <h1>Nav Context Hydration Dynamic Test</h1>
      <NavInfo />
    </div>
  )
}
