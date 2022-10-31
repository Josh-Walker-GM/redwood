import fs from 'fs'
import https from 'https'
import path from 'path'

import execa from 'execa'
import latestVersion from 'latest-version'
import { Listr } from 'listr2'
import semver from 'semver'
import terminalLink from 'terminal-link'

import { errorTelemetry } from '@redwoodjs/telemetry'

import { getPaths } from '../lib'
import c from '../lib/colors'
import { generatePrismaClient } from '../lib/generatePrismaClient'

const URL_VERSIONS =
  'https://raw.githubusercontent.com/Josh-Walker-GM/improved-upgrade-repo/master/versions.json'
const URL_UPGRADES =
  'https://raw.githubusercontent.com/Josh-Walker-GM/improved-upgrade-repo/master/upgrades.json'

export const command = 'upgrade'
export const description = 'Upgrade all @redwoodjs packages via interactive CLI'

export const builder = (yargs) => {
  yargs
    .example(
      'rw upgrade -t 0.20.1-canary.5',
      'Specify a version. URL for Version History:\nhttps://www.npmjs.com/package/@redwoodjs/core'
    )
    .option('dry-run', {
      alias: 'd',
      description: 'Check for outdated packages without upgrading',
      type: 'boolean',
    })
    .option('tag', {
      alias: 't',
      description:
        '[choices: "canary", "rc", or specific-version (see example below)] WARNING: "canary" and "rc" tags are unstable releases!',
      requiresArg: true,
      type: 'string',
      coerce: validateTag,
    })
    .option('verbose', {
      alias: 'v',
      description: 'Print verbose logs',
      type: 'boolean',
      default: false,
    })
    .option('dedupe', {
      description: 'Skip dedupe check with --no-dedupe',
      type: 'boolean',
      default: true,
    })
    .epilogue(
      `Also see the ${terminalLink(
        'Redwood CLI Reference',
        'https://redwoodjs.com/docs/cli-commands#upgrade'
      )}`
    )
    // Just to make an empty line
    .epilogue('')
    .epilogue(
      `We are < v1.0.0, so breaking changes occur frequently. For more information on the current release, see the ${terminalLink(
        'release page',
        'https://github.com/redwoodjs/redwood/releases'
      )}`
    )
}

// Used in yargs builder to coerce tag AND to parse yarn version
const SEMVER_REGEX =
  /(?<=^v?|\sv?)(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-(?:0|[1-9]\d*|[\da-z-]*[a-z-][\da-z-]*)(?:\.(?:0|[1-9]\d*|[\da-z-]*[a-z-][\da-z-]*))*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?(?=$|\s)/i
const validateTag = (tag) => {
  const isTagValid =
    tag === 'rc' ||
    tag === 'canary' ||
    tag === 'latest' ||
    SEMVER_REGEX.test(tag)

  if (!isTagValid) {
    // Stop execution
    throw new Error(
      c.error(
        'Invalid tag supplied. Supported values: rc, canary, latest, or valid semver version\n'
      )
    )
  }

  return tag
}

export const handler = async ({ dryRun, tag, verbose, dedupe }) => {
  const initialContext = {
    upgrading: false, // This flag will allow us to only show the upgrade listr tasks if an upgrade is actually available and underway
    skippedSteps: [], // Container for any modifications/checks that were not performed
  }

  const tasks = new Listr(
    [
      {
        title: 'Fetching latest information',
        task: async (ctx) => fetchLatestRemoteInformation(ctx),
      },
      {
        title: 'Checking for upgrades',
        task: async (ctx, task) => checkForUpgrades(ctx, task, tag),
        options: {
          persistentOutput: true,
        },
      },
      {
        title: 'Updating redwood versions in package.json files',
        task: (ctx, task) =>
          setRedwoodDepsForAllSides(ctx, task, ctx.remoteVersion),
        enabled: (ctx) => ctx.upgrading,
        skip: () => dryRun,
      },
      {
        title: 'Running yarn install',
        task: (ctx) => yarnInstall(ctx, { dryRun, verbose }),
        enabled: (ctx) => ctx.upgrading,
        skip: () => dryRun || true,
      },
      {
        title: 'Handling necessary code modifications',
        task: async (ctx, task) => handleCodeModifications(ctx, task),
        enabled: (ctx) => ctx.upgrading,
        skip: () => dryRun,
      },
      // {
      //   title: 'Refreshing the Prisma client',
      //   task: (_ctx, task) => refreshPrismaClient(task, { verbose }),
      //   enabled: (ctx) => ctx.upgrading,
      //   skip: () => dryRun,
      // },
      // {
      //   title: 'De-duplicating dependencies',
      //   task: (_ctx, task) => dedupeDeps(task, { verbose }),
      //   enabled: (ctx) => ctx.upgrading,
      //   skip: () => dryRun || !dedupe,
      // },
    ],
    {
      ctx: initialContext,
      renderer: verbose && 'verbose',
      rendererOptions: { collapse: false },
    }
  )

  try {
    await tasks.run()
  } catch (e) {
    errorTelemetry(process.argv, e.message)
    console.error(c.error(e.message))
    process.exit(e?.exitCode || 1)
  }
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, function (res) {
        let body = ''
        res.on('data', function (chunk) {
          body += chunk
        })
        res.on('end', function () {
          try {
            let json = JSON.parse(body)
            resolve(json)
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', function (error) {
        reject(error)
      })
  })
}

async function fetchLatestRemoteInformation(ctx) {
  try {
    ctx.latestVersions = await fetchJSON(URL_VERSIONS)
    ctx.latestUpgrades = await fetchJSON(URL_UPGRADES)

    // TODO: Remove this mocking
    const latestVersion = '3.4.2'
    ctx.latestVersions = {
      '': `${latestVersion}`,
      latest: `${latestVersion}`,
      rc: `${latestVersion}-rc.137`,
      canary: `${latestVersion}-canary.158`,
    }

    // TODO: Remove this mocking
    ctx.latestUpgrades = [
      {
        id: '783b91ba-ac85-45c2-8fc4-d193b6907fc4',
        toVersion: '3.4.2',
        fromVersion: '3.4.1',
        modifications: {
          automatic: [
            {
              id: '0a4aed88-da3b-4920-a5f3-b8827acde2d3',
              title: 'TITLE',
              description: 'DESCRIPTION',
              url: 'SCRIPT-URL',
            },
          ],
          manual: [],
        },
      },
      {
        id: '6f35f9a4-35e0-4a3e-8e9a-92d057464b5a',
        toVersion: '3.4.1',
        fromVersion: '3.4.0',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: 'c938a99b-0414-4270-9745-3033371ac0bf',
        toVersion: '3.4.0',
        fromVersion: '3.3.5',
        modifications: {
          automatic: [
            {
              id: 'b022d37c-2bc2-4884-ad95-352e8816069b',
              title: 'TITLE',
              description: 'DESCRIPTION',
              url: 'SCRIPT-URL',
            },
            {
              id: 'bbedabbe-7e49-4f19-a287-f9cbe165e8e8',
              title: 'TITLE',
              description: 'DESCRIPTION',
              url: 'SCRIPT-URL',
            },
          ],
          manual: [
            {
              id: '04071d75-66ab-4337-add8-381c2334901d',
              title: 'TITLE',
              description: 'DESCRIPTION',
              url: 'DOCS-URL',
            },
          ],
        },
      },
      {
        id: '1eab420b-20c5-40c1-9373-40a053efc067',
        toVersion: '3.3.5',
        fromVersion: '3.3.4',
        modifications: {
          automatic: [
            {
              id: '5870cae4-474b-4da2-8c79-6c9b2a0350ed',
              title: 'TITLE',
              description: 'DESCRIPTION',
              url: 'SCRIPT-URL',
            },
          ],
          manual: [],
        },
      },
      {
        id: '4db04116-3792-45d0-b7bf-c729d230538c',
        toVersion: '3.3.4',
        fromVersion: '3.3.3',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: '2ef40a52-043c-4e97-9a30-57392d3265b7',
        toVersion: '3.3.3',
        fromVersion: '3.3.2',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: 'b3ca60bf-870d-4826-929d-82f038bae652',
        toVersion: '3.3.2',
        fromVersion: '3.3.1',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: '771dee2d-3282-411d-a83c-119c46e34542',
        toVersion: '3.3.1',
        fromVersion: '3.3.0',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: 'dcf3b525-f2d7-4744-a05a-57ee1e7cf74d',
        toVersion: '3.3.0',
        fromVersion: '3.2.3',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: 'ff6ec331-e738-452e-818b-354278bfcbbe',
        toVersion: '3.2.3',
        fromVersion: '3.2.2',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: 'db54e8f0-3f1e-4d0f-80b4-a722f633a710',
        toVersion: '3.2.2',
        fromVersion: '3.2.1',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
      {
        id: '70c174e7-e550-427e-84d0-831b1e369ef2',
        toVersion: '3.2.1',
        fromVersion: '3.2.0',
        modifications: {
          automatic: [],
          manual: [],
        },
      },
    ]
  } catch (error) {
    throw new Error(
      'Unable to fetch the latest redwood information from online'
    )
  }
}

async function checkForUpgrades(ctx, task, tag) {
  // Read current version from the base package.json
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(getPaths().base, 'package.json'))
  )
  let localVersion = packageJson.devDependencies['@redwoodjs/core']

  // Remove any leading non-digits, i.e. ^ or ~
  while (!/\d/.test(localVersion.charAt(0))) {
    localVersion = localVersion.substring(1)
  }

  // Determine if the user has a tag (e.g. -rc, -canary), if so extract the tag from the version
  let currentTag = ''
  if (localVersion.includes('-')) {
    currentTag = extractTagFromVersion(localVersion)
    try {
      validateTag(currentTag)
    } catch (error) {
      throw new Error(
        `Your current version tag "${tag}" is invalid. Please correct this manually.`
      )
    }
  }

  // if the user didn't explicitly specify a tag use their existing one
  ctx.requestedTag = tag === undefined ? currentTag : tag
  const remoteVersion = ctx.latestVersions[ctx.requestedTag]
  ctx.remoteVersion = remoteVersion

  // Confirm an upgrade is available, give user notice if already on latest version.
  ctx.upgrading = semver.gt(remoteVersion, localVersion)
  if (!ctx.upgrading) {
    task.output = `You are already on the latest version (${remoteVersion})`
    return
  }

  // Pull out all relevant upgrades
  ctx.relevantUpgrades = ctx.latestUpgrades.filter((upgrade) => {
    return (
      semver.gt(upgrade.toVersion, localVersion) ||
      semver.eq(upgrade.fromVersion, localVersion)
    )
  })

  // Compute total number of automatic and manual code modifications
  let automaticModificationCount = 0
  let manualModificationCount = 0
  ctx.relevantUpgrades.forEach((upgrade) => {
    automaticModificationCount += upgrade.modifications.automatic.length
    manualModificationCount += upgrade.modifications.manual.length
  })

  // Craft a descriptive upgrade message
  let upgradeMessage = `An upgrade is available (${localVersion} -> ${remoteVersion})`
  if (automaticModificationCount > 0 || manualModificationCount > 0) {
    upgradeMessage += `\n  This upgrade involves:\n`
    if (automaticModificationCount) {
      upgradeMessage += `    (x${automaticModificationCount}) Automatic code checks/modifications\n`
    }
    if (manualModificationCount) {
      upgradeMessage += `    (x${manualModificationCount}) Manual code checks/modifications\n`
    }
  }

  // TODO: See issue below and consider implications for not using user the links within prompts
  // Adding a terminal-link within a prompt message caused issues. Using the url instead wasn't great either as the prompt seems to be written over and overso the link isn't automatically highlighted (in vscode terminal for example) at all times only for brief moments.
  // upgradeMessage += `  Please see "https://github.com/redwoodjs/redwood/releases" for details.`

  upgradeMessage += `\n  Do you want to upgrade now?`

  // Prompt the user to confirm they want to upgrade now
  const response = await task.prompt({
    type: 'confirm',
    name: 'confirm-upgrade',
    message: upgradeMessage,
  })

  // User doesn't want to continue right now
  if (!response) {
    ctx.upgrading = false
    task.output = `You can read about the new release(s) at ${terminalLink(
      'release notes',
      'https://github.com/redwoodjs/redwood/releases'
    )}`
    return
  }
}

function extractTagFromVersion(version) {
  let tag = version.substring(version.indexOf('-') + 1).trim()
  if (tag.includes('.')) {
    tag = tag.split('.')[0]
  }
  return tag
}

function setRedwoodDepsForAllSides(ctx, task, version) {
  const updatePaths = [
    getPaths().base,
    getPaths().api.base,
    getPaths().web.base,
  ]
  return task.newListr(
    updatePaths.map((basePath) => {
      const pkgJsonPath = path.join(basePath, 'package.json')
      return {
        title: `Updating ${pkgJsonPath} to use version ${version}`,
        task: () => updatePackageJsonVersion(basePath, version, {}),
        skip: () => !fs.existsSync(pkgJsonPath),
      }
    })
  )
}

/**
 * Iterates over Redwood dependencies in package.json files and updates the version.
 */
function updatePackageJsonVersion(pkgPath, version, { dryRun, verbose }) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf-8')
  )

  if (pkg.dependencies) {
    for (const depName of Object.keys(pkg.dependencies).filter((x) =>
      x.startsWith('@redwoodjs/')
    )) {
      if (verbose || dryRun) {
        console.log(
          ` - ${depName}: ${pkg.dependencies[depName]} => ^${version}`
        )
      }
      pkg.dependencies[depName] = `^${version}`
    }
  }
  if (pkg.devDependencies) {
    for (const depName of Object.keys(pkg.devDependencies).filter((x) =>
      x.startsWith('@redwoodjs/')
    )) {
      if (verbose || dryRun) {
        console.log(
          ` - ${depName}: ${pkg.devDependencies[depName]} => ^${version}`
        )
      }
      pkg.devDependencies[depName] = `^${version}`
    }
  }

  if (!dryRun) {
    fs.writeFileSync(
      path.join(pkgPath, 'package.json'),
      JSON.stringify(pkg, undefined, 2)
    )
  }
}

async function handleCodeModifications(ctx, task) {
  // TODO: Inline this sorting...
  // Sort the relevant upgrades so we can perform them in the correct lowest to highest version order
  let sortedUpgrades = [...ctx.relevantUpgrades].sort((a, b) => {
    if (semver.lt(a.toVersion, b.toVersion)) {
      return -1
    } else {
      if (semver.gt(a.toVersion, b.toVersion)) {
        return 1
      }
    }
    return 0
  })

  return task.newListr((parent) => [
    {
      title: '',
      task: async (ctx, task) => {
        let totalStep = 0
        let totalSteps = sortedUpgrades.reduce(
          (partialSum, upgrade) =>
            partialSum +
            (upgrade.modifications.automatic.length +
              upgrade.modifications.manual.length),
          0
        ) // TODO: Compute this
        for (const upgrade of sortedUpgrades) {
          let theseStep = 1
          let theseSteps =
            upgrade.modifications.automatic.length +
            upgrade.modifications.manual.length
          parent.title = `Handling necessary code modifications (${(
            (totalStep / totalSteps) *
            100
          ).toFixed(2)}% Complete)`
          for (const automaticChange of upgrade.modifications.automatic) {
            task.title = `Change ${theseStep} of ${theseSteps} for ${upgrade.fromVersion} -> ${upgrade.toVersion}`
            const response = await task.prompt({
              type: 'confirm',
              name: `automatic-change-${automaticChange.id}`,
              message: `Automatic: ${automaticChange.title}\n  Script: ${automaticChange.url}\n\n  Description\n  ${automaticChange.description}\n\n  Proceed?`,
              initial: true,
            })
            if (response) {
              task.output = 'Checking if change is needed...'
              await new Promise((r) => setTimeout(r, 1000)) // TODO: remove this
              // TODO: Fetch script
              // TODO: Run the check function
              const shouldRun = Math.random() < 0.5 // (TODO: Replace with result of check function)
              if (shouldRun) {
                // TODO: Run the modification script
                task.output = 'Changes needed, performing them now...'
                await new Promise((r) => setTimeout(r, 1000)) // TODO: remove this

                const errorHappened = Math.random() < 0.5 // (TODO: Determine from catching the modification script)
                if (errorHappened) {
                  await task.prompt({
                    type: 'invisible',
                    name: `error-change-${automaticChange.id}`,
                    message: `Automatic: ${automaticChange.title}\n  Script: ${automaticChange.url}\n\n  Error\n  There was an error whilst trying to apply this change [ERROR-MESSAGE]. See [DOCS-LINK] for more information.\n\n  Press enter to proceed...`,
                  })
                } else {
                  task.output = 'Changes made successfully.'
                  await new Promise((r) => setTimeout(r, 1000)) // TODO: remove this
                }
              } else {
                task.output =
                  'This particular change is not nessecary for your redwood project.'
                await new Promise((r) => setTimeout(r, 1000)) // TODO: Consider if this is good or not - my thinking was to allow the user to briefly see the message before moving on without needing any more prompts.
              }
            } else {
              ctx.skippedSteps.push(automaticChange.id)
            }
            totalStep += 1
            theseStep += 1
          }
          for (const manualChange of upgrade.modifications.manual) {
            task.title = `Change ${theseStep} of ${theseSteps} for ${upgrade.fromVersion} -> ${upgrade.toVersion}`
            await task.prompt({
              type: 'invisible',
              name: `manual-change-${manualChange.id}`,
              message: `Manual: ${manualChange.title}\n  Docs: ${manualChange.url}\n\n  Description\n  ${manualChange.description}\n\n  Press enter to proceed...`,
            })
            totalStep += 1
            theseStep += 1
          }
        }
        parent.title = `Handling necessary code modifications (100.00% Complete)`

        if (ctx.skippedSteps.length > 0) {
          task.title =
            'The following automatic checks/modifications were skipped:\n[LIST-OF-SKIPPED-CHECKS/MODIFICATIONS]' // TODO: Show a notice that some were skipped
        } else {
          task.title = 'All automatic checks/modifications were run.'
        }
      },
    },
  ])
}

async function yarnInstall({ verbose }) {
  const yarnVersion = await getCmdMajorVersion('yarn')
  try {
    await execa(
      'yarn install',
      yarnVersion > 1 ? [] : ['--force', '--non-interactive'],
      {
        shell: true,
        stdio: verbose ? 'inherit' : 'pipe',
        cwd: getPaths().base,
      }
    )
  } catch (e) {
    throw new Error(
      `Could not finish installation. ${
        yarnVersion > 1
          ? 'Please run `yarn install` for more details'
          : 'Please run `yarn install --force`, before continuing'
      }`
    )
  }
}

export const getCmdMajorVersion = async (command) => {
  // Get current version
  const { stdout } = await execa(command, ['--version'], {
    cwd: getPaths().base,
  })

  if (!SEMVER_REGEX.test(stdout)) {
    throw new Error(`Unable to verify ${command} version.`)
  }

  // Get major version number
  const version = stdout.match(SEMVER_REGEX)[0]
  return parseInt(version.split('.')[0])
}

async function refreshPrismaClient(task, { verbose }) {
  /** Relates to prisma/client issue, @see: https://github.com/redwoodjs/redwood/issues/1083 */
  try {
    await generatePrismaClient({
      verbose,
      force: false,
      schema: getPaths().api.dbSchema,
    })
  } catch (e) {
    task.skip('Refreshing the Prisma client caused an Error.')
    console.log(
      'You may need to update your prisma client manually: $ yarn rw prisma generate'
    )
    console.log(c.error(e.message))
  }
}

const dedupeDeps = async (task, { verbose }) => {
  try {
    const yarnVersion = await getCmdMajorVersion('yarn')
    const npxVersion = await getCmdMajorVersion('npx')
    let npxArgs = []
    if (npxVersion > 6) {
      npxArgs = ['--yes']
    }
    const baseExecaArgsForDedupe = {
      shell: true,
      stdio: verbose ? 'inherit' : 'pipe',
      cwd: getPaths().base,
    }
    if (yarnVersion > 1) {
      await execa('yarn', ['dedupe'], baseExecaArgsForDedupe)
    } else {
      await execa(
        'npx',
        [...npxArgs, 'yarn-deduplicate'],
        baseExecaArgsForDedupe
      )
    }
  } catch (e) {
    console.log(c.error(e.message))
    throw new Error(
      'Could not finish de-duplication. For yarn 1.x, please run `npx yarn-deduplicate`, or for yarn 3 run `yarn dedupe` before continuing'
    )
  }
  await yarnInstall({ verbose })
}
