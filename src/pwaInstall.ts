import { useEffect, useState } from 'react'

const DISMISSAL_STORAGE_KEY = 'music-tool:pwa-install-dismissed-at'
const DISMISSAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export function shouldShowInstallBanner(showBanner: boolean, needRefresh: boolean) {
  return showBanner && !needRefresh
}

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
}

function isInDismissalCooldown() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISSAL_STORAGE_KEY))
  return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < DISMISSAL_COOLDOWN_MS
}

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>()
  const [bannerDismissed, setBannerDismissed] = useState(isInDismissalCooldown)
  const [installed, setInstalled] = useState(isInStandaloneMode)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
      setBannerDismissed(isInDismissalCooldown())
    }
    const onAppInstalled = () => {
      setInstalled(true)
      setInstallPrompt(undefined)
      window.localStorage.removeItem(DISMISSAL_STORAGE_KEY)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const dismissBanner = () => {
    window.localStorage.setItem(DISMISSAL_STORAGE_KEY, String(Date.now()))
    setBannerDismissed(true)
  }

  const requestInstall = async () => {
    if (!installPrompt) return

    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'dismissed') dismissBanner()
    setInstallPrompt(undefined)
  }

  const canInstall = Boolean(installPrompt) && !installed

  return {
    canInstall,
    showBanner: canInstall && !bannerDismissed,
    dismissBanner,
    requestInstall,
  }
}
