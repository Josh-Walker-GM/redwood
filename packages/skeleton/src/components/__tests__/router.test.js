import path from 'path'

// import { RedwoodProject } from '../project'
import { extractRouters } from '../router'

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

  it('returns the correct routers without a project', () => {
    const routers = extractRouters(undefined)
    routers.forEach((router) => {
      router.filepath = router.filepath.substring(PROJECT_PATH.length)
    })
    expect(routers).toMatchSnapshot()
  })

  it.todo('returns the correct routers with a project') //, () => {
  // const project = RedwoodProject.getProject({
  //   pathWithinProject: PROJECT_PATH,
  //   readFromCache: false,
  //   insertIntoCache: false,
  // })
  // const routers = extractRouters(project)
  // routers.forEach((router) => {
  //   router.filepath = router.filepath.substring(PROJECT_PATH.length)
  // })
  // expect(routers).toMatchSnapshot()
  // })
})
