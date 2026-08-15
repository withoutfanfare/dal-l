import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import { Window } from 'happy-dom'
import ts from 'typescript'

function installDom() {
  const happyWindow = new Window({ url: 'http://localhost' })

  Object.assign(globalThis, {
    document: happyWindow.document,
    Element: happyWindow.Element,
    Event: happyWindow.Event,
    HTMLElement: happyWindow.HTMLElement,
    KeyboardEvent: happyWindow.KeyboardEvent,
    Node: happyWindow.Node,
    SVGElement: happyWindow.SVGElement,
    window: happyWindow,
  })
}

installDom()

async function loadComponent(filename: string) {
  const source = await readFile(filename, 'utf8')
  const { descriptor } = parse(source, { filename })
  const script = compileScript(descriptor, { id: filename })
  const template = compileTemplate({
    compilerOptions: { bindingMetadata: script.bindings },
    filename,
    id: filename,
    source: descriptor.template?.content ?? '',
  })

  assert.deepEqual(template.errors, [])

  const resolveAlias = (_match: string, importPath: string) => {
    const resolvedPath = resolve(process.cwd(), 'src', importPath)
    return `from ${JSON.stringify(pathToFileURL(resolvedPath).href)}`
  }
  const moduleSource = [
    script.content.replace('export default', 'const component ='),
    template.code.replace('export function render', 'function render'),
    'component.render = render',
    'export default component',
  ].join('\n').replace(/from ['"]@\/([^'"]+)['"]/g, resolveAlias)
  const javascript = ts.transpileModule(moduleSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText

  const cacheRoot = resolve(process.cwd(), 'node_modules/.cache')
  await mkdir(cacheRoot, { recursive: true })
  const temporaryDirectory = await mkdtemp(join(cacheRoot, 'dalil-component-test-'))
  const modulePath = join(temporaryDirectory, `${filename.split('/').pop()}.mjs`)
  await writeFile(modulePath, javascript)

  try {
    return (await import(pathToFileURL(modulePath).href)).default
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

test('exposes modal dialog semantics and an accessible close control', async (t) => {
  document.body.innerHTML = ''
  const { createApp, nextTick } = await import('vue')
  const component = await loadComponent(resolve(dirname(fileURLToPath(import.meta.url)), 'ImageLightbox.vue'))
  const host = document.createElement('div')
  document.body.append(host)

  const app = createApp(component, { alt: 'Map', src: '/map.png' })
  t.after(() => app.unmount())
  app.mount(host)
  await nextTick()

  const dialog = document.querySelector('[role="dialog"]')
  assert.ok(dialog)
  assert.equal(dialog.getAttribute('aria-modal'), 'true')
  assert.equal(dialog.getAttribute('aria-label'), 'Image preview')
  assert.ok(dialog.querySelector('button[aria-label="Close image preview"]'))

})

test('moves focus inside on mount and restores it on unmount', async () => {
  document.body.innerHTML = ''
  const { createApp, nextTick } = await import('vue')
  const component = await loadComponent(resolve(dirname(fileURLToPath(import.meta.url)), 'ImageLightbox.vue'))
  const trigger = document.createElement('button')
  const host = document.createElement('div')
  document.body.append(trigger, host)
  trigger.focus()

  const app = createApp(component, { alt: 'Map', src: '/map.png' })
  app.mount(host)
  await nextTick()

  const closeButton = document.querySelector<HTMLButtonElement>('button[aria-label="Close image preview"]')
  assert.ok(closeButton)
  assert.equal(document.activeElement, closeButton)

  app.unmount()

  assert.equal(document.activeElement, trigger)
})
