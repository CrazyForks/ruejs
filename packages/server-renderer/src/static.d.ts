import type { IncomingMessage, Server } from 'node:http'

export type StaticTask<T = unknown> = () => T | Promise<T>

export type StaticRouteRenderKind = 'static' | 'ssr' | 'snapshot' | 'skipped' | 'failed'

export type StaticRenderDomCallback<T = unknown> = (
  context: StaticRenderDomContext,
) => T | Promise<T>

export type StaticRouteRenderCallback = (
  context: StaticRoutePipelineContext,
) => StaticRouteRenderValueInput | Promise<StaticRouteRenderValueInput>

export type StaticRoutePreRenderCallback = (
  context: StaticRoutePipelineContext,
) =>
  | StaticRouteRenderValueInput
  | false
  | null
  | undefined
  | Promise<StaticRouteRenderValueInput | false | null | undefined>

export type StaticRouteHtmlCallback = (context: StaticRouteHtmlContext) => string | Promise<string>

export type StaticRouteShouldPrerenderCallback = (
  context: StaticRoutePipelineContext,
) => boolean | Promise<boolean>

export type StaticRouteOutputFileCallback = (
  context: Omit<StaticRoutePipelineContext, 'outputFile'>,
) => string | Promise<string>

export type StaticRouteRenderValueInput = string | StaticRouteRenderValue

export interface CreateStaticRouteHtmlOptions {
  includeClientRuntime?: boolean
}

export interface RunWithStaticRenderDomOptions {
  html?: string
  baseUrl?: string | URL
  extraGlobals?: Record<string, unknown>
  installObserverShims?: boolean
  installCanvasShim?: boolean
}

export interface StaticRenderDomContext {
  dom: unknown
  window: Window
  document: Document
  route: string
}

export interface StaticRoutePipelineContext {
  route: string
  rawRoute: unknown
  routeIndex: number
  outDir: string
  outputFile: string
}

export interface StaticRouteHtmlContext extends StaticRoutePipelineContext {
  kind: Exclude<StaticRouteRenderKind, 'skipped' | 'failed'>
  html: string
  result: StaticRouteRenderValue
}

export interface StaticRouteRenderValue {
  html: string
  [key: string]: unknown
}

export interface RenderServerBundleRouteOptions extends RunWithStaticRenderDomOptions {
  serverBundleFile: string
  route: string
  outputFile: string
}

export interface RenderServerBundleRouteResult {
  route: string
  outputFile: string
  html: string
}

export interface WaitForStaticAppHtmlOptions {
  appSelector?: string
  settleMs?: number
  waitMs?: number
}

export interface SnapshotClientRouteOptions
  extends Omit<RunWithStaticRenderDomOptions, 'html'>, WaitForStaticAppHtmlOptions {
  outDir: string
  route: string
  outputFile: string
  templateFile?: string
}

export interface SnapshotClientRouteResult {
  route: string
  outputFile: string
  html: string
}

export interface ResolveStaticPreviewFileOptions {
  host?: string
  baseUrl?: string | URL
}

export interface CreateStaticPreviewServerOptions {
  staticDir: string
  contentTypes?: Record<string, string>
  onError?: (error: unknown, request: IncomingMessage) => void
}

export interface RenderStaticRoutesOptions {
  routes: readonly unknown[]
  outDir: string
  concurrency?: number
  renderRoute: StaticRouteRenderCallback
  snapshotRoute?: StaticRouteRenderCallback
  preRenderRoute?: StaticRoutePreRenderCallback
  shouldPrerenderRoute?: StaticRouteShouldPrerenderCallback
  renderHtml?: StaticRouteHtmlCallback
  resolveOutputFile?: StaticRouteOutputFileCallback
}

export interface StaticRouteResult {
  route: string
  routeIndex: number
  outputFile: string
  kind: StaticRouteRenderKind
}

export interface StaticRouteSsrFailure {
  route: string
  routeIndex: number
  outputFile: string
  error: unknown
}

export interface StaticRouteSnapshotFailure {
  route: string
  routeIndex: number
  outputFile: string
  ssrError: unknown
  snapshotError: unknown
}

export interface StaticRoutesSummary {
  totalRoutes: number
  staticRendered: number
  ssrRendered: number
  staticSnapshots: number
  skipped: number
  ssrFailures: number
  fatalFailures: number
}

export interface StaticRoutesResult {
  routes: StaticRouteResult[]
  summary: StaticRoutesSummary
  ssrFailures: StaticRouteSsrFailure[]
  snapshotFailures: StaticRouteSnapshotFailure[]
}

export interface StaticRenderReportRoute {
  route: string
  routeIndex: number
  outputFile: string
  kind: StaticRouteRenderKind
}

export interface StaticRenderReportSsrFailure {
  route: string
  routeIndex: number
  outputFile: string
  recoveredBy: 'static-snapshot' | 'none'
  error: string
}

export interface StaticRenderReportSnapshotFailure {
  route: string
  routeIndex: number
  outputFile: string
  ssrError: string
  snapshotError: string
}

export interface StaticRenderReport {
  generatedAt: string
  summary: StaticRoutesSummary
  routes: StaticRenderReportRoute[]
  ssrFailures: StaticRenderReportSsrFailure[]
  snapshotFailures: StaticRenderReportSnapshotFailure[]
}

export interface WriteStaticRenderReportOptions {
  result: StaticRoutesResult
  reportFile: string
  errorLogFile: string
  generatedAt?: string
}

export interface WriteStaticRenderReportResult {
  report: StaticRenderReport
  reportFile: string
  errorLogFile: string
}

export interface RenderStaticRouteInChildOptions {
  scriptFile: string
  route: string
  outputFile: string
  args?: readonly string[]
  nodeArgs?: readonly string[]
  cwd?: string
  env?: Record<string, string | undefined>
  label?: string
  timeoutMs?: number
  maxOutputLength?: number
}

export declare const normalizeStaticRoute: (route: unknown) => string | null

export declare const staticRouteToOutputFile: (route: unknown, outDir: string) => string | null

export declare const stripStaticClientRuntime: (html: string) => string

export declare const createStaticRouteHtml: (
  template: string,
  appHtml: string,
  options?: CreateStaticRouteHtmlOptions,
) => string

export declare const runWithStaticRenderDom: <T>(
  route: string,
  callback: StaticRenderDomCallback<T>,
  options?: RunWithStaticRenderDomOptions,
) => Promise<T>

export declare const renderServerBundleRoute: (
  options: RenderServerBundleRouteOptions,
) => Promise<RenderServerBundleRouteResult>

export declare const waitForStaticAppHtml: (
  window: Window,
  options?: WaitForStaticAppHtmlOptions,
) => Promise<string>

export declare const snapshotClientRoute: (
  options: SnapshotClientRouteOptions,
) => Promise<SnapshotClientRouteResult>

export declare const runWithStaticConcurrency: <T>(
  tasks: readonly StaticTask<T>[],
  concurrency?: number,
) => Promise<T[]>

export declare const renderStaticRoutes: (
  options: RenderStaticRoutesOptions,
) => Promise<StaticRoutesResult>

export declare const resolveStaticPreviewFile: (
  staticDir: string,
  requestUrl?: string | null,
  options?: ResolveStaticPreviewFileOptions,
) => Promise<string | null>

export declare const createStaticPreviewServer: (
  options: CreateStaticPreviewServerOptions,
) => Server

export declare const formatStaticError: (error: unknown) => string

export declare const renderStaticRenderLog: (report: StaticRenderReport) => string

export declare const writeStaticRenderReport: (
  options: WriteStaticRenderReportOptions,
) => Promise<WriteStaticRenderReportResult>

export declare const renderStaticRouteInChild: (
  options: RenderStaticRouteInChildOptions,
) => Promise<string>
