import path from 'path'

import { stripAndFormatPathForTesting } from '../../lib/testing'
import { RedwoodProject } from '../project'
import { extractSides } from '../side'

const FIXTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '__fixtures__'
)

describe.each([
  'empty-project',
  'example-todo-main',
  'example-todo-main-with-errors',
  'test-project',
])('From within the %s fixture', (PROJECT_NAME) => {
  const PROJECT_PATH = path.join(FIXTURE_PATH, PROJECT_NAME)

  const RWJS_CWD = process.env.RWJS_CWD
  beforeAll(() => {
    process.env.RWJS_CWD = PROJECT_PATH
  })
  afterAll(() => {
    process.env.RWJS_CWD = RWJS_CWD
  })

  it('returns the correct sides without a project', () => {
    const sides = extractSides(undefined).sort((a, b) =>
      a.filepath > b.filepath ? 1 : b.filepath > a.filepath ? -1 : 0
    )
    sides.forEach((side) => {
      side.filepath = stripAndFormatPathForTesting(side.filepath, PROJECT_PATH)
    })
    expect(sides).toMatchSnapshot()
  })

  it('returns the correct sides with a project', () => {
    const project = RedwoodProject.getProject({
      pathWithinProject: PROJECT_PATH,
      readFromCache: false,
      insertIntoCache: false,
    })
    const sides = extractSides(project).sort((a, b) =>
      a.filepath > b.filepath ? 1 : b.filepath > a.filepath ? -1 : 0
    )
    sides.forEach((side) => {
      side.filepath = stripAndFormatPathForTesting(side.filepath, PROJECT_PATH)
    })
    expect(sides).toMatchSnapshot()
  })
})
