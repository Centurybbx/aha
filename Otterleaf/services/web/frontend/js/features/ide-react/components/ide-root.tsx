import { FC, memo, useState, useEffect } from 'react'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import withErrorBoundary from '@/infrastructure/error-boundary'
import IdePage from '@/features/ide-react/components/layout/ide-page'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'
import { Loading } from '@/features/ide-react/components/loading'
import {
  initializeEditorApi,
  cleanupEditorApi,
} from '@/features/ide-react/api/editor-api'
import {
  initializeIframeApi,
  cleanupIframeApi,
} from '@/features/ide-react/api/iframe-api'

const IdeRoot: FC = () => {
  const [loaded, setLoaded] = useState(false)

  // Initialize editor API and iframe API when component mounts
  useEffect(() => {
    initializeEditorApi()
    initializeIframeApi()

    return () => {
      cleanupEditorApi()
      cleanupIframeApi()
    }
  }, [])

  return (
    <ReactContextRoot>
      {loaded ? <IdePage /> : <Loading setLoaded={setLoaded} />}
    </ReactContextRoot>
  )
}

export default withErrorBoundary(memo(IdeRoot), () => (
  <GenericErrorBoundaryFallback />
))
