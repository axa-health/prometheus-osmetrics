const fastify = require('fastify')
const fastifySensible = require('fastify-sensible')
const collectMetrics = require('./metrics/collect')
const serializeMetrics = require('./metrics/serialize')

/**
 * @typedef {Object} Options
 * @property {Object=} fastifyOptions
 * @property {number=} concurrency
 * @property {string} osApi
 * @property {string} accessToken
 * @property {?import('https').Agent} agent
 * @property {import('pino').Logger} logger
 * @property {?Array<string>} defaultNamespace
 */

/**
 * @param {Options} options
 */
module.exports = function createServer ({
  fastifyOptions = {},
  concurrency = 10,
  osApi,
  accessToken,
  agent,
  logger,
  defaultNamespace
}) {
  const server = fastify({
    logger,
    ...fastifyOptions
  })

  server.register(fastifySensible)

  server.get('/health', (req, reply) => {
    reply.send({ status: 'ok' })
  })

  server.get(
    '/metrics',
    {
      schema: {
        querystring: {
          type: 'object',
          required: [],
          properties: {
            namespace: {
              oneOf: [
                { type: 'string', minLength: 1 },
                {
                  type: 'array',
                  items: { type: 'string', minLength: 1 }
                }
              ]
            },
            excitement: { type: 'integer' }
          },
          additionalProperties: false
        }
      }
    },
    async (req, reply) => {
      let namespace = defaultNamespace

      if (req.query.namespace) {
        namespace = Array.isArray(req.query.namespace)
          ? req.query.namespace
          : [req.query.namespace]
      }

      reply.send(
        serializeMetrics(
          await collectMetrics({
            namespace,
            concurrency,
            osApi,
            accessToken,
            agent,
            logger: req.log
          })
        )
      )
    }
  )

  return server
}
