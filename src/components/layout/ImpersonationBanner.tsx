import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'

const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonatedUser, sessionUser, stopImpersonation } = useAuth()

  if (!isImpersonating || !impersonatedUser) {
    return null
  }

  const targetLabel = impersonatedUser.full_name || impersonatedUser.email || impersonatedUser.id
  const actingLabel = sessionUser?.full_name || sessionUser?.email || 'admin'

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-100 border-b border-amber-300 text-amber-900 shadow-sm">
      <div className="container mx-auto px-4 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm">
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 mt-0.5 text-amber-700" />
          <div>
            <p className="font-semibold">Impersonation mode active</p>
            <p className="text-amber-900/90">
              Viewing SplitSpace as <span className="font-medium">{targetLabel}</span>.
              {' '}Signed in as <span className="font-medium">{actingLabel}</span>.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="self-start sm:self-auto border-amber-400 text-amber-900 hover:bg-amber-200"
          onClick={stopImpersonation}
        >
          Exit impersonation
        </Button>
      </div>
    </div>
  )
}

export default ImpersonationBanner
