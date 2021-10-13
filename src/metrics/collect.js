const PromisePool = require('es6-promise-pool')
const fetch = require('node-fetch').default
const listPods = require('./list-pods')
const parseMemory = require('./parse-memory')
const parseCpu = require('./parse-cpu')

/**
 * @typedef {Object} Options
 * @property {Array<string>} namespace
 * @property {number} concurrency
 * @property {string} osApi
 * @property {string} accessToken
 * @property {?import('https').Agent} agent
 * @property {(import('pino').Logger|import('fastify').Logger)} logger
 */

/**
 * @typedef {Object} FetchMetricOptions
 * @property {import('./list-pods').PodInfo} pod
 * @property {string} osApi
 * @property {string} accessToken
 * @property {?import('https').Agent} agent
 * @property {(import('pino').Logger|import('fastify').Logger)} logger
 */

/**
 * @typedef {Object} Metric
 * @property {number} value
 * @property {number} timestamp
 */

/**
 * @typedef {Object} ContainerMetrics
 * @property {string} name
 * @property {ContainerMetricsUsage} usage
 */

/**
 * @typedef {Object} ContainerMetricsUsage
 * @property {string} memory
 * @property {string} cpu
 */

/**
 * @param {(string)} date
 * @returns number
 */
function dateToTimeStamp(date) {
  return new Date(date).getTime() / 1000;
}

/**
 * @param {FetchMetricOptions} options
 * @returns {Promise<Array<import('./serialize').PrometheusMetric>>}
 */
async function  fetchPodMemoryAndCpuUsage({
 pod,
 accessToken,
 osApi,
 agent,
 logger
}) {
  const response = await fetch(
    `${osApi}/apis/metrics.k8s.io/v1beta1/namespaces/${encodeURIComponent(pod.metadata.namespace)}/pods/${encodeURIComponent(pod.metadata.name)}`,
    {
      timeout: 10000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      agent
    }
  )

  if (
    response.status < 200 ||
    response.status > 299 ||
    response.status === 204
  ) {
    throw new Error(
      `OS API returned status code ${response.status} for ${response.url}`
    )
  }

  /**
   * @type {{ kind: string, containers: Array<ContainerMetrics>, timestamp: string }}
   */
  const body = await response.json()

  if (typeof body !== 'object') {
    throw new Error(
      `Expected OS API to return an object but got ${typeof body}`
    )
  }

  if (Array.isArray(body)) {
    throw new Error('Expected OS API to return an object but got an array')
  }

  if (body == null) {
    throw new Error(`Expected OS API to return an object but got ${body}`)
  }

  if (body.kind !== 'PodMetrics') {
    throw new Error(`Expected OS API to return a PodMetrics but got ${body.kind}`)
  }

  /**
   * @type Array<import('./serialize').PrometheusMetric>
   */
  const metrics = [];

  const containers = body.containers;
  const timestamp = dateToTimeStamp(body.timestamp);

  containers.forEach((container) => {
    const parsedMemoryUsage = parseMemory(container.usage.memory);
    const parsedCpuUsage = parseCpu(container.usage.cpu);
    metrics.push({
      name: 'osmetrics_pod_memory_usage_bytes',
      labels: {
        pod: pod.metadata.name,
        container: container.name,
        namespace: pod.metadata.namespace
      },
      type: 'gauge',
      help: 'Pod Memory Usage',
      value: parsedMemoryUsage,
      timestamp: timestamp,
    });

    metrics.push({
      name: 'osmetrics_pod_cpu_usage_millicores',
      labels: {
        pod: pod.metadata.name,
        container: container.name,
        namespace: pod.metadata.namespace
      },
      type: 'gauge',
      help: 'Pod CPU Usage Rate', // TODO: should we serialize help and type only once?
      value: parsedCpuUsage,
      timestamp: timestamp
    });
    const specContainer = pod.spec.containers.find((cont) => cont.name === container.name);

    if (
      specContainer &&
      specContainer.resources &&
      specContainer.resources.limits &&
      specContainer.resources.limits.memory
    ) {
      const spec = parseMemory(specContainer.resources.limits.memory)
      const rate = parsedMemoryUsage / spec
      if (rate > 1) {
        logger.warn(
          'osmetrics_pod_memory_usage_limits_rate is > 1 for pod %s container %s spec %s (%j) usage (%j) = %j',
          pod.metadata.name,
          container.name,
          specContainer.resources.limits.memory,
          spec,
          parsedMemoryUsage,
          rate
        )
      }
      metrics.push({
        name: 'osmetrics_pod_memory_usage_limits_rate',
        labels: {
          pod: pod.metadata.name,
          container: container.name,
          namespace: pod.metadata.namespace
        },
        type: 'gauge',
        help: 'Pod Memory Usage',
        value: rate,
        timestamp: timestamp
      })
    }

    if (
      specContainer &&
      specContainer.resources &&
      specContainer.resources.requests &&
      specContainer.resources.requests.memory
    ) {
      const spec = parseMemory(specContainer.resources.requests.memory)
      const rate = parsedMemoryUsage / spec
      if (rate > 1) {
        logger.warn(
          'osmetrics_pod_memory_usage_requests_rate is > 1 for pod %s container %s spec %s (%j) usage (%j) = %j',
          pod.metadata.name,
          container.name,
          specContainer.resources.requests.memory,
          spec,
          parsedMemoryUsage,
          rate
        )
      }
      metrics.push({
        name: 'osmetrics_pod_memory_usage_requests_rate',
        labels: {
          pod: pod.metadata.name,
          container: container.name,
          namespace: pod.metadata.namespace
        },
        type: 'gauge',
        help: 'Pod Memory Usage',
        value: rate,
        timestamp: timestamp
      })
    }


    if (
      specContainer &&
      specContainer.resources &&
      specContainer.resources.limits &&
      specContainer.resources.limits.cpu
    ) {
      const spec = parseCpu(specContainer.resources.limits.cpu)
      const rate = parsedCpuUsage / spec
      if (rate > 1) {
        logger.warn(
          'osmetrics_pod_cpu_usage_limits_rate is > 1 for pod %s container %s spec %s (%j) usage (%j) = %j',
          pod.metadata.name,
          container.name,
          specContainer.resources.limits.cpu,
          spec,
          parsedCpuUsage,
          rate
        )
      }
      metrics.push({
        name: 'osmetrics_pod_cpu_usage_limits_rate',
        labels: {
          pod: pod.metadata.name,
          container: container.name,
          namespace: pod.metadata.namespace
        },
        type: 'gauge',
        help: 'Pod CPU Usage rate',
        value: rate,
        timestamp: timestamp
      })
    }

    if (
      specContainer &&
      specContainer.resources &&
      specContainer.resources.requests &&
      specContainer.resources.requests.cpu
    ) {
      const spec = parseCpu(specContainer.resources.requests.cpu)
      const rate = parsedCpuUsage / spec
      if (rate > 1) {
        logger.warn(
          'osmetrics_pod_cpu_usage_requests_rate is > 1 for pod %s container %s spec %s (%j) usage (%j) = %j',
          pod.metadata.name,
          container.name,
          specContainer.resources.requests.cpu,
          spec,
          parsedCpuUsage,
          rate
        )
      }
      metrics.push({
        name: 'osmetrics_pod_cpu_usage_requests_rate',
        labels: {
          pod: pod.metadata.name,
          container: container.name,
          namespace: pod.metadata.namespace
        },
        type: 'gauge',
        help: 'Pod CPU Usage rate',
        value: rate,
        timestamp: timestamp
      })
    }

  });

  return metrics;
}


/**
 * @param {Options} options
 * @returns {Promise<Array<import('./serialize').PrometheusMetric>>}
 */
module.exports = async function collectMetrics(options) {
  const podsPerNamespace = await Promise.all(
    options.namespace.map(async namespace =>
      listPods({
        osApi: options.osApi,
        namespace,
        accessToken: options.accessToken,
        agent: options.agent
      })
    )
  )

  const allPods = podsPerNamespace
    .reduce((accum, pods) => accum.concat(pods), [])
    .filter(pod => {
      return pod.status.phase !== 'Failed' && pod.status.phase !== 'Succeeded'
    })

  /**
   * @type {Array<import('./serialize').PrometheusMetric>}
   */
  let metrics = []

  /**
   * @param {import('./list-pods').PodInfo} pod
   * @returns {Promise<void>}
   */
  async function processPod(pod) {
    const podCpuAndMemoryMetrics = await fetchPodMemoryAndCpuUsage({
      pod,
      osApi: options.osApi,
      accessToken: options.accessToken,
      agent: options.agent,
      logger: options.logger
    });

    metrics = metrics.concat(podCpuAndMemoryMetrics)
  }

  /**
   * @returns {?Promise<void>}
   */
  function promiseProducer() {
    const pod = allPods.pop()

    if (pod != null) {
      return processPod(pod)
    }

    return null
  }

  // @ts-ignore
  const pool = new PromisePool(promiseProducer, options.concurrency)

  await pool.start()

  return metrics
}
