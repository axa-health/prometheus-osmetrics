const serialize = require('./serialize')

describe('serialize', () => {
  it('should serialize a single metric without details', () => {
    expect(serialize([{ name: 'foo', value: 123 }])).toEqual('foo 123')
  })

  it('should serialize a single metric with labels', () => {
    expect(
      serialize([{ name: 'foo', value: 123, labels: { bar: 'baz' } }])
    ).toEqual('foo{bar="baz"} 123')
  })

  it('should serialize a single metric with type', () => {
    expect(serialize([{ name: 'foo', value: 123, type: 'gauge' }]))
      .toEqual(`# TYPE foo gauge
foo 123`)
  })

  it('should serialize a single metric with help', () => {
    expect(
      serialize([{ name: 'foo', value: 123, help: 'This is a foo metric' }])
    ).toEqual(`# HELP foo This is a foo metric
foo 123`)
  })

  it('should serialize a single metric with single-line comment', () => {
    expect(serialize([{ name: 'foo', value: 123, comment: 'hello there' }]))
      .toEqual(`# hello there
foo 123`)
  })

  it('should serialize a single metric with multi-line comment', () => {
    expect(serialize([{ name: 'foo', value: 123, comment: 'hello\nthere' }]))
      .toEqual(`# hello
# there
foo 123`)
  })

  it('should serialize multiple metrics without details', () => {
    expect(
      serialize([
        { name: 'foo', value: 123 },
        { name: 'bar', value: 456 }
      ])
    ).toEqual(`foo 123
bar 456`)
  })

  it('should serialize multiple full-blown metrics', () => {
    expect(
      serialize([
        {
          name: 'foo',
          value: 123,
          labels: { foo: 'bar', bar: 'baz' },
          type: 'gauge',
          help: 'foo help text',
          comment: 'this \n is a comment'
        },
        {
          name: 'bar',
          value: 456,
          labels: { hello: 'world' },
          type: 'counter',
          help: 'bar help text',
          comment: 'this \n is a large\ncomment \nwith many\nlines'
        }
      ])
    ).toEqual(`# HELP foo foo help text
# TYPE foo gauge
# this
# is a comment
foo{foo="bar", bar="baz"} 123
# HELP bar bar help text
# TYPE bar counter
# this
# is a large
# comment
# with many
# lines
bar{hello="world"} 456`)
  })

  it('should de-duplicate comments', () => {
    expect(
      serialize([
        {
          name: 'foo',
          value: 123,
          labels: { foo: 'bar', bar: 'baz' },
          type: 'gauge',
          help: 'foo help text',
          comment: 'this \n is a comment'
        },
        {
          name: 'foo',
          value: 123,
          labels: { foo: 'bar', bar: 'baz2' },
          type: 'gauge',
          help: 'foo help text',
          comment: 'this \n is a comment'
        }
      ])
    ).toEqual(`# HELP foo foo help text
# TYPE foo gauge
# this
# is a comment
foo{foo="bar", bar="baz"} 123
foo{foo="bar", bar="baz2"} 123`)
  })
})
