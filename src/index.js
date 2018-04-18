import _          from 'lodash'
import invariant  from 'invariant'

import GameEvent  from './data/GameEvent'
import GameNote   from './data/GameNote'

// A notechart holds every info about a single player's note chart that the
// game will ever need.
export class Notechart {
  constructor (data, playerOptions = { }) {

    let {
      notes: bmsNotes,
      timing,
      keysounds,
      songInfo,
      positioning,
      spacing,
      barLines,
      images,
      expertJudgmentWindow
    } = data

    invariant(bmsNotes,     'Expected "data.notes"')
    invariant(timing,       'Expected "data.timing"')
    invariant(keysounds,    'Expected "data.keysounds"')
    invariant(songInfo,     'Expected "data.songInfo"')
    invariant(positioning,  'Expected "data.positioning"')
    invariant(spacing,      'Expected "data.spacing"')
    invariant(barLines,     'Expected "data.barLines"')

    this.expertJudgmentWindow = expertJudgmentWindow

    if (!playerOptions.noShifting) {
      bmsNotes = this._preTransform(bmsNotes, playerOptions)
    }

    this._timing      = timing
    this._positioning = positioning
    this._spacing     = spacing
    this._keysounds   = keysounds
    this._duration    = 0
    this._notes       = this._generatePlayableNotesFromBMS(bmsNotes)
    this._autos       = this._generateAutoKeysoundEventsFromBMS(bmsNotes)
    this._barLines    = this._generateBarLineEvents(barLines)
    this._samples     = this._generateKeysoundFiles(keysounds)
    this._infos       = new Map(this._notes.map(
        note => [note, this._getNoteInfo(note)]))
    this._songInfo    = songInfo
    this._images      = images
    this._columns     = this._generateColumnsFromBMS(bmsNotes)
  }

  // An Array of note events.
  get notes () {
    return this._notes
  }

  // An Array of auto-keysound events.
  get autos () {
    return this._autos
  }

  // An Array of all the sample files to use.
  get samples () {
    return this._samples
  }

  // An Object containing the mapping from keysound ID to keysound filename.
  get keysounds () {
    return this._keysounds.all()
  }

  // An Object representing the bar line events.
  get barLines () {
    return this._barLines
  }

  // An Array of all column names in this notechart.
  get columns () {
    return this._columns
  }

  // Notechart's duration (time of last event)
  get duration () {
    return this._duration
  }

  // Notechart's song info
  get songInfo () {
    return this._songInfo
  }

  // Eyecatch image
  get eyecatchImage () {
    return (this._images && this._images.eyecatch) || 'eyecatch_image.png'
  }

  // Background image
  get backgroundImage () {
    return (this._images && this._images.background) || 'back_image.png'
  }

  // Returns the characteristic of the note as an Object.
  // The returned object includes the following properties:
  //
  // combos
  //   The maximum amount of judgments this note may give. Usually it is 1
  //   for normal notes and 2 for long notes.
  //
  info (note) {
    return this._infos.get(note)
  }

  // Converts the beat number to in-song position (seconds)
  beatToSeconds (beat) {
    return this._timing.beatToSeconds(beat)
  }

  // Converts the beat number to in-game position.
  beatToPosition (beat) {
    return this._positioning.position(beat)
  }

  // Converts the in-song position to beat number.
  secondsToBeat (seconds) {
    return this._timing.secondsToBeat(seconds)
  }

  // Converts the in-song position to in-game position.
  secondsToPosition (seconds) {
    return this.beatToPosition(this.secondsToBeat(seconds))
  }

  // Converts the beat number to in-song position (seconds)
  bpmAtBeat (beat) {
    return this._timing.bpmAtBeat(beat)
  }

  // Converts the beat number to in-song position (seconds)
  scrollSpeedAtBeat (beat) {
    return this._positioning.speed(beat)
  }

  // Returns the note spacing factor at the specified beat
  spacingAtBeat (beat) {
    return this._spacing.factor(beat)
  }

  _preTransform (bmsNotes, playerOptions) {
    let chain = _.chain(bmsNotes)
    let keys  = getKeys(bmsNotes)
    if (playerOptions.scratch === 'off') {
      chain = chain.map(note => {
        if (note.column && note.column === 'SC') {
          return Object.assign({ }, note, { column: null })
        } else {
          return note
        }
      })
    }
    if (keys === '5K') {
      const columnsToShift = ['1', '2', '3', '4', '5', '6', '7']
      const shiftNote = amount => note => {
        if (note.column) {
          let index = columnsToShift.indexOf(note.column)
          if (index > -1) {
            let newIndex = index + amount
            invariant(
              newIndex < columnsToShift.length,
              'Weird. Columns must not shift beyond available column'
            )
            let newColumn = columnsToShift[newIndex]
            return Object.assign({ }, note, { column: newColumn })
          }
        }
        return note
      }
      if (playerOptions.scratch === 'off') {
        chain = chain.map(shiftNote(1))
      } else if (playerOptions.scratch === 'right') {
        chain = chain.map(shiftNote(2))
      }
    }
    return chain.value()
  }

  _generatePlayableNotesFromBMS (bmsNotes) {
    let nextId = 1
    return bmsNotes
    .filter(note => note.column)
    .map(note => {
      let spec = this._generateEvent(note.beat)
      spec.id       = nextId++
      spec.column   = note.column
      spec.keysound       = note.keysound
      spec.keysoundStart  = note.keysoundStart
      spec.keysoundEnd    = note.keysoundEnd
      this._updateDuration(spec)
      if (note.endBeat !== undefined) {
        spec.end = this._generateEvent(note.endBeat)
        this._updateDuration(spec.end)
      } else {
        spec.end = undefined
      }
      return new GameNote(spec)
    })
  }

  _updateDuration (event) {
    if (event.time > this._duration) this._duration = event.time
  }

  _generateAutoKeysoundEventsFromBMS (bmsNotes) {
    return bmsNotes
    .filter(note => !note.column)
    .map(note => {
      let spec = this._generateEvent(note.beat)
      spec.keysound       = note.keysound
      spec.keysoundStart  = note.keysoundStart
      spec.keysoundEnd    = note.keysoundEnd
      return new GameEvent(spec)
    })
  }

  _generateKeysoundFiles (keysounds) {
    let set = new Set()
    for (let array of [this.notes, this.autos]) {
      for (let event_ of array) {
        let file = keysounds.get(event_.keysound)
        if (file) set.add(file)
      }
    }
    return Array.from(set)
  }

  _generateBarLineEvents (beats) {
    return beats.map(beat => this._generateEvent(beat))
  }

  _generateEvent (beat) {
    return {
      beat:     beat,
      time:     this.beatToSeconds(beat),
      position: this.beatToPosition(beat),
    }
  }

  _getNoteInfo (note) {
    let combos = note.end ? 2 : 1
    return { combos }
  }

  _generateColumnsFromBMS (bmsNotes) {
    const usedColumns = {}
    const columns = []
    for (const note of bmsNotes) {
      if (!usedColumns[note.column]) {
        columns.push(note.column)
      }
      usedColumns[note.column] = true
    }
    return columns
  }
}

export default Notechart


function getKeys (bmsNotes) {
  for (let note of bmsNotes) {
    if (note.column === '6' || note.column === '7') {
      return '7K'
    }
  }
  return '5K'
}
