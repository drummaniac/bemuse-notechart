import { expect } from 'chai'

import NotechartLoader from '../src/loader'

describe('NotechartLoader', function () {
  describe('with BMS file', function () {
    it('should be able to read', function () {
      let loader = new NotechartLoader()
      let buffer = new Buffer(`#TITLE meow`)

      return loader.load(buffer, { name: 'wow.bms' }, { }).then(notechart => {
        expect(notechart.songInfo.title).to.equal('meow')
      })
    })
    it('also reads judge rank', function () {
      let loader = new NotechartLoader()
      let buffer = new Buffer(`#RANK 1`)

      return loader.load(buffer, { name: 'wow.bms' }, { }).then(notechart => {
        expect(notechart.expertJudgmentWindow[0]).to.equal(15)
        expect(notechart.expertJudgmentWindow[1]).to.equal(30)
      })
    })
  })

  describe('with DTX file', function () {
    it('should be able to read', function () {
      let loader = new NotechartLoader()
      let buffer = new Buffer(`#TITLE: meow`)

      return loader.load(buffer, { name: 'wow.dtx' }, { }).then(notechart => {
        expect(notechart.songInfo.title).to.equal('meow')
      })
    })
  })

  describe('with bmson file', function () {
    it('should be able to read', function () {
      let loader = new NotechartLoader()
      let data = {
        info: { title: 'Running Out' }
      }
      let buffer = new Buffer(JSON.stringify(data))

      return loader.load(buffer, { name: 'wow.bmson' }, { }).then(notechart => {
        expect(notechart.songInfo.title).to.equal('Running Out')
      })
    })
    it('should read the judge_rank of the song', function () {
      let loader = new NotechartLoader()
      let data = {
        info: { title: 'Running Out', judge_rank: 200 }
      }
      let buffer = new Buffer(JSON.stringify(data))

      return loader.load(buffer, { name: 'wow.bmson' }, { }).then(notechart => {
        expect(notechart.expertJudgmentWindow[0]).to.equal(36)
        expect(notechart.expertJudgmentWindow[1]).to.equal(80)
      })
    })
  })
})
