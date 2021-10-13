const serializeLabels = require('./serialize-labels')

/**
 * @typedef {Object} PrometheusMetric
 * @property {string=} help
 * @property {string=} type
 * @property {string} name
 * @property {number=} timestamp
 * @property {number} value
 * @property {string=} comment
 * @property {Object.<string, string>=} labels
 */

/**
 * @param {Array<PrometheusMetric>} [metrics]
 */
module.exports = function (metrics) {
  /**
   * @type Array<string>
   */
  const emittedComments = [];

  return metrics.reduce((accum, metric, index) => {
    const labels =
      metric.labels != null ? `{${serializeLabels(metric.labels)}}` : ''

    let comments = ''

    if (emittedComments.indexOf(metric.name) === -1) {
      if (metric.help != null) {
        comments += `# HELP ${metric.name} ${metric.help}\n`
      }

      if (metric.type != null) {
        comments += `# TYPE ${metric.name} ${metric.type}\n`
      }

      if (metric.comment != null) {
        metric.comment.split('\n').forEach(line => {
          comments += `# ${line.trim()}\n`
        })
      }

      emittedComments.push(metric.name);
    }

    const timestamp = metric.timestamp != null ? ` ${metric.timestamp}` : ''

    const separator = index === 0 ? '' : '\n'

    return `${accum}${separator}${comments}${metric.name}${labels} ${metric.value}`
  }, '')
}
