const fs = require('fs')
const https = require('https')

/**
 * @typedef {Object} Settings
 * @property {string} osApi
 * @property {string} accessToken
 * @property {?import('https').Agent} agent
 * @property {?Array<string>} defaultNamespace
 */

/**
 * @param {Object.<string, string>} env
 * @param {import('pino').Logger} logger
 * @returns {Promise<Settings>}
 */
module.exports = async function collectSettings (env, logger) {
  let osApi = env.OS_API
  if (!osApi) {
    if (env.KUBERNETES_SERVICE_HOST) {
      logger.info(
        'Using KUBERNETES_SERVICE_HOST as a fallback since OS_API variable is not set'
      )
      osApi = `https://${env.KUBERNETES_SERVICE_HOST}`
    } else {
      throw new Error('Please set the OS_API env variable!')
    }
  }

  const accessToken = env.OS_ACCESS_TOKEN_FILE
    ? await fs.promises.readFile(env.OS_ACCESS_TOKEN_FILE, 'utf8')
    : env.OS_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error(
      'Please set the OS_ACCESS_TOKEN or OS_ACCESS_TOKEN_FILE env variable!'
    )
  }

  let agent = null
  if (env.OS_CERTIFICATE_AUTHORITY) {
    agent = new https.Agent({
      ca: await fs.promises.readFile(env.OS_CERTIFICATE_AUTHORITY, 'utf8')
    })
  }

  let defaultNamespace = null
  if (env.OS_DEFAULT_NAMESPACE) {
    defaultNamespace = env.OS_DEFAULT_NAMESPACE.split(',')
    logger.info('Using default namespace %j', defaultNamespace)
  }

  return { osApi, accessToken, agent, defaultNamespace }
}
