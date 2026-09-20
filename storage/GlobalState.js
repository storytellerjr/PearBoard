/**
 * GlobalState — state that outlives a single session: this peer's identity and
 * the list of rooms it knows about.
 *
 * Reconstructed from call sites across app.js and Room/room.js; the original
 * module was never committed to the repository (see issue #3).
 *
 * Storage follows the same pattern as Room/room.js: a Corestore under
 * Pear.config.storage, with a Hyperbee over a named core.
 */

import Corestore from 'corestore'
import Hyperbee from 'hyperbee'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'

const PEER_ID_KEY = 'peer/id'
const PEER_NAME_KEY = 'peer/name'
const ROOM_PREFIX = 'room/'

/**
 * One Corestore per process, shared by every module that needs storage.
 *
 * Two Corestore instances over the same directory fight over Hypercore's file
 * locks, so the store is created once here and handed out.
 */
let _store = null
let _storeReady = null

export async function getStore () {
  if (_store) return _store
  if (!_storeReady) {
    _storeReady = (async () => {
      _store = new Corestore(Pear.config.storage)
      await _store.ready()
      return _store
    })()
  }
  return _storeReady
}

class GlobalState {
  constructor () {
    this._db = null
    this._ready = null
    this._peerId = null
    this._peerName = ''
  }

  /** Open the database once; concurrent callers share the same promise. */
  async ready () {
    if (this._ready) return this._ready

    this._ready = (async () => {
      const store = await getStore()

      const core = store.get({ name: 'global-state' })
      await core.ready()

      this._db = new Hyperbee(core, {
        keyEncoding: 'utf-8',
        valueEncoding: 'json'
      })
      await this._db.ready()

      // Cache the name so getPeerName() can stay synchronous, as its
      // call sites expect.
      const name = await this._db.get(PEER_NAME_KEY)
      if (name) this._peerName = name.value
    })()

    return this._ready
  }

  /**
   * This peer's stable id, generated once and persisted.
   * Awaited at startup before anything else touches state.
   */
  async getPeerID () {
    if (this._peerId) return this._peerId
    await this.ready()

    const existing = await this._db.get(PEER_ID_KEY)
    if (existing) {
      this._peerId = existing.value
      return this._peerId
    }

    this._peerId = b4a.toString(crypto.randomBytes(8), 'hex')
    await this._db.put(PEER_ID_KEY, this._peerId)
    return this._peerId
  }

  /** Local display name. Synchronous by design — call sites rely on it. */
  getPeerName () {
    return this._peerName
  }

  /** Persist the local display name. */
  async setPeerName (name) {
    this._peerName = name || ''
    await this.ready()
    await this._db.put(PEER_NAME_KEY, this._peerName)
    return this._peerName
  }

  /** Record a room this peer has created or joined. */
  async addRoom (roomKey, roomName = 'joiner', createdBy = 'admin') {
    if (!roomKey) return null
    await this.ready()

    const key = ROOM_PREFIX + roomKey
    const existing = await this._db.get(key)
    if (existing) return { ...existing.value, alreadyExists: true }

    const entry = {
      roomKey,
      roomName,
      createdBy,
      createdAt: Date.now(),
      lastModified: Date.now()
    }

    await this._db.put(key, entry)
    return entry
  }

  /** Merge new details into a known room, creating it if unseen. */
  async updateRoom (roomKey, details = {}) {
    if (!roomKey) return null
    await this.ready()

    const key = ROOM_PREFIX + roomKey
    const existing = await this._db.get(key)
    const base = existing ? existing.value : { roomKey, createdAt: Date.now() }

    const entry = { ...base, ...details, roomKey, lastModified: Date.now() }
    await this._db.put(key, entry)
    return entry
  }

  /** Every room this peer knows about, newest first. */
  async getRooms () {
    await this.ready()
    const rooms = []
    for await (const { value } of this._db.createReadStream({
      gte: ROOM_PREFIX,
      lt: ROOM_PREFIX + '\xff'
    })) {
      rooms.push(value)
    }
    return rooms.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
  }
}

export const globalState = new GlobalState()
export default globalState
