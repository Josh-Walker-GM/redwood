import { FastifyInstance } from 'fastify'

export interface HttpServerParams {
  host?: string
  port: number
  socket?: string
  fastify: FastifyInstance
}

export const startServer = ({
  host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '::',
  port = 8911,
  socket,
  fastify,
}: HttpServerParams) => {
  const serverPort = socket ? parseInt(socket) : port

  fastify.listen({ host, port: serverPort })

  fastify.ready(() => {
    fastify.log.debug(
      { custom: { ...fastify.initialConfig } },
      'Fastify server configuration'
    )
    fastify.log.debug(`Registered plugins \n${fastify.printPlugins()}`)
  })

  return fastify
}
