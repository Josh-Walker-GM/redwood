import type { ReactNode } from 'react'
import React, { useMemo, memo } from 'react'

import type { LocationContextType } from './location'
import { namedRoutes } from './namedRoutes'
import { normalizePage } from './page'
import type { RouterContextProviderProps } from './router-context'
import { ActiveRouteLoader } from './server-route-loader'
import { SplashPage } from './splash-page'
import {
  analyzeRoutes,
  matchPath,
  parseSearch,
  replaceParams,
  validatePath,
} from './util'
import type { Wrappers, TrailingSlashesTypes } from './util'

export interface RouterProps
  extends Omit<RouterContextProviderProps, 'routes' | 'activeRouteName'> {
  trailingSlashes?: TrailingSlashesTypes
  pageLoadingDelay?: number
  children: ReactNode
  location: LocationContextType
}

export const Router: React.FC<RouterProps> = ({
  useAuth,
  paramTypes,
  pageLoadingDelay,
  children,
  location,
}) => {
  return (
    // Level 1/3 (outer-most)
    <LocationAwareRouter
      useAuth={useAuth}
      paramTypes={paramTypes}
      pageLoadingDelay={pageLoadingDelay}
      location={location}
    >
      {children}
    </LocationAwareRouter>
  )
}

const LocationAwareRouter: React.FC<RouterProps> = ({
  paramTypes,
  children,
  location,
}) => {
  const analyzeRoutesResult = useMemo(() => {
    const analyzedRoutes = analyzeRoutes(children, {
      currentPathName: location.pathname,
      // @TODO We haven't handled this with SSR/Streaming yet.
      // May need a babel plugin to extract userParamTypes from Routes.tsx
      userParamTypes: paramTypes,
    })

    return analyzedRoutes
  }, [location.pathname, children, paramTypes])

  const {
    pathRouteMap,
    hasHomeRoute,
    namedRoutesMap,
    NotFoundPage,
    activeRoutePath,
  } = analyzeRoutesResult

  // Assign namedRoutes so it can be imported like import {routes} from 'rwjs/router'
  // Note that the value changes at runtime
  Object.assign(namedRoutes, namedRoutesMap)

  // The user has not generated routes if the only route that exists is the
  // not found page, and that page is not part of the namedRoutes object
  const hasGeneratedRoutes = Object.keys(namedRoutes).length > 0

  const shouldShowSplash =
    (!hasHomeRoute && location.pathname === '/') || !hasGeneratedRoutes

  if (shouldShowSplash && typeof SplashPage !== 'undefined') {
    return (
      <SplashPage
        hasGeneratedRoutes={hasGeneratedRoutes}
        allStandardRoutes={pathRouteMap}
      />
    )
  }

  // Render 404 page if no route matches
  if (!activeRoutePath) {
    if (NotFoundPage) {
      return (
        <ActiveRouteLoader
          spec={normalizePage(NotFoundPage)}
          path={location.pathname}
        />
      )
    }

    return null
  }

  const { path, page, name, redirect, whileLoadingPage, sets } =
    pathRouteMap[activeRoutePath]

  if (!path) {
    throw new Error(`Route "${name}" needs to specify a path`)
  }

  // Check for issues with the path.
  validatePath(path, name || path)

  const { params: pathParams } = matchPath(path, location.pathname, {
    userParamTypes: paramTypes,
  })

  const searchParams = parseSearch(location.search)
  const allParams = { ...searchParams, ...pathParams }

  let redirectPath: string | undefined = undefined

  if (redirect) {
    if (redirect[0] === '/') {
      redirectPath = replaceParams(redirect, allParams)
    } else {
      const redirectRouteObject = Object.values(pathRouteMap).find(
        (route) => route.name === redirect,
      )

      if (!redirectRouteObject) {
        throw new Error(
          `Redirect target route "${redirect}" does not exist for route "${name}"`,
        )
      }

      redirectPath = replaceParams(redirectRouteObject.path, allParams)
    }
  }

  // Level 2/3 (LocationAwareRouter)
  return (
    <>
      {!redirectPath && page && (
        <WrappedPage
          sets={sets}
          routeLoaderElement={
            <ActiveRouteLoader
              path={path}
              spec={normalizePage(page)}
              params={allParams}
              whileLoadingPage={whileLoadingPage}
            />
          }
        />
      )}
    </>
  )
}

// Dummy component for server-router. We don't support Auth in server-router
// yet, so we just render the children for now
interface AuthenticatedRouteProps {
  children: React.ReactNode
  roles?: string | string[]
  unauthenticated: string
  whileLoadingAuth?: () => React.ReactElement | null
}

const AuthenticatedRoute: React.FC<AuthenticatedRouteProps> = ({
  children,
}) => {
  return <>{children}</>
}

interface WrappedPageProps {
  routeLoaderElement: ReactNode
  sets: Array<{
    id: string
    wrappers: Wrappers
    isPrivate: boolean
    props: {
      private?: boolean
      [key: string]: unknown
    }
  }>
}

/**
 * This is effectively a Set (without auth-related code)
 *
 * This means that the <Set> and <PrivateSet> components become "virtual"
 * i.e. they are never actually Rendered, but their props are extracted by the
 * analyze routes function.
 *
 * This is so that we can have all the information up front in the routes-manifest
 * for SSR, but also so that we only do one loop of all the Routes.
 */
const WrappedPage = memo(({ routeLoaderElement, sets }: WrappedPageProps) => {
  // @NOTE: don't mutate the wrappers array, it causes full page re-renders
  // Instead just create a new array with the AuthenticatedRoute wrapper

  if (!sets || sets.length === 0) {
    return routeLoaderElement
  }

  return sets.reduceRight<ReactNode | undefined>((acc, set) => {
    // For each set in `sets`, if you have `<Set wrap={[a,b,c]} p="p" />` then
    // this will return
    // <a p="p"><b p="p"><c p="p"><routeLoaderElement /></c></b></a>
    // If you have `<PrivateSet wrap={[a,b,c]} p="p" />` instead it will return
    // <AuthenticatedRoute>
    //   <a p="p"><b p="p"><c p="p"><routeLoaderElement /></c></b></a>
    // </AuthenticatedRoute>

    // Bundle up all the wrappers into a single element with each wrapper as a
    // child of the previous (that's why we do reduceRight)
    let wrapped = set.wrappers.reduceRight((acc, Wrapper, index) => {
      return React.createElement(
        Wrapper,
        { ...set.props, key: set.id + '-' + index },
        acc,
      )
    }, acc)

    // If set is private, wrap it in AuthenticatedRoute
    if (set.isPrivate) {
      const unauthenticated = set.props.unauthenticated
      if (!unauthenticated || typeof unauthenticated !== 'string') {
        throw new Error(
          'You must specify an `unauthenticated` route when using PrivateSet',
        )
      }

      // We do this last, to make sure that none of the wrapper elements are
      // rendered if the user isn't authenticated
      wrapped = (
        <AuthenticatedRoute {...set.props} unauthenticated={unauthenticated}>
          {wrapped}
        </AuthenticatedRoute>
      )
    }

    return wrapped
  }, routeLoaderElement)
})
