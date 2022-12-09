import path from 'path'

import { stripAndFormatPathForTesting } from '../../lib/testing'
import { extractCells } from '../cell'
import { RedwoodProject } from '../project'

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

  it('returns the correct cells without a project', () => {
    const cells = extractCells(undefined)
    cells.forEach((cell) => {
      cell.filepath = stripAndFormatPathForTesting(cell.filepath, PROJECT_PATH)
      expect(cell).toMatchSnapshot(cell.filepath)
    })
    expect(cells.length).toMatchSnapshot('cell count')
  })

  it('returns the correct cells with a project', () => {
    const project = RedwoodProject.getProject({
      pathWithinProject: PROJECT_PATH,
      readFromCache: false,
      insertIntoCache: false,
    })
    const cells = extractCells(project)
    cells.forEach((cell) => {
      cell.filepath = stripAndFormatPathForTesting(cell.filepath, PROJECT_PATH)
      expect(cell).toMatchSnapshot(cell.filepath)
    })
    expect(cells.length).toMatchSnapshot('cell count')
  })
})
