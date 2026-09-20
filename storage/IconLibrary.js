/**
 * Icon libraries — named sets of icons the user can bring to the board.
 *
 * Icons are stored as data, never as file paths. A path only ever resolves on
 * the machine that created it: peers have no such file, and the owner's board
 * breaks the moment the source folder is moved. See issue #7.
 *
 * Layout in Hyperbee, over the Corestore the app already opens:
 *
 *   library/<libraryId>            -> { id, name, description, createdAt }
 *   icon/<libraryId>/<iconId>      -> { id, libraryId, name, mime, w, h, data }
 *
 * The icons bundled with the app are exposed as a read-only built-in library,
 * so both kinds render through one path.
 */

import Hyperbee from 'hyperbee'
import { getStore } from './GlobalState.js'
import loadIcons from '../helper.js'

const LIB_PREFIX = 'library/'
const ICON_PREFIX = 'icon/'

export const BUILTIN_ID = 'builtin'

/** Longest side, in pixels, that an imported icon is scaled down to. */
export const IMPORT_MAX_SIDE = 512

class IconLibraryStore {
  constructor () {
    this._db = null
    this._ready = null
  }

  async ready () {
    if (this._ready) return this._ready

    this._ready = (async () => {
      const store = await getStore()
      const core = store.get({ name: 'icon-libraries' })
      await core.ready()

      this._db = new Hyperbee(core, {
        keyEncoding: 'utf-8',
        valueEncoding: 'json'
      })
      await this._db.ready()
    })()

    return this._ready
  }

  // ---- libraries ----------------------------------------------------------

  /** Every library, the built-in one first. */
  async listLibraries () {
    await this.ready()

    const custom = []
    for await (const { value } of this._db.createReadStream({
      gte: LIB_PREFIX,
      lt: LIB_PREFIX + '\xff'
    })) {
      custom.push(value)
    }

    custom.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))

    return [
      {
        id: BUILTIN_ID,
        name: 'Board icons',
        description: 'The icons that ship with PearBoard.',
        builtIn: true
      },
      ...custom
    ]
  }

  async createLibrary (name, description = '') {
    await this.ready()

    const trimmed = (name || '').trim()
    if (!trimmed) throw new Error('A library needs a name')

    const library = {
      id: `lib-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      description: (description || '').trim(),
      createdAt: Date.now(),
      builtIn: false
    }

    await this._db.put(LIB_PREFIX + library.id, library)
    return library
  }

  async deleteLibrary (libraryId) {
    if (!libraryId || libraryId === BUILTIN_ID) return false
    await this.ready()

    for (const icon of await this.listIcons(libraryId)) {
      await this._db.del(`${ICON_PREFIX}${libraryId}/${icon.id}`)
    }
    await this._db.del(LIB_PREFIX + libraryId)
    return true
  }

  // ---- icons --------------------------------------------------------------

  /**
   * Icons in a library. Built-in icons carry a `src` path; imported ones
   * carry their image `data`, so callers must handle either.
   */
  async listIcons (libraryId) {
    if (libraryId === BUILTIN_ID) {
      const files = await loadIcons()
      return files.map((file) => ({
        id: file,
        libraryId: BUILTIN_ID,
        name: file.replace(/\.[^.]+$/, ''),
        src: `./assets/board_icons/${file}`
      }))
    }

    await this.ready()

    const icons = []
    const prefix = `${ICON_PREFIX}${libraryId}/`
    for await (const { value } of this._db.createReadStream({
      gte: prefix,
      lt: prefix + '\xff'
    })) {
      icons.push(value)
    }

    icons.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
    return icons
  }

  /** One icon, however it is stored. */
  async getIcon (libraryId, iconId) {
    if (!libraryId || !iconId) return null

    if (libraryId === BUILTIN_ID) {
      return {
        id: iconId,
        libraryId: BUILTIN_ID,
        name: iconId.replace(/\.[^.]+$/, ''),
        src: `./assets/board_icons/${iconId}`
      }
    }

    await this.ready()
    const entry = await this._db.get(`${ICON_PREFIX}${libraryId}/${iconId}`)
    return entry ? entry.value : null
  }

  async addIcon (libraryId, { name, mime, width, height, data }) {
    await this.ready()

    const icon = {
      id: `icon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      libraryId,
      name: name || 'icon',
      mime: mime || 'image/png',
      w: width,
      h: height,
      data,
      addedAt: Date.now()
    }

    await this._db.put(`${ICON_PREFIX}${libraryId}/${icon.id}`, icon)
    return icon
  }

  async deleteIcon (libraryId, iconId) {
    if (!libraryId || libraryId === BUILTIN_ID) return false
    await this.ready()
    await this._db.del(`${ICON_PREFIX}${libraryId}/${iconId}`)
    return true
  }
}

export const iconLibrary = new IconLibraryStore()

/**
 * Scale an image file down and return it as a data URL.
 *
 * Source art tends to be large — the bundled icons are 768x1344, about 85KB
 * each. Shrinking on the way in keeps storage sane and matters far more once
 * these bytes have to reach peers (step 2 of #7).
 */
export function importImageFile (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.onload = () => {
      const img = new Image()

      img.onerror = () => reject(new Error(`Not a readable image: ${file.name}`))
      img.onload = () => {
        const longest = Math.max(img.width, img.height) || 1
        const scale = Math.min(1, IMPORT_MAX_SIDE / longest)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)

        resolve({
          name: file.name.replace(/\.[^.]+$/, ''),
          mime: 'image/png',
          width: w,
          height: h,
          data: canvas.toDataURL('image/png')
        })
      }

      img.src = reader.result
    }

    reader.readAsDataURL(file)
  })
}

export default iconLibrary
