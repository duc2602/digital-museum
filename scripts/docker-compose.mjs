import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const dockerCandidates = [
  process.env.DOCKER_CLI,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Programs', 'DockerDesktop', 'resources', 'bin', 'docker.exe'),
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'),
].filter(Boolean)

const docker = dockerCandidates.find((candidate) => existsSync(candidate)) ?? 'docker'
const composeFile = 'infra/docker/docker-compose.yml'
const args = ['compose', '--parallel', '1', '--env-file', '.env', '-f', composeFile, ...process.argv.slice(2)]
const child = spawn(docker, args, { stdio: 'inherit', windowsHide: true })

child.on('error', (error) => {
  console.error(`Could not start Docker CLI (${docker}): ${error.message}`)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  } else {
    process.exitCode = code ?? 1
  }
})
